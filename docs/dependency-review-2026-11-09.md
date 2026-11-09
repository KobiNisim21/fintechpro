# Dependency maintenance — 2026-11-09

The initial fresh npm audit reported 44 affected package entries: 3 critical,
27 high, 12 moderate and 2 low. These include inherited findings in parent
packages, not 44 independently reachable application vulnerabilities.

Applied compatible updates through `npm audit fix --ignore-scripts`, without
`--force` or overrides. Notable locked versions now include Axios 1.21.0,
Express 4.22.3, Mongoose 8.24.8, React Router DOM 7.18.5,
socket.io-parser 4.2.7, engine.io 6.6.11, ws 8.21.1,
fast-xml-parser 5.12.0 and shell-quote 1.12.0.

Two findings remained after compatible updates:

- Vite is development/build tooling, not the deployed static server. Updated
  the explicit pin from 6.3.5 to 6.4.6, staying on major version 6.
- Nodemailer was declared as a production dependency but no source, scripts or
  API imports/use were found. Removed it instead of introducing a major upgrade
  for an unused capability. No email sending was exercised.

Final `npm audit` and `npm audit --omit=dev` each reported zero vulnerabilities.
This is a point-in-time registry result, not a comprehensive application
security assessment or a guarantee against future advisories.

Validation:

- Offline regression tests: 11 passed.
- Disposable MongoDB integration tests: 10 passed, covering actual CRUD,
  ownership, lot validation and persistence with the updated backend packages.
- `npm run build`: TypeScript and Vite production build passed.
- Local browser smoke check: authenticated synthetic portfolio, Insights and
  Watchlist rendered; fixture reported one active Socket.IO connection;
  browser console reported zero errors and warnings.
- No production records or credentials were used for the local smoke check.

The local dev-server check required execution outside the filesystem sandbox:
the sandboxed dependency optimizer could not read parent directories. The same
server started successfully with the supported execution approval.
