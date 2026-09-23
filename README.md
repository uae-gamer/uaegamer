# StoreFront Step 15 — Hybrid public architecture + catalog optimization

## Run SQL
Run `STEP15-SQL.sql` in Supabase SQL Editor. It only adds indexes and is safe to run repeatedly.

## Architecture
The secure/application workflow remains a SPA in `index.html`:
- Home/catalog
- Login/Register
- Cart
- Checkout
- Account
- Orders
- Notifications
- Admin

Public content now has independent URLs:
- `terms.html`
- `privacy.html`
- `delivery.html`
- `guide-1.html` ... `guide-4.html`
- `content.html` fallback for future managed pages
- `product.html?id=<product UUID>`

These pages still read their current content/settings from Supabase.

## Product details
Every Home product now has a View Details link to its standalone product page.
The product page includes:
- full product description
- image gallery
- category/type
- price and AED estimate
- stock status
- Included Content
- Add to Cart

The same `storefront_cart_v1` browser cart is shared with the SPA.

## Performance changes
- Home no longer downloads every Included Content row at startup.
- Included Content is requested on demand, 25 rows at a time.
- Product images are loaded in batched queries instead of one request per product.
- Images use browser lazy-loading.
- Database indexes were added for common catalog/content queries.

This is the first performance step. A later milestone can move Home product search/filter/pagination itself fully server-side for very large catalogs.

Keep your working `js/config.js`.
