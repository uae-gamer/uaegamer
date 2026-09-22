# StoreFront Step 10 — Product Management

## Run SQL first
Open Supabase SQL Editor and run `STEP10-SQL.sql`.

It adds `product_images.storage_path`, which allows an admin to delete an image from Supabase Storage cleanly instead of only deleting its database URL.

## Keep your working config
This ZIP still contains the placeholder `js/config.js`.
Keep your current working GitHub `js/config.js`, or copy its Project URL and publishable key into this one.

Never use a service-role / secret key in GitHub Pages.

## New in Step 10
- Full product editing
- Product active/inactive setting
- Numeric display order
- Multiple product-image upload
- 8 MB/type validation in browser
- Supabase Storage upload to the existing `product-images` bucket
- Image deletion from Storage + database
- Image display ordering
- Included Content add/edit/delete/order
- Included Content displayed as-is, no Arabic translation
- Included Content popup paginated at 25 entries per page
- Product expense add/edit/delete/order
- Product deletion cleans up stored images first

## Checkout
Not enabled in Step 10. The agreed workflow for the next checkout milestone is:
1. Each unique cart item displays its own `paypal_link`.
2. The customer manually visits each PayPal link and pays.
3. The customer manually enters the corresponding PayPal Transaction ID for each unique item.
4. The order is submitted only after all required transaction IDs and delivery information are entered.
5. The IDs are stored on `order_items` for manual admin verification.
