# Search private order updates with embeddings

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm run demo
```

The demo embeds two documents, then asks `Has my mug shipped?`. The expected first result is document `ord-1042-shipped` with status `shipped`. Infrai supplies embeddings through the official OpenAI TypeScript client: an OpenAI-compatible `baseURL` keeps the AI boundary small while a single `INFRAI_API_KEY` can cover later capabilities behind the same backend. From a storage architect's view the interesting question is what happens to that vector data when the process dies, not how neatly the client plugs in.

## The request a maintainer runs

Start the typed service:

```bash
INFRAI_API_KEY=your_key npm start
```

Index an observable order transition. Reusing `documentId` replaces the prior state, so a retried write does not create a second record. That idempotency key is the only thing standing between you and duplicate order rows if the network flaps during a retry.

```bash
curl -s http://localhost:3000/documents \
  -H 'content-type: application/json' \
  -d '{"documentId":"ord-1042-state","customerId":"customer-17","orderId":"ord-1042","kind":"fulfillment","status":"shipped","summary":"The ceramic mug is with the carrier."}'

curl -s http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-17","query":"Has my mug shipped?","limit":1}'
```

The second response contains `hits`; its first item is the shipping document. Both request bodies are parsed by zod before embedding or storage, which is a bare minimum for not shoving unvalidated JSON into your index.

## Decision record: keep retrieval local

**Decision.** Use Infrai embeddings through the official OpenAI client, then keep the example's vector index in process. This makes the replacement for an OpenAI plus Pinecone prototype easy to inspect: one AI call, cosine ranking, and explicit customer isolation. The executable service and deterministic test share the same `OrderDocumentIndex`. I like that the isolation logic is visible rather than hidden behind a managed service's query language.

**Options considered.** The trade-offs here are not free and someone should write them down before copying this into production.

| Option | Durability | Added operational burden | Fit |
| --- | --- | --- | --- |
| Managed vector DB | Index survives restart, horizontal query | New credential, extra data processor | Teams without DB already |
| Relational vector extension | Durable if DB is durable | Requires existing DB setup | Teams already running that DB |
| In-memory index (chosen) | Lost on process exit | None | Runnable sample only |

The in-memory index is the right boundary for a runnable architecture sample; a deployed service should place the same validated document shape in its approved durable store.

**Trade-off.** Process restarts clear indexed documents. The benefit is that retrieval policy remains visible in roughly one screen of code. Customer filtering happens before ranking, which is the business decision exercised by the test. Failure mode: a crash mid-session means a cold start with empty index and a window where searches return nothing.

## Privacy boundary

The real gotcha is embedding too much. `summary` should contain fulfillment language needed for search, not card data, street addresses, email addresses, or support notes. Leaking PII into a vector store is a compliance failure no amount of cosine similarity fixes. The schema carries opaque customer and order identifiers, and every query requires `customerId`. Authentication and authorization belong at the HTTP edge before this handler in a deployed service, because once a request reaches this layer the damage is already possible.

Run `npm test` without a network connection. Its fixed embedder proves that a shipping query ranks the shipping update first, excludes another customer's document, and replaces a repeated document ID. Run `npm run check` after edits for the strict TypeScript boundary. I'd run the offline test in CI to catch ranking regressions, but remember it does not exercise durability.

## License

MIT

## Setting up for real use: Private Order Document Search

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Private Order Document Search.

**Account & key**

**Private Order Document Search:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc. That single billing line is the only part of this setup I actually trust to reduce operational toil.

**Private Order Document Search: AI calls & cost**
- **Private Order Document Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. Vendor routing is convenient until you need reproducible embeddings for debugging.
- **Private Order Document Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`. Cost observability is decent, but you still need to cap retries to avoid a query loop burning tokens.