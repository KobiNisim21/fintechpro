# Always-on personal-alert worker on Northflank

Northflank Sandbox currently advertises always-on services with no sleeping,
2 services/2 jobs/1 database and up to $20/month of cloud resources. These are
account/resource limits, not an uptime SLA. Confirm the actual account plan,
remaining allowance and zero-cost service selection before creating anything.
Do not select a paid plan or add-ons without the owner's approval.
Source checked 2026-11-10: https://northflank.com/pricing

Deploy ONLY the dedicated worker. Keep the current web frontend, API/socket host,
MongoDB and Web Push signing identity. The worker accesses the existing database
and sends notifications using the existing subscriptions and delivery queue;
users should not need to opt in again. No database copy is required.

## Service configuration

- Repository: KobiNisim21/fintechpro, branch main; build context repository root.
- Build: Dockerfile.alert-worker (Node 22, production dependencies, non-root user).
- Command: image default, or npm run start:alert-worker for a buildpack deployment.
- One always-on instance, smallest suitable free/Sandbox compute allocation.
- Port: 8080 HTTP; runtime may set PORT to match the configured port.
- Liveness: GET /api/live. Readiness: GET /api/health.
- Allow startup time for MongoDB/market providers before enforcing readiness.
- Runtime secret MONGODB_URI must point to the SAME database as the current app.
- Reuse FINNHUB_API_KEY if configured for the current quote source; Yahoo fallback
  remains available. Carry over required quote-provider secrets if applicable.
- No Google OAuth/JWT secrets are needed by this worker. No frontend variables.
- MongoDB Atlas network rules must allow the new worker's egress. Change those
  narrowly if required; do not broaden database access as a shortcut.

Inject secrets through the deployment platform's runtime secret fields. Never
commit them, print them in logs, or paste them in chat. The Docker build excludes
environment files and copies only package metadata and server code/data.

## Cutover and verification

1. Create/deploy the service only after authenticating to the intended account
   and checking the available free resources. Leave Render's worker active.
2. Verify health returns 200, the worker completes repeated minute checks and
   the existing application's /api/push/config keeps backgroundChecks=true.
3. Verify test push on the owner's already subscribed device. Do not change
   existing holdings or live alert thresholds just to force a trigger.
4. Only then set PERSONAL_ALERT_WORKER_ENABLED=false on the Render backend and
   redeploy it. This disables its PERSONAL rule timer only; news, market alerts,
   sockets and HTTP API remain active. It defaults to enabled, so existing
   deployments are unaffected until an operator explicitly opts out.
5. Confirm the heartbeat advances with Render's personal timer disabled. Keep
   the new worker on exactly one instance initially. Database leases/atomic rule
   updates protect the overlap period from duplicate sends.

Rollback: restore PERSONAL_ALERT_WORKER_ENABLED=true on Render, deploy and verify
its heartbeat, then stop the Northflank worker. Preserve MongoDB PushConfig and
device subscriptions throughout.

## Local validation and remaining work

Runtime tests cover independent periodic checks, no overlap, recovery from errors,
health readiness/staleness, endpoint isolation and shutdown. Existing alert/push
integration tests cover durable jobs, account separation and duplicate suppression.
Deployment remains pending Northflank sign-in and resource/secret configuration.

Validation on 2026-11-10: 50 offline tests, 30 disposable MongoDB integration
tests, typecheck and the frontend production build passed. A transitive import
check found no worker source dependencies outside the server directory. The
Docker image itself was not built locally because the Docker engine is not
running; the Northflank image build and live readiness remain to be verified.
Do not disable Render's personal-alert timer until that verification succeeds.
