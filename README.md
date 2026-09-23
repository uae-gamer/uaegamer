# StoreFront Step 14.2 — Footer Guides + Startup Flash Fix

No SQL changes are required if Step 14.1 SQL has already been completed successfully.

Fixes:
- Enabled Guide Pages now appear as buttons in the public footer alongside Footer Pages.
- Footer Pages and Guide Pages load independently; one failed table query does not blank the other.
- English/Arabic page content is selected correctly when the footer modal opens.
- Default StoreFront title/colors/fonts no longer flash visibly during refresh.
- The last successful site appearance settings are cached locally and applied as early as possible.
- The page remains visually cloaked until the real Supabase settings have been applied.
- Startup failures still reveal the page instead of leaving it permanently hidden.

Keep your working `js/config.js`.
