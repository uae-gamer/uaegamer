# StoreFront Step 18 — Transactional Emails

Run `STEP18-SQL.sql`, deploy `transactional-email`, configure the two Edge Function secrets,
and create the three database webhooks described in `STEP18-DEPLOY.md`.

New:
- Resend-backed transactional emails
- welcome email option
- customer order submitted email
- customer order status emails
- optional admin new-order email
- Admin → Email Log
- email controls in Site Settings

Keep your working `js/config.js`.

Do not upload the `supabase/` folder to GitHub Pages; it is backend deployment source only.
