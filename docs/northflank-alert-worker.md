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
The completed deployment and cutover verification are recorded below.

Validation on 2026-11-10: 50 offline tests, 30 disposable MongoDB integration
tests, typecheck and the frontend production build passed. A transitive import
check found no worker source dependencies outside the server directory. The
Docker image itself was not built locally because the Docker engine is not
running; the image was subsequently built successfully on Northflank and live
readiness verified after the owner configured runtime credentials.

## Provisioning status (2026-11-10)

The newly created FinTechPro team was pay-as-you-go and not eligible for Sandbox.
The owner's existing Sandbox team has one free PaaS project; creating another
project is blocked by the provider's project limit. A SECOND, separate service
named fintechpro-alert-worker was instead created inside that existing free
project. Northflank labels the new service Free, with one nf-compute-10 instance
(0.1 shared vCPU / 256 MB) in Europe West/London. The pre-existing application was
not modified. No paid project, compute upgrade or database was created.

Source main/a194df3 was built using /Dockerfile.alert-worker. Northflank build
careful-crowd-2579 completed in 23 seconds and is marked Deployed. Port 8080 HTTP
and readiness /api/health are configured. Initial health returned 503 pending
runtime credentials; the owner subsequently entered and saved MONGODB_URI and
FINNHUB_API_KEY directly in the new service's environment editor. Health is now
200. No credential values were exported, logged or committed.

## Completed cutover and coexistence checks (2026-11-10)

The new worker's /api/live and /api/health return HTTP 200 with the expected
personal-alert-worker role. Its lastCheckedAt advanced through repeated minute
checks. After Northflank readiness was confirmed, PERSONAL_ALERT_WORKER_ENABLED=false
was set ONLY on Render's fintechpro-backend, which successfully deployed main/bdfe736.
The persisted boolean switch was verified without reading private credentials.
Render's HTTP, sockets and market/news services remain available; only its
personal-alert timer is disabled.

More than three minutes after the disabled Render timer was observed (beyond the
shared heartbeat freshness window), FinTechPro's authenticated /api/push/config
still returned HTTP 200 and backgroundChecks=true. Northflank health returned 200
with lastCheckedAt=2026-11-10T21:41:55.329Z. This confirms the new worker continues
background checking independently of Render's personal timer. The freshly loaded
production application's console reported no warnings or errors. No holdings or
alert thresholds were changed. Native push receipt after this migration was not
directly observed; the owner reported working notifications before cutover.

The original knreminder-backend was inspected read-only. Northflank shows it
Running on the same aaee8b6 source with one instance, 0.1 vCPU/256 MB, 10 days
uptime and 0 restarts. Its last active deployment remains dated 2026-10-31,
predating this work. The new worker has a distinct service name, repository,
container and endpoint inside the SAME free project. The project/account quota
is shared by the two services. No old application settings, repository, endpoint
or notification rules were modified. KNReminder's business-level notification
delivery was not exercised during these read-only checks.
