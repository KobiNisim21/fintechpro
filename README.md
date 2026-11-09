
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
- `npm run test:integration`: actual CRUD and ownership tests against disposable
  local MongoDB. First run downloads the MongoDB binary into `node_modules/.cache`.
- `npm run build`: typecheck and production build in `dist/`.
- `node scripts/smoke-market.js`: optional read-only integration check of public
  US quotes, Israeli fund NAV and USD/ILS. Requires network access and providers.

## Disposable browser QA

Run `npm run qa:server`, then use `http://127.0.0.1:4175/__qa/login/one`
or `/__qa/login/two` in the test browser. These are synthetic users authenticated
with a process-local test signing key. The server binds only to loopback, uses a
fresh local MongoDB process and deterministic market quotes, and does not read
the project's `.env` files or access the production database/providers.
The helper routes exist only in the separately launched fixture server.
Google OAuth is not configured in this fixture; use the helper URLs for test logins.

Exercise add, edit/save/reload, delete/confirm, logout and account switching.
`POST /__qa/fail-next-read` makes one portfolio read return an intentional 503;
`POST /__qa/disconnect` closes local transports to verify reconnect/subscriptions.
Check `/__qa/state` for the fixture database, record count and subscriptions.
Stop with Ctrl+C to discard the temporary database. The fixture signing key is
regenerated on restart, so old local sessions must log in via the helper again.

For holdings with purchase history, `PUT /api/positions/:id` must include the
updated `lots` array; totals are derived and validated from those lots. Legacy
holdings without lots can still accept quantity/average-price updates.

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
