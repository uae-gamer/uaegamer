# StoreFront Step 19

Stability + editable transactional email templates.

Run `STEP19-SQL.sql`, redeploy the existing `transactional-email` Edge Function, then upload the website files while keeping `js/config.js`.

See `STEP19-DEPLOY.md`.

Main changes:
- same-session browser-tab return no longer rerenders active pages/forms
- unsaved form unload protection
- Admin → Email Templates
- editable subjects, HTML bodies and plain-text bodies
- HTML + plain-text Resend messages
- template enable/disable controls
- no Edge Function redeploy required for normal template wording changes
