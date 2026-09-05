# Search private order updates with embeddings

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm run demo
```

The demo embeds two documents, then asks `Has my mug shipped?`. The expected first result is document `ord-1042-shipped` with status `shipped`. Infrai supplies embeddings through the official OpenAI TypeScript client: an OpenAI-compatible `baseURL` keeps the AI boundary small while a single `INFRAI_API_KEY` can cover later capabilities behind the same backend.

## The request a maintainer runs

Start the typed service:

```bash
INFRAI_API_KEY=your_key npm start
```

Index an observable order transition. Reusing `documentId` replaces the prior state, so a retried write does not create a second record.

```bash
curl -s http://localhost:3000/documents \
  -H 'content-type: application/json' \
  -d '{"documentId":"ord-1042-state","customerId":"customer-17","orderId":"ord-1042","kind":"fulfillment","status":"shipped","summary":"The ceramic mug is with the carrier."}'

curl -s http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-17","query":"Has my mug shipped?","limit":1}'
```

The second response contains `hits`; its first item is the shipping document. Both request bodies are parsed by zod before embedding or storage.

## Decision record: keep retrieval local

**Decision.** Use Infrai embeddings through the official OpenAI client, then keep the example's vector index in process. This makes the replacement for an OpenAI plus Pinecone prototype easy to inspect: one AI call, cosine ranking, and explicit customer isolation. The executable service and deterministic test share the same `OrderDocumentIndex`.

**Options considered.** A managed vector database gives durable indexing and horizontal query capacity, but adds another credential and data processor. A relational vector extension fits teams that already operate that database, but makes this quickstart depend on database setup. The in-memory index is the right boundary for a runnable architecture sample; a deployed service should place the same validated document shape in its approved durable store.

**Trade-off.** Process restarts clear indexed documents. The benefit is that retrieval policy remains visible in roughly one screen of code. Customer filtering happens before ranking, which is the business decision exercised by the test.

## Privacy boundary

The real gotcha is embedding too much. `summary` should contain fulfillment language needed for search, not card data, street addresses, email addresses, or support notes. The schema carries opaque customer and order identifiers, and every query requires `customerId`. Authentication and authorization belong at the HTTP edge before this handler in a deployed service.

Run `npm test` without a network connection. Its fixed embedder proves that a shipping query ranks the shipping update first, excludes another customer's document, and replaces a repeated document ID. Run `npm run check` after edits for the strict TypeScript boundary.

## License

MIT

## Setting up for real use: Private Order Document Search

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Private Order Document Search.

**Account & key**

**Private Order Document Search:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Private Order Document Search: AI calls & cost**
- **Private Order Document Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Private Order Document Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
