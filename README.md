# StoreFront Step 16 — True server-side catalog pagination

## Run SQL first
Run `STEP16-SQL.sql` in Supabase SQL Editor.

It adds:
- `pg_trgm` search support/indexes
- `catalog_products(...)` RPC for public catalog queries

## Main change
Home no longer downloads all active products.

For each catalog view, Supabase receives:
- search text
- category
- type
- sort
- language
- items per page
- offset

and returns:
- only the current page's product rows
- the total matching count

The existing 8 / 16 / 32 page-size options remain.

## Search / filtering / sorting
All are now server-side:
- English/Arabic title and description search
- category
- type
- A-Z / Z-A using the selected language
- effective price low/high
- default `sort_order`

Search has a 250 ms debounce to avoid issuing a request for every keystroke.

## Cart compatibility
Because off-page products are no longer in browser memory, Cart and Checkout now hydrate only the product IDs currently stored in the user's cart.

This preserves:
- stock limits
- current prices
- PayPal links
- checkout behavior

without loading the full catalog.

## Other performance behavior retained
- Included Content loads only on demand, 25 at a time.
- Images load only for products on the current catalog page.
- Image tags use lazy loading.
- Dedicated product pages remain independent public URLs.

Keep your working `js/config.js`.
