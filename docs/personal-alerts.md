# Personal alert checks

Personal rules are durable, owner-scoped in-app alerts. Price rules pause after
one trigger. Daily-move and concentration rules retain the persisted 24-hour
cooldown. Missing/stale quotes must never produce a synthetic trigger.

The dashboard now calls the authenticated POST `/api/alerts/check` immediately,
once per minute while visible, and when returning to a visible page. This covers
open sessions even if a backend worker is unavailable. Creation also checks the
new rule immediately. The continuously running Node backend retains its poller.
Concurrent checks cannot duplicate a trigger because the conditional MongoDB
update is atomic. The UI reports failed automatic requests instead of hiding them.

The check response retains `triggered` and adds `checkedAt` and per-rule
`evaluations`: triggered, not_met, unavailable, no_holding or cooldown, including
the actual observed value when available. The UI translates these explanations,
shows the last-check time, and distinguishes triggered/paused price rules from
ordinary paused rules. New automatic triggers show an in-app banner and badge.
The client accepts the old response shape during separate frontend/backend rolls.

Deployment observation on 2026-11-10: the public frontend bundle points to
`https://fintechpro-backend.onrender.com`. Vercel's serverless handler does not
start the Node poller, but that alone does NOT establish the cause for this
owner's rule: the active Render worker/version and quote values still require
authenticated production verification. The dedicated browser is at the login
page; no owner portfolio/rules were changed. Do not claim the GOOG 286 condition
was or was not satisfied from the screenshot alone.

Checks while the site is closed require a deployed, continuously running worker
or scheduler. Push/email/Telegram delivery is not implemented by these rules.
Follow-up: TraderAi-c3g. Production/device verification: TraderAi-cz1.

Validation: 41 offline tests and 24 disposable MongoDB integration tests passed,
as did typecheck and production build. Regression coverage includes matching and
unmet thresholds, observed values, missing holdings, missing/stale/invalid quotes,
one-time pause, persisted cooldown, concurrent checks and owner separation.
Mobile browser QA verified immediate creation checks (150 vs 149 triggers;
150 vs 286 stays active), and a separate GOOG rule triggered automatically at the
next minute without a manual check. Further browser results are recorded at the
end of this document.

Final browser checks after a fresh reload: immediate creation also displays the
new global banner (including triggers observed via rule reloads); the result says
"new alerts in this check" to avoid confusing prior history with new triggers.
Hebrew/RTL at 320px and English/LTR at 390px retained readable result text with no
horizontal overflow. Repeated manual checks did not retrigger paused price rules.
The synthetic financial digest was unchanged. The final browser console had zero
errors and warnings. The owner-specific GOOG 286 production diagnosis remains
open in TraderAi-4xh until the owner signs in through the dedicated browser.
