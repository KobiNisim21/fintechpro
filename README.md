
# TraderAI / FinTechPro

Portfolio dashboard built with React, TypeScript and Vite, backed by Express,
MongoDB and Socket.IO. Includes US and Israeli securities, Google sign-in,
watchlists, market news, analytics and MCP portfolio tools.

## Local development

Use Node.js 24 LTS and install dependencies with `npm ci`.
Configure local environment files with MongoDB, Google authentication, JWT and
market provider settings. Never commit credentials.

- `npm run dev:all`: start the frontend and backend together.
- `npm run dev -- --port 5173 --open false`: frontend on an alternative local port.
- `npm start`: backend, default port 5000 (override with `PORT`).
- Set `VITE_API_URL` and `VITE_SOCKET_URL` when the backend uses another address.
- On Vercel, configure `VITE_SOCKET_URL` to the persistent Socket.IO backend;
  serverless API functions do not run the background streaming server.

## Quality checks

- `npm run typecheck`: strict TypeScript validation.
- `npm test`: offline regression and HTTP health tests, using Node's test runner.
- `npm run build`: typecheck and production build in `dist/`.
- `node scripts/smoke-market.js`: optional read-only integration check of public
  US quotes, Israeli fund NAV and USD/ILS. Requires network access and providers.

## Data availability

`GET /api/live` reports HTTP liveness independently of MongoDB.
`GET /api/health` returns 200 when MongoDB is connected, or 503 when unavailable.
Background news and alert services wait for the database and retry on startup
failure. API database failures return 503 instead of silently buffering queries.

Quote cards expose provider, received quote timestamp, cache status and purchase
cost estimates. Fund NAVs update daily; a quote timestamp is not a guarantee of
real-time exchange data. Failed refreshes retain explicitly marked previous data.
Portfolio caches are scoped to the signed-in user. History and forex requests
are shared briefly, and sparklines use the batch history API.

The growth chart values today's holdings at historical prices. It is not a
cash-flow-adjusted investment return and excludes securities without historical
data. Use the analytics view for the existing TWR benchmark calculations.

The UI derives from [FinTech Dashboard Design](https://www.figma.com/design/nKzUL9lLzRXhUoozIRbG7a/FinTech-Dashboard-Design).
