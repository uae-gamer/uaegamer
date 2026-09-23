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
      Store.alert(Store.state.lang === 'ar' ? 'يرجى تسجيل الدخول قبل استخدام سلة التسوق.' : 'Please log in before using the shopping cart.', 'err');
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
    Store.alert(Store.state.lang === 'ar' ? 'تمت إضافة المنتج إلى السلة.' : 'Item added to cart.');
  },

  async ensureProducts() {
    const ids = Object.keys(this.get());
    if (!ids.length) return;

    const existing = new Map((Store.state.products || []).map(p => [p.id, p]));
    const missing = ids.filter(id => !existing.has(id));

    if (missing.length) {
      const { data, error } = await db
        .from('products')
        .select('*')
        .in('id', missing);

      if (error) {
        console.error(error);
        Store.alert(Store.state.lang === 'ar' ? 'تعذر تحميل منتج أو أكثر من السلة.' : 'Unable to load one or more cart items: ' + error.message, 'err');
      } else {
        for (const p of (data || [])) existing.set(p.id, p);
      }
    }

    Store.state.products = [...existing.values()];
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

  async render() {
    const ar = Store.state.lang === 'ar';

    if (!Store.state.user) {
      Store.view(`
        <div class="alert err">
          ${ar ? 'الوصول مقيّد. يجب تسجيل الدخول كمستخدم مسجل لعرض سلة التسوق وإدارتها.' : 'Access Restricted. You must be logged in as a registered user to view and manage your shopping cart.'}
        </div>
        <p><button id="cart-login" class="btn">${t('login')}</button></p>
      `);
      document.getElementById('cart-login')?.addEventListener('click', () => Store.go('login'));
      return;
    }

    await this.ensureProducts();
    const rows = this.rows();

    if (!rows.length) {
      Store.view(`<div class="card">${ar ? 'سلة التسوق فارغة.' : 'Your shopping cart is empty.'}</div>`);
      return;
    }

    let total = 0;
    for (const [product, qty] of rows) total += Products.price(product) * qty;

    Store.view(`
      <h2>${t('shoppingCart')}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${ar ? 'المنتج' : 'Item'}</th>
            <th>${t('price')}</th>
            <th>${t('quantity')}</th>
            <th>${t('subtotal')}</th>
            <th>${t('action')}</th>
          </tr></thead>
          <tbody>
            ${rows.map(([p, qty]) => `
              <tr>
                <td>${Store.esc(localize(p,'title'))}</td>
                <td>
                  <div>${Products.price(p).toFixed(2)} ${t('usd')}</div>
                  <div class="approx-aed">${t('equalsApprox')}: ${(Products.price(p)*3.67).toFixed(2)} ${t('aed')}</div>
                </td>
                <td><input class="qty" data-id="${p.id}" type="number" min="0"
                           max="${Number(p.stock_quantity||0)}" value="${qty}" style="width:80px"></td>
                <td>
                  <div>${(Products.price(p)*qty).toFixed(2)} ${t('usd')}</div>
                  <div class="approx-aed">${t('equalsApprox')}: ${(Products.price(p)*qty*3.67).toFixed(2)} ${t('aed')}</div>
                </td>
                <td><button class="btn danger remove" data-id="${p.id}">${t('remove')}</button></td>
              </tr>`).join('')}
            <tr>
              <th colspan="3" style="text-align:end">${t('itemTotal')}:</th>
              <th colspan="2">
                <div>${total.toFixed(2)} ${t('usd')}</div>
                <div class="approx-aed">${t('equalsApprox')}: ${(total*3.67).toFixed(2)} ${t('aed')}</div>
              </th>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted">${ar
        ? 'جميع الأسعار المعروضة نهائية وتشمل ضريبة القيمة المضافة المطبقة ورسوم التوصيل ورسوم PayPal/معالجة الدفع. لن تتم إضافة أي رسوم إضافية عند إتمام الطلب.'
        : 'All prices shown are final and include applicable VAT, delivery charges, and PayPal/payment-processing fees. No additional charges will be added at checkout.'}</p>
      <button id="continue-checkout" class="btn success">${t('continueCheckout')}</button>
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

  async renderCheckout() {
    const ar = Store.state.lang === 'ar';
    if (!Store.state.user) return Store.go('login');

    await this.ensureProducts();
    const rows = this.rows();
    if (!rows.length) return this.render();

    const missingPayPal = rows.filter(([p]) => !String(p.paypal_link || '').trim());
    if (missingPayPal.length) {
      Store.view(`
        <div class="alert err">
          ${ar ? 'لا يمكن متابعة الدفع لأن منتجاً واحداً أو أكثر لا يحتوي على رابط دفع PayPal.' : 'Checkout cannot continue because one or more products do not have a PayPal payment link configured.'}
        </div>
        <button id="back-cart" class="btn secondary">${t('backCart')}</button>
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

      <h2>${t('deliveryPayment')}</h2>

      <form id="checkout-form" class="panel">
        <div class="bilingual">
          <div class="form-group">
            <label>${t('firstName')} <span class="req-star">*</span></label>
            <input name="first_name" value="${Store.escAttr(profile.first_name||'')}" required>
          </div>

          <div class="form-group">
            <label>${t('lastName')} <span class="req-star">*</span></label>
            <input name="last_name" value="${Store.escAttr(profile.last_name||'')}" required>
          </div>
        </div>

        <div class="form-group">
          <label>${t('emailAddress')} <span class="req-star">*</span></label>
          <input name="email" type="email" value="${Store.escAttr(email)}" required>
        </div>

        <div class="form-group">
          <label>${t('contactMobile')} <span class="req-star">*</span></label>
          <input name="mobile_number" value="${Store.escAttr(profile.mobile_number||'')}" required>
        </div>

        <div class="form-group">
          <label>${t('deliveryAddress')} <span class="req-star">*</span></label>
          <textarea name="delivery_address" rows="3" required>${Store.esc(profile.delivery_address||'')}</textarea>
        </div>

        <div class="form-group">
          <label>${t('customerNotes')}</label>
          <textarea name="customer_notes" rows="3"></textarea>
        </div>

        <h3>${t('paypalVerification')}</h3>

        <p class="description">
          ${ar
            ? 'يرجى دفع قيمة كل منتج فريد باستخدام زر PayPal المخصص له، ثم إدخال معرّف المعاملة المقابل.'
            : 'Please pay for each unique item using its dedicated PayPal button, then enter the corresponding Transaction ID.'}
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
                ${t('payPaypal')}
              </a>
            </div>

            <div class="description">
              ${ar ? 'المجموع الفرعي للمنتج' : 'Item subtotal'}: ${(Products.price(p)*qty).toFixed(2)} ${t('usd')}
              <div class="approx-aed">${t('equalsApprox')}: ${(Products.price(p)*qty*3.67).toFixed(2)} ${t('aed')}</div>
            </div>

            <div class="form-group">
              <label>
                ${t('transactionId')} — ${Store.esc(localize(p,'title'))}
                <span class="req-star">*</span>
              </label>

              <input
                class="paypal-tx-input"
                data-id="${p.id}"
                name="tx_${p.id}"
                placeholder="${ar ? 'مثال: 9XX12345YY67890ZZ' : 'e.g. 9XX12345YY67890ZZ'}"
                autocomplete="off"
                value="${Store.escAttr(savedState.tx?.[p.id] || '')}"
                required>
            </div>

            <div class="paypal-click-status muted" data-id="${p.id}">
              ${(savedState.clicked || []).includes(p.id)
                ? (ar ? 'تم فتح رابط PayPal. أدخل معرّف المعاملة المقابل.' : 'PayPal link opened. Enter the corresponding Transaction ID.')
                : (ar ? 'افتح رابط PayPal قبل إرسال الطلب.' : 'Open the PayPal link before submitting the order.')}
            </div>
          </div>
        `).join('')}

        <div class="card checkout-total-box">
          <div>
            <strong>${t('itemTotal')}: ${itemTotal.toFixed(2)} ${t('usd')}</strong>
            <div class="approx-aed">${t('equalsApprox')}: ${(itemTotal*3.67).toFixed(2)} ${t('aed')}</div>
          </div>
          <div class="checkout-final-total">
            <strong>${t('total')}: ${itemTotal.toFixed(2)} ${t('usd')}</strong>
            <div class="approx-aed">${t('equalsApprox')}: ${(itemTotal*3.67).toFixed(2)} ${t('aed')}</div>
          </div>
          <p class="muted inclusive-price-note">${ar
            ? 'السعر النهائي يشمل ضريبة القيمة المضافة المطبقة ورسوم التوصيل ورسوم PayPal/معالجة الدفع. لن تتم إضافة أي رسوم إضافية.'
            : 'The final price includes applicable VAT, delivery charges, and PayPal/payment-processing fees. No additional charges will be added.'}</p>
        </div>

        <div class="form-group checkout-agree">
          <input type="checkbox" id="delivery-agree" style="width:auto" required>
          <label for="delivery-agree">
            ${t('agreeDelivery')}
            <span class="req-star">*</span>
          </label>
        </div>

        <button id="submit-order-btn" type="submit" class="btn" disabled>
          ${ar ? 'يرجى فتح كل رابط PayPal وإدخال جميع معرّفات المعاملات' : 'Please open each PayPal link and enter every Transaction ID'}
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
        if (status) status.textContent = ar ? 'تم فتح رابط PayPal. أدخل معرّف المعاملة المقابل.' : 'PayPal link opened. Enter the corresponding Transaction ID.';

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
        ar
          ? 'يرجى التأكد من صحة جميع المعلومات، وبالأخص كل معرّف معاملة PayPal، قبل إرسال الطلب.'
          : 'Please confirm that all information provided is valid, especially every PayPal Transaction ID, before submitting your order.'
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
      ? t('submitVerification')
      : (Store.state.lang === 'ar'
          ? 'يرجى فتح كل رابط PayPal وإدخال جميع معرّفات المعاملات'
          : 'Please open each PayPal link and enter every Transaction ID');
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
    button.textContent = Store.state.lang === 'ar' ? 'جارٍ إرسال الطلب...' : 'Submitting order...';

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
      Store.alert(Store.state.lang === 'ar' ? 'فشل إرسال الطلب.' : 'Order submission failed: ' + error.message, 'err');
      button.disabled = false;
      button.textContent = t('submitVerification');
      return;
    }

    this.clear();
    await Products.load();

    Store.view(`
      <div class="alert ok">
        ${Store.state.lang === 'ar'
          ? `تم إرسال الطلب رقم ${Store.esc(data?.order_number || '')} بنجاح للتحقق من الدفع.`
          : `Order #${Store.esc(data?.order_number || '')} was submitted successfully for payment verification.`}
      </div>

      <div class="card">
        <p><strong>${t('status')}:</strong> ${Store.state.lang === 'ar' ? 'بانتظار التحقق' : 'Pending verification'}</p>
        <p><strong>${t('total')}:</strong> ${Number(data?.total_usd||0).toFixed(2)} ${t('usd')}</p>
        <button id="view-orders" class="btn primary">${t('orders')}</button>
        <button id="return-home" class="btn">${t('home')}</button>
      </div>
    `);

    document.getElementById('view-orders').onclick = () => Store.go('orders');
    document.getElementById('return-home').onclick = () => Store.go('home');
  }
};