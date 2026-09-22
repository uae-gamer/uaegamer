# StoreFront Step 11 — Multi-image gallery + Checkout

## 1. Run SQL first
Run `STEP11-SQL.sql` in Supabase SQL Editor.

This replaces the checkout RPC with the per-item PayPal Transaction ID workflow and adds a unique index so the same Transaction ID cannot be reused across order items.

## 2. Keep your working config
Do not overwrite your working `js/config.js` with the placeholder version unless you copy your existing Project URL and publishable key into it.

## New storefront behavior
- Product cards now have previous/next arrows when more than one image exists.
- Clicking the product image opens a larger viewer.
- The viewer has arrows and thumbnail navigation.
- Cart continues to use browser localStorage for the pre-checkout basket.
- Checkout requires the customer to open every unique product's PayPal link.
- Checkout requires one PayPal Transaction ID for each unique product.
- Delivery contact information is required.
- Delivery Policy agreement is required.
- Order creation happens through a SECURITY DEFINER Supabase RPC.
- Product prices and stock are re-read and validated by PostgreSQL.
- Stock is locked while the order is created.
- Stock is decremented atomically after the order is accepted.
- Product expenses are snapshotted into each order item.
- Duplicate product entries are rejected server-side.
- Reused PayPal Transaction IDs are rejected by a unique database index.
- Admin Orders shows every per-item PayPal Transaction ID and supports order status/admin notes updates.
- My Orders also displays each item's PayPal Transaction ID.

## Financial total note
The legacy PHP checkout labels its total as including delivery fees, PayPal gateway fees and 5% VAT, but the observed checkout code accumulates item subtotals into `$total` and does not show a separate fee/VAT calculation in that path.

Therefore Step 11 deliberately stores:
- delivery_fee_usd = 0
- payment_gateway_fee_usd = 0
- vat_usd = 0
- total_usd = item subtotal

This prevents the new system from inventing charges. We can add explicit fee/VAT rules once their actual formula is defined.
