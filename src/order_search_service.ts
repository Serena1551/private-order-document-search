import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiEmbedder } from "./infrai_embeddings.js";
import { OrderDocumentIndex } from "./order_document_index.js";

const index = new OrderDocumentIndex(new InfraiEmbedder());
const port = Number(process.env.PORT ?? 3000);

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/documents") {
      const document = await index.upsert(await readJson(request));
      send(response, 200, { document });
      return;
    }
    if (request.method === "POST" && request.url === "/search") {
      const hits = await index.search(await readJson(request));
      send(response, 200, { hits });
      return;
    }
    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid request", issues: error.issues });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Request failed" });
  }
});

server.listen(port, () => {
  console.log(`Order document search listening on http://localhost:${port}`);
});
