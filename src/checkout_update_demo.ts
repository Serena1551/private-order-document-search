import { InfraiEmbedder } from "./infrai_embeddings.js";
import { OrderDocumentIndex } from "./order_document_index.js";

const index = new OrderDocumentIndex(new InfraiEmbedder());

await index.upsert({
  documentId: "ord-1042-shipped",
  customerId: "customer-17",
  orderId: "ord-1042",
  kind: "order_update",
  status: "shipped",
  summary: "The ceramic mug left the warehouse and is with the carrier.",
});

await index.upsert({
  documentId: "ord-1042-receipt",
  customerId: "customer-17",
  orderId: "ord-1042",
  kind: "receipt",
  status: "paid",
  summary: "Receipt for the ceramic mug purchase.",
});

const hits = await index.search({
  customerId: "customer-17",
  query: "Has my mug shipped?",
  limit: 1,
});

console.log(JSON.stringify(hits, null, 2));
