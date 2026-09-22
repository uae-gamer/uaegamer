window.Cart = {
  key: 'storefront_cart_v1',
  checkoutStateKey: 'storefront_checkout_state_v1',

  getCheckoutState() {
    try {
      return JSON.parse(sessionStorage.getItem(this.checkoutStateKey) || '{"clicked":[],"tx":{}}');
    } catch {
      return { clicked: [], tx: {} };
    }
  },

  saveCheckoutState(state) {
    sessionStorage.setItem(this.checkoutStateKey, JSON.stringify(state));
  },

  clearCheckoutState() {
    sessionStorage.removeItem(this.checkoutStateKey);
  },

  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || '{}'); }
    catch { return {}; }
  },

  save(cart) {
    localStorage.setItem(this.key, JSON.stringify(cart));
    Store.renderNav();
  },

  clear() {
    localStorage.removeItem(this.key);
    this.clearCheckoutState();
    Store.renderNav();
  },

  count() {
    return Object.values(this.get()).reduce((sum, qty) => sum + Number(qty || 0), 0);
  },

  add(id) {
    if (!Store.state.user) {
      Store.go('login');
      Store.alert('Please log in before using the shopping cart.', 'err');
      return;
    }

    const product = Store.state.products.find(p => p.id === id);
    if (!product) return;

    const cart = this.get();
    cart[id] = Math.min(
      Number(cart[id] || 0) + 1,
      Number(product.stock_quantity || 1)
    );

    this.save(cart);
    Store.alert('Item added to cart.');
  },

  rows() {
    const cart = this.get();
    return Object.entries(cart)
      .map(([id, qty]) => [
        Store.state.products.find(p => p.id === id),
        Number(qty)
      ])
      .filter(([product, qty]) => product && qty > 0);
  },

  render() {
    if (!Store.state.user) {
      Store.view(`
        <div class="alert err">
          Access Restricted. You must be logged in as a registered user to view and manage your shopping cart.
        </div>
        <p><button id="cart-login" class="btn">Log In Here</button></p>
      `);
      document.getElementById('cart-login')?.addEventListener('click', () => Store.go('login'));
      return;
    }

    const rows = this.rows();

    if (!rows.length) {
      Store.view('<div class="card">Your shopping cart is empty.</div>');
      return;
    }

    let total = 0;
    for (const [product, qty] of rows) {
      total += Products.price(product) * qty;
    }

    Store.view(`
      <h2>Shopping Cart</h2>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Subtotal</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(([p, qty]) => `
              <tr>
                <td>${Store.esc(localize(p,'title'))}</td>
                <td>${Products.price(p).toFixed(2)} USD</td>
                <td>
                  <input class="qty" data-id="${p.id}" type="number"
                         min="0" max="${Number(p.stock_quantity||0)}" value="${qty}"
                         style="width:80px">
                </td>
                <td>${(Products.price(p)*qty).toFixed(2)} USD</td>
                <td>
                  <button class="btn danger remove" data-id="${p.id}">Remove</button>
                </td>
              </tr>
            `).join('')}

            <tr>
              <th colspan="3" style="text-align:end">Item Total:</th>
              <th colspan="2">${total.toFixed(2)} USD</th>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="muted">
        The current total reflects item selling prices. Delivery, payment-gateway fees and VAT
        remain 0 until explicit calculation rules are configured.
      </p>

      <button id="continue-checkout" class="btn success">Continue to Checkout</button>
    `);

    document.querySelectorAll('.qty').forEach(input => {
      input.onchange = () => {
        const cart = this.get();
        const max = Number(input.max || 0);
        const qty = Math.max(0, Math.min(Number(input.value)||0, max));

        if (qty) cart[input.dataset.id] = qty;
        else delete cart[input.dataset.id];

        this.save(cart);
        this.render();
      };
    });

    document.querySelectorAll('.remove').forEach(btn => {
      btn.onclick = () => {
        const cart = this.get();
        delete cart[btn.dataset.id];
        this.save(cart);
        this.render();
      };
    });

    document.getElementById('continue-checkout').onclick = () => Store.go('checkout');
  },

  renderCheckout() {
    if (!Store.state.user) return Store.go('login');

    const rows = this.rows();
    if (!rows.length) return this.render();

    const missingPayPal = rows.filter(([p]) => !String(p.paypal_link || '').trim());
    if (missingPayPal.length) {
      Store.view(`
        <div class="alert err">
          Checkout cannot continue because one or more products do not have a PayPal payment link configured.
        </div>
        <button id="back-cart" class="btn secondary">Back to Cart</button>
      `);
      document.getElementById('back-cart').onclick = () => Store.go('cart');
      return;
    }

    const profile = Store.state.profile || {};
    const email = Store.state.user?.email || '';
    const itemTotal = rows.reduce((sum,[p,q]) => sum + Products.price(p)*q, 0);
    const savedState = this.getCheckoutState();

    Store.view(`
      <button id="back-cart" class="btn secondary">← Back to Cart</button>

      <h2>Delivery and Payment Information</h2>

      <form id="checkout-form" class="panel">
        <div class="bilingual">
          <div class="form-group">
            <label>First Name <span class="req-star">*</span></label>
            <input name="first_name" value="${Store.escAttr(profile.first_name||'')}" required>
          </div>

          <div class="form-group">
            <label>Last Name <span class="req-star">*</span></label>
            <input name="last_name" value="${Store.escAttr(profile.last_name||'')}" required>
          </div>
        </div>

        <div class="form-group">
          <label>Email Address <span class="req-star">*</span></label>
          <input name="email" type="email" value="${Store.escAttr(email)}" required>
        </div>

        <div class="form-group">
          <label>Contact Mobile <span class="req-star">*</span></label>
          <input name="mobile_number" value="${Store.escAttr(profile.mobile_number||'')}" required>
        </div>

        <div class="form-group">
          <label>Delivery Address <span class="req-star">*</span></label>
          <textarea name="delivery_address" rows="3" required>${Store.esc(profile.delivery_address||'')}</textarea>
        </div>

        <div class="form-group">
          <label>Customer Notes</label>
          <textarea name="customer_notes" rows="3"></textarea>
        </div>

        <h3>PayPal Verification</h3>

        <p class="description">
          Please pay for each unique item using its dedicated PayPal button,
          then enter the corresponding Transaction ID.
        </p>

        ${rows.map(([p,qty]) => `
          <div class="paypal-txn-card">
            <div class="paypal-txn-header">
              <strong>${Store.esc(localize(p,'title'))} (Qty: ${qty})</strong>

              <a
                class="btn-paypal checkout-paypal-link"
                href="${Store.escAttr(p.paypal_link)}"
                target="_blank"
                rel="noopener noreferrer"
                data-id="${p.id}">
                Pay via PayPal
              </a>
            </div>

            <div class="description">
              Item subtotal: ${(Products.price(p)*qty).toFixed(2)} USD
            </div>

            <div class="form-group">
              <label>
                PayPal Transaction ID for ${Store.esc(localize(p,'title'))}
                <span class="req-star">*</span>
              </label>

              <input
                class="paypal-tx-input"
                data-id="${p.id}"
                name="tx_${p.id}"
                placeholder="e.g. 9XX12345YY67890ZZ"
                autocomplete="off"
                value="${Store.escAttr(savedState.tx?.[p.id] || '')}"
                required>
            </div>

            <div class="paypal-click-status muted" data-id="${p.id}">
              ${(savedState.clicked || []).includes(p.id)
                ? 'PayPal link opened. Enter the corresponding Transaction ID.'
                : 'Open the PayPal link before submitting the order.'}
            </div>
          </div>
        `).join('')}

        <div class="card checkout-total-box">
          <strong>Item Total: ${itemTotal.toFixed(2)} USD</strong>
          <div class="muted">Delivery fee: 0.00 USD</div>
          <div class="muted">Payment gateway fee: 0.00 USD</div>
          <div class="muted">VAT: 0.00 USD</div>
          <div><strong>Total: ${itemTotal.toFixed(2)} USD</strong></div>
        </div>

        <div class="form-group checkout-agree">
          <input type="checkbox" id="delivery-agree" style="width:auto" required>
          <label for="delivery-agree">
            I agree to the Delivery Policy stated on the website.
            <span class="req-star">*</span>
          </label>
        </div>

        <button id="submit-order-btn" type="submit" class="btn" disabled>
          Please open each PayPal link and enter every Transaction ID
        </button>
      </form>
    `);

    document.getElementById('back-cart').onclick = () => Store.go('cart');

    const clicked = new Set(savedState.clicked || []);

    document.querySelectorAll('.checkout-paypal-link').forEach(link => {
      link.addEventListener('click', () => {
        clicked.add(link.dataset.id);

        const current = this.getCheckoutState();
        current.clicked = Array.from(clicked);
        this.saveCheckoutState(current);

        const status = document.querySelector(
          `.paypal-click-status[data-id="${CSS.escape(link.dataset.id)}"]`
        );
        if (status) status.textContent = 'PayPal link opened. Enter the corresponding Transaction ID.';

        this.updateCheckoutSubmitState(clicked, rows);
      });
    });

    document.querySelectorAll('.paypal-tx-input').forEach(input => {
      input.addEventListener('input', () => {
        const current = this.getCheckoutState();
        current.clicked = Array.from(clicked);
        current.tx = current.tx || {};
        current.tx[input.dataset.id] = input.value;
        this.saveCheckoutState(current);
        this.updateCheckoutSubmitState(clicked, rows);
      });
    });

    document.getElementById('delivery-agree').addEventListener('change', () => {
      this.updateCheckoutSubmitState(clicked, rows);
    });

    // Restore the submit-button state after returning from PayPal.
    this.updateCheckoutSubmitState(clicked, rows);

    document.getElementById('checkout-form').onsubmit = async event => {
      event.preventDefault();

      if (!confirm(
        'Please confirm that all information provided is valid, especially every PayPal Transaction ID, before submitting your order.'
      )) return;

      await this.submitOrder(rows);
    };
  },

  updateCheckoutSubmitState(clicked, rows) {
    const button = document.getElementById('submit-order-btn');
    if (!button) return;

    const allLinksClicked = rows.every(([p]) => clicked.has(p.id));
    const allTxFilled = rows.every(([p]) => {
      const input = document.querySelector(
        `.paypal-tx-input[data-id="${CSS.escape(p.id)}"]`
      );
      return Boolean(input?.value.trim());
    });
    const agreed = document.getElementById('delivery-agree')?.checked === true;

    const ready = allLinksClicked && allTxFilled && agreed;

    button.disabled = !ready;
    button.classList.toggle('success', ready);

    button.textContent = ready
      ? 'Submit Order for Verification'
      : 'Please open each PayPal link and enter every Transaction ID';
  },

  async submitOrder(rows) {
    const form = document.getElementById('checkout-form');
    const button = document.getElementById('submit-order-btn');
    const fd = new FormData(form);

    const items = rows.map(([product, quantity]) => {
      const txInput = document.querySelector(
        `.paypal-tx-input[data-id="${CSS.escape(product.id)}"]`
      );

      return {
        product_id: product.id,
        quantity,
        paypal_transaction_id: txInput.value.trim()
      };
    });

    button.disabled = true;
    button.textContent = 'Submitting order...';

    const { data, error } = await db.rpc('create_order', {
      p_items: items,
      p_first_name: String(fd.get('first_name')||'').trim(),
      p_last_name: String(fd.get('last_name')||'').trim(),
      p_email: String(fd.get('email')||'').trim(),
      p_mobile_number: String(fd.get('mobile_number')||'').trim(),
      p_delivery_address: String(fd.get('delivery_address')||'').trim(),
      p_customer_notes: String(fd.get('customer_notes')||'').trim() || null
    });

    if (error) {
      console.error(error);
      Store.alert('Order submission failed: ' + error.message, 'err');
      button.disabled = false;
      button.textContent = 'Submit Order for Verification';
      return;
    }

    this.clear();
    await Products.load();

    Store.view(`
      <div class="alert ok">
        Order #${Store.esc(data?.order_number || '')} was submitted successfully for payment verification.
      </div>

      <div class="card">
        <p><strong>Status:</strong> Pending verification</p>
        <p><strong>Total:</strong> ${Number(data?.total_usd||0).toFixed(2)} USD</p>
        <button id="view-orders" class="btn primary">View My Orders</button>
        <button id="return-home" class="btn">Return Home</button>
      </div>
    `);

    document.getElementById('view-orders').onclick = () => Store.go('orders');
    document.getElementById('return-home').onclick = () => Store.go('home');
  }
};