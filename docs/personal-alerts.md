# Personal alerts and Web Push

Personal rules are durable and owner-scoped. Price rules pause after one trigger;
daily-move and concentration rules keep the persisted 24-hour cooldown. Missing
or stale quotes never produce a synthetic trigger. Dashboard checks run on entry,
every minute while visible, on return to the page, at creation and on demand.
Results explain unmet conditions, missing data/holdings and cooldowns.

## Enable notifications and install

The dashboard includes an installation suggestion and per-device push controls.
Supported browsers expose their native install prompt from the Install app button.
Browsers without that capability show installation instructions. iPhone/iPad users
must add the app to the Home Screen and open its icon before enabling push (iOS
16.4 or later). A site cannot install itself on iOS with a single automatic tap.
The suggestion is hidden in standalone mode or after the appinstalled event.
Dismissal hides the suggestion for the current view; push settings stay available.

Enable push requests system permission only after the user's explicit tap. The
worker and public key are prepared beforehand to retain iOS user activation.
Denied/unsupported states give actionable guidance. Each device opts in separately;
users can disable that device or send a rate-limited test. Language at enrollment
controls the notification language. The notification contains a ticker and generic
message, never portfolio amounts. Tapping it opens the app's own alerts panel.
Signing out removes the device registration when reachable and unsubscribes locally;
expired sessions also unsubscribe locally. No financial holdings are changed.

## Server delivery

Authenticated /api/push routes expose public config, device status, subscription
create/delete and a test sender. Subscriptions are private, owner-scoped, validated
against supported push-service HTTPS hosts, and limited to 10 devices per user.
A subscription transferred to a newly opted-in account cannot receive pending
messages belonging to the prior account. Expired endpoints (404/410) are removed.

VAPID signing keys are generated ONCE, persisted in MongoDB PushConfig and shared
by serverless/Node instances. The private key is excluded from default model reads
and all API responses. No per-instance ephemeral keys or client-side signing secret
are used. Protect database access and retain this document during restores; deleting
it rotates the identity and requires all devices to subscribe again.

A rule trigger atomically stores its push event on the rule. Projection upserts
one durable delivery per event/device under a unique index before clearing the
pending event. Leased dispatch coordinates concurrent workers. Provider failures
retry with exponential backoff (up to 5 attempts); delivery records expire after
24 hours. Retries after an ambiguous network failure may be accepted twice by a
provider; stable notification tags replace the prior visible notification.
Web Push provider acceptance does not prove device display or user interaction.

The Node backend's minute poll checks rules and drains pending deliveries even
without connected sockets or enabled rules. It records a background-worker heartbeat.
The UI warns opted-in devices when a recent heartbeat is missing. Background
notifications need this backend to remain running; a sleeping Render instance
cannot evaluate prices while asleep. An alternative scheduler may invoke
/api/cron/check-personal-alerts with Authorization: Bearer CRON_SECRET. That endpoint
fails closed if the secret is absent. No new paid/minutely Vercel cron is assumed
or silently enabled. An operator must provision a reliable schedule if the Node
backend is not always on. The existing daily Israeli-prices cron is unchanged.

## Deployment and validation

Deploy frontend AND backend from this commit; both use the same MongoDB. No manual
VAPID environment setup is needed. Manifest icons are real 180/192/512px square PNGs
normalized from the existing brand asset; the original asset remains intact.
Regenerate them on Windows with scripts/generate-pwa-icons.ps1.

Validation: 47 offline tests, 30 disposable MongoDB integration tests, typecheck
and production build passed. Coverage includes real Web Push encryption, private
config, owner separation, atomic triggers, durable/concurrent projection/dispatch,
transient failure retry, endpoint expiry, account switch, worker heartbeat, strict
scheduler authentication, visible worker notifications and safe click destinations.

Browser QA used a disposable portfolio and stubbed Notification/PushManager APIs
and push transport: enable, direct user activation, test-send and unsubscribe
completed through the real authenticated routes. Deferred native install prompting
was simulated, and iPhone instructions were tested using a simulated user agent.
These are NOT physical iPhone delivery or native installation tests. Verify a real
Home Screen installation, system permission and received test notification on the
owner's iPhone after deployment. Keep the owner's production rules unchanged.

References: https://webkit.org/blog/13878/ and
https://github.com/web-push-libs/web-push

Production verification (2026-11-10): after owner sign-in, Render was manually
deployed from main commit 36a292e. Deploy status is Live / succeeded; backend
health returns HTTP 200 with MongoDB connected. Both Vercel and Render push config
return HTTP 200, report backgroundChecks=true and share the same signing identity.
The background worker is therefore deployed and its heartbeat is confirmed.
No existing portfolio holding or rule was edited during deployment.

Render's dashboard identifies this as a free instance, which can spin down during
inactivity. Current heartbeat confirmation is not an uptime guarantee. Reliable
24/7 operation needs an approved always-on instance or an authenticated external
scheduler (TraderAi-rjn); no paid upgrade was made. Physical Home Screen install,
native permission and test-notification receipt remain in TraderAi-cz1. No real
device opt-in or native notification receipt is claimed by the browser checks.
