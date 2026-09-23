# StoreFront Step 14.1 — Fix package

Run `STEP14-1-SQL.sql` first.

Fixes:
- Admin role changes now use a secure SECURITY DEFINER RPC.
- Registration includes Mobile Number and stores it in profiles.
- Default Footer Pages are seeded if the table is empty.
- Default Guide Pages are seeded if the table is empty.
- Admin tabs persist in the URL, e.g. `#admin/pages`, so browser focus/auth refreshes do not reset to Listed Items.
- Body/header font-family settings now use CSS variables and are applied consistently to forms, tables, buttons and navigation.
- Existing Step 14 features remain.

Keep your current working `js/config.js`.
