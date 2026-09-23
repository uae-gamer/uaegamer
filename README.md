# StoreFront Step 15.1 — Navigation / Stability / Style Polish

No new SQL is required if Step 15 SQL was already run.

Fixes:
- Standalone Terms / Privacy / Delivery / Guide / Product pages now show the same authenticated navigation choices as the main site.
- Navigation reflects login state, cart count, account username and Admin Control access.
- Logout works from standalone pages.
- Saving Site Settings reloads the exact current URL (`#admin/settings`) so all global style/header/footer changes initialize cleanly.
- A success toast appears after the settings-page reload.
- Supabase TOKEN_REFRESHED events no longer rebuild the visible page when returning to a browser tab.
- SPA navigation no longer routes twice for the same click.
- Font size accepts both `16` and `16px` / `1rem` style values.
- Body text, controls, tables, buttons and managed content explicitly inherit the configured body font and base font size.
- Header/site titles explicitly use the configured header font.
- Vertical scrollbar is reserved to reduce horizontal layout shifting.

Keep your working `js/config.js`.
