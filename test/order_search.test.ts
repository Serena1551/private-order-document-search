import assert from "node:assert/strict";
import test from "node:test";
import type { Embedder } from "../src/infrai_embeddings.js";
import { OrderDocumentIndex } from "../src/order_document_index.js";

class DeterministicEmbedder implements Embedder {
  async embed(input: string[]): Promise<number[][]> {
    return input.map((text) => [
      /shipped|carrier/i.test(text) ? 1 : 0,
      /receipt|paid/i.test(text) ? 1 : 0,
    ]);
  }
}

test("returns the shipping update for the requesting customer", async () => {
  const index = new OrderDocumentIndex(new DeterministicEmbedder());
  await index.upsert({
    documentId: "a-shipping",
    customerId: "customer-a",
    orderId: "order-a",
    kind: "fulfillment",
    status: "shipped",
    summary: "Parcel transferred to the carrier.",
  });
  await index.upsert({
    documentId: "a-receipt",
    customerId: "customer-a",
    orderId: "order-a",
    kind: "receipt",
    status: "paid",
    summary: "Payment receipt issued.",
  });
  await index.upsert({
    documentId: "b-shipping",
    customerId: "customer-b",
    orderId: "order-b",
    kind: "fulfillment",
    status: "shipped",
    summary: "Parcel transferred to the carrier.",
  });

  const hits = await index.search({
    customerId: "customer-a",
    query: "Has it shipped?",
    limit: 2,
  });

  assert.deepEqual(hits.map((hit) => hit.documentId), ["a-shipping", "a-receipt"]);
  assert.ok(hits.every((hit) => hit.customerId === "customer-a"));
});

test("replaying a document id replaces its order state", async () => {
  const index = new OrderDocumentIndex(new DeterministicEmbedder());
  const base = {
    documentId: "order-a-state",
    customerId: "customer-a",
    orderId: "order-a",
    kind: "order_update" as const,
    summary: "Order state changed.",
  };
  await index.upsert({ ...base, status: "packed" });
  await index.upsert({ ...base, status: "shipped" });

  const hits = await index.search({ customerId: "customer-a", query: "shipped", limit: 5 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.status, "shipped");
});
