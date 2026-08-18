import { z } from "zod";
import type { Embedder } from "./infrai_embeddings.js";

export const orderDocumentSchema = z.object({
  documentId: z.string().min(1).max(120),
  customerId: z.string().min(1).max(120),
  orderId: z.string().min(1).max(120),
  kind: z.enum(["checkout", "fulfillment", "receipt", "order_update"]),
  status: z.enum(["placed", "paid", "packed", "shipped", "delivered", "refunded"]),
  summary: z.string().min(1).max(2_000),
});

export const searchRequestSchema = z.object({
  customerId: z.string().min(1).max(120),
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(5),
});

export type OrderDocument = z.infer<typeof orderDocumentSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchHit = OrderDocument & { score: number };

type IndexedDocument = { document: OrderDocument; embedding: number[] };

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function searchableText(document: OrderDocument): string {
  return `${document.kind} ${document.status} ${document.summary}`;
}

export class OrderDocumentIndex {
  private readonly documents = new Map<string, IndexedDocument>();
  private readonly embedder: Embedder;

  constructor(embedder: Embedder) {
    this.embedder = embedder;
  }

  async upsert(raw: unknown): Promise<OrderDocument> {
    const document = orderDocumentSchema.parse(raw);
    const [embedding] = await this.embedder.embed([searchableText(document)]);
    if (!embedding) throw new Error("Embedding response was empty");
    this.documents.set(document.documentId, { document, embedding });
    return document;
  }

  async search(raw: unknown): Promise<SearchHit[]> {
    const request = searchRequestSchema.parse(raw);
    const [queryEmbedding] = await this.embedder.embed([request.query]);
    if (!queryEmbedding) throw new Error("Embedding response was empty");
    return [...this.documents.values()]
      .filter(({ document }) => document.customerId === request.customerId)
      .map(({ document, embedding }) => ({
        ...document,
        score: cosine(queryEmbedding, embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, request.limit);
  }
}
