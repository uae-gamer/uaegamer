# StoreFront Step 14 — Admin/content completion

Run `STEP14-SQL.sql` first.

Then upload the package, keeping your existing working `js/config.js`.

New:
- Contact success toast bug fixed
- Registered Users profile-management page
- Footer Pages full bilingual editor
- Guide Pages full bilingual editor
- Expanded Site Settings
  - bilingual site name/description
  - text/logo/animated-gradient header modes
  - theme color/default theme
  - base fonts/font size
  - header fonts/font size
  - five gradient colors
  - social links
  - footer statistics toggle
- Browser CSV export/import for Listed Items
- Separate Included Content CSV export/import
- UTF-8 BOM export for spreadsheet compatibility
- Included Content remains one row per entry and is not auto-translated

Security note:
Supabase Auth login-email/password changes and permanent Auth-user deletion are intentionally not exposed
through GitHub Pages. Those require a trusted Edge Function/Admin API and must never use a service-role key
in browser code.
