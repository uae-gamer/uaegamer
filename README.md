# StoreFront Step 9.1 — startup fix

This revision fixes the blank-page/startup problem reported after Step 9.

Critical change:
- Navigation, language, theme, login/register routes and modal controls are initialized before Supabase reads.
- A failed optional query no longer stops the entire site.
- Product child records are loaded separately instead of depending on nested relationship expansion during startup.
- Visible diagnostic errors are shown instead of leaving the page blank.

Checkout remains intentionally disabled for this revision. The agreed final checkout model is:
- each unique cart item uses its own PayPal link;
- the customer manually pays using that item link;
- the customer manually enters the PayPal Transaction ID corresponding to each unique item;
- those IDs are submitted with the order for manual verification.

# StoreFront — Supabase/GitHub Pages rebuild

This package is the first real frontend milestone for the StoreFront rebuild.

## Before uploading
1. Keep your existing working `js/config.js` values.
2. If replacing the whole repository with this package, edit `js/config.js` and insert your Supabase Project URL and **publishable** key.
3. Never put a service-role key, secret key, database password, PayPal secret, or email-provider secret in this repository.

## Implemented in this milestone
- Responsive StoreFront-style header/navigation/footer
- English/Arabic and RTL
- Light/dark mode
- Supabase settings
- Supabase Auth: login, registration, logout, account editing
- Admin-role detection
- Public products, categories, types and text bar
- Search, filters, sorting, pagination
- Product cards, discounts, stock status
- Included-content modal
- Browser cart for authenticated users
- My Orders view
- Notifications view
- Admin: add/delete products, categories, types and text-bar entries
- Admin: orders/messages read views
- Admin: basic site settings
- Footer/guide foundations

## Intentionally not enabled yet
- Final checkout/payment submission
- Delivery fee / PayPal fee / VAT calculation
- Per-item PayPal transaction-ID workflow
- Product image upload/editing
- Product included-content editing in Admin
- Product expense editing in Admin
- Full product edit form
- Rich footer/guide page editor
- Statistics/revenue dashboard
- CSV import/export

Those are the next milestones. Checkout is deliberately held back until its financial/payment rules are finalized.
