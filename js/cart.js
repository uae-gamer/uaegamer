window.Cart = {
  key: 'storefront_cart_v1',
  checkoutStateKey: 'storefront_checkout_state_v1',
  cardCheckoutKey: 'uaegamer_card_checkout_v1',
  cardPaymentSession: null,
  cardSdkEnvironment: null,
  checkoutPaymentMethodTouched: false,

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
    try { sessionStorage.removeItem(this.cardCheckoutKey); } catch (_) {}
    this.cardPaymentSession = null;
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
        console.error('Cart product load failed:', error);
        Store.alert(
          Store.state.lang === 'ar'
            ? 'تعذر تحميل بعض عناصر السلة. يرجى تحديث الصفحة والمحاولة مرة أخرى.'
            : 'Some cart items could not be loaded. Please refresh the page and try again.',
          'err'
        );
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

    const settings = Store.state.settings || {};
    const paymentMode = String(settings.payment_mode || 'manual');
    const paypalEnvironment = String(settings.paypal_environment || 'sandbox');
    const automaticPayPal =
      ['sandbox','live'].includes(paypalEnvironment)
      && (paymentMode === 'automatic_fallback' || paymentMode === 'automatic');

    if (automaticPayPal && !this.forceManualCheckout) {
      return this.renderAutomaticCheckout(rows, paymentMode === 'automatic_fallback');
    }

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

    document.getElementById('back-cart').onclick = () => {
      this.forceManualCheckout = false;
      Store.go('cart');
    };

    if (this.forceManualCheckout) {
      const form = document.getElementById('checkout-form');
      form?.insertAdjacentHTML('afterbegin', `
        <div class="alert">
          ${ar ? 'أنت تستخدم التحقق اليدوي من PayPal كخيار احتياطي.' : 'You are using manual PayPal verification as the fallback.'}
          <button type="button" id="return-auto-paypal" class="btn secondary" style="margin-inline-start:8px">
            ${ar ? 'العودة إلى PayPal التلقائي' : 'Return to Automatic PayPal'}
          </button>
        </div>
      `);

      document.getElementById('return-auto-paypal')?.addEventListener('click', () => {
        this.forceManualCheckout = false;
        this.renderCheckout();
      });
    }

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

  renderAutomaticCheckout(rows, allowManualFallback = false) {
    const ar = Store.state.lang === 'ar';
    const profile = Store.state.profile || {};
    const email = Store.state.user?.email || '';
    const itemTotal = rows.reduce((sum,[p,q]) => sum + Products.price(p)*q, 0);
    const cardFeatureEnabled = Store.state.settings?.paypal_card_payments_enabled === true;

    this.cardPaymentSession = null;
    this.checkoutPaymentMethodTouched = false;

    Store.view(`
      <button id="back-cart" class="btn secondary">← ${t('backCart')}</button>

      <h2>${t('deliveryPayment')}</h2>

      <form id="checkout-form" class="panel" novalidate>
        <div class="alert ok">
          <strong>${ar ? 'الدفع الآمن' : 'Secure payment'}</strong>
          <div>
            ${ar
              ? `سيتم حجز المنتجات لمدة تصل إلى ${Number(Store.state.settings?.paypal_reservation_minutes || 20)} دقيقة أثناء إكمال الدفع.`
              : `Your items will be reserved for up to ${Number(Store.state.settings?.paypal_reservation_minutes || 20)} minutes while you complete payment.`}
          </div>
        </div>

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

        <h3>${ar ? 'ملخص الدفع' : 'Payment Summary'}</h3>

        ${rows.map(([p,qty]) => `
          <div class="paypal-txn-card">
            <strong>${Store.esc(localize(p,'title'))} × ${qty}</strong>
            <div class="description">
              ${(Products.price(p)*qty).toFixed(2)} ${t('usd')}
              <div class="approx-aed">${t('equalsApprox')}: ${(Products.price(p)*qty*3.67).toFixed(2)} ${t('aed')}</div>
            </div>
          </div>
        `).join('')}

        <div class="card checkout-total-box">
          <div class="checkout-final-total">
            <strong>${t('total')}: ${itemTotal.toFixed(2)} ${t('usd')}</strong>
            <div class="approx-aed">${t('equalsApprox')}: ${(itemTotal*3.67).toFixed(2)} ${t('aed')}</div>
          </div>
          <p class="muted inclusive-price-note">${ar
            ? 'السعر النهائي يشمل ضريبة القيمة المضافة المطبقة ورسوم التوصيل ورسوم معالجة الدفع. لن تتم إضافة أي رسوم إضافية.'
            : 'The final price includes applicable VAT, delivery charges, and payment-processing fees. No additional charges will be added.'}</p>
        </div>

        <div class="form-group checkout-agree">
          <input type="checkbox" id="delivery-agree" style="width:auto" required>
          <label for="delivery-agree">
            ${t('agreeDelivery')} <span class="req-star">*</span>
          </label>
        </div>

        <h3>${ar ? 'طريقة الدفع' : 'Payment Method'}</h3>

        <div class="payment-method-tabs">
          ${cardFeatureEnabled ? `
            <button type="button" id="payment-method-card" class="payment-method-tab hidden">
              ${ar ? 'بطاقة ائتمان أو خصم' : 'Credit or Debit Card'}
            </button>
          ` : ''}
          <button type="button" id="payment-method-paypal" class="payment-method-tab active">
            PayPal
          </button>
        </div>

        ${cardFeatureEnabled ? `
          <div id="card-payment-loading" class="card payment-method-panel">
            <div class="muted">${ar ? 'جارٍ التحقق من توفر الدفع بالبطاقة…' : 'Checking card payment availability…'}</div>
          </div>

          <div id="card-payment-panel" class="card payment-method-panel hidden">
            <div class="card-payment-intro">
              <strong>${ar ? 'الدفع بالبطاقة' : 'Pay by card'}</strong>
              <p class="muted">${ar
                ? 'أدخل بيانات بطاقتك بأمان. تتم معالجة بيانات البطاقة مباشرة بواسطة PayPal ولا يتم تخزين رقم البطاقة الكامل في UAEGamer.'
                : 'Enter your card details securely. Card details are handled directly by PayPal and UAEGamer never stores your full card number.'}</p>
            </div>

            <div class="paypal-card-grid">
              <div class="form-group card-field-full">
                <label>${ar ? 'الاسم على البطاقة' : 'Name on card'}</label>
                <div id="paypal-card-name" class="paypal-card-field"></div>
              </div>
              <div class="form-group card-field-full">
                <label>${ar ? 'رقم البطاقة' : 'Card number'}</label>
                <div id="paypal-card-number" class="paypal-card-field"></div>
              </div>
              <div class="form-group">
                <label>${ar ? 'تاريخ الانتهاء' : 'Expiry date'}</label>
                <div id="paypal-card-expiry" class="paypal-card-field"></div>
              </div>
              <div class="form-group">
                <label>CVV</label>
                <div id="paypal-card-cvv" class="paypal-card-field"></div>
              </div>
            </div>

            <div id="card-payment-message" class="muted" aria-live="polite"></div>

            <button type="button" id="card-pay-btn" class="btn primary" disabled>
              ${ar ? `ادفع ${itemTotal.toFixed(2)} USD` : `Pay ${itemTotal.toFixed(2)} USD`}
            </button>
          </div>
        ` : ''}

        <div id="paypal-payment-panel" class="card payment-method-panel">
          <p>${ar
            ? 'سيتم تحويلك إلى PayPal لإكمال الدفع.'
            : 'You will be redirected to PayPal to complete payment.'}</p>
          <button id="automatic-paypal-btn" type="button" class="btn primary">
            ${ar ? 'المتابعة إلى PayPal' : 'Continue to PayPal'}
          </button>
        </div>

        ${allowManualFallback ? `
          <button id="manual-paypal-fallback" type="button" class="btn secondary" style="margin-top:8px">
            ${ar ? 'استخدام التحقق اليدوي بدلاً من ذلك' : 'Use Manual Verification Instead'}
          </button>
        ` : ''}
      </form>
    `);

    const form = document.getElementById('checkout-form');
    form.onsubmit = event => event.preventDefault();

    const validateCommonFields = () => {
      const required = form.querySelectorAll('[required]');
      for (const field of required) {
        if (field.id === 'delivery-agree') continue;
        if (typeof field.reportValidity === 'function' && !field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }

      if (!document.getElementById('delivery-agree')?.checked) {
        Store.alert(
          ar ? 'يجب الموافقة على سياسة التوصيل أولاً.' : 'You must agree to the Delivery Policy first.',
          'err'
        );
        return false;
      }
      return true;
    };

    const selectMethod = method => {
      this.checkoutPaymentMethodTouched = true;
      document.getElementById('payment-method-card')?.classList.toggle('active', method === 'card');
      document.getElementById('payment-method-paypal')?.classList.toggle('active', method === 'paypal');
      document.getElementById('card-payment-panel')?.classList.toggle('hidden', method !== 'card');
      document.getElementById('paypal-payment-panel')?.classList.toggle('hidden', method !== 'paypal');
    };

    document.getElementById('payment-method-card')?.addEventListener('click', () => selectMethod('card'));
    document.getElementById('payment-method-paypal')?.addEventListener('click', () => selectMethod('paypal'));

    document.getElementById('back-cart').onclick = async () => {
      this.forceManualCheckout = false;
      await this.cancelCardCheckoutAttempt();
      Store.go('cart');
    };

    document.getElementById('manual-paypal-fallback')?.addEventListener('click', async () => {
      await this.cancelCardCheckoutAttempt();
      this.forceManualCheckout = true;
      this.renderCheckout();
    });

    document.getElementById('automatic-paypal-btn').addEventListener('click', async () => {
      if (!validateCommonFields()) return;
      await this.cancelCardCheckoutAttempt();
      await this.submitAutomaticOrder(rows);
    });

    if (cardFeatureEnabled) {
      this.recoverCardCheckoutAttempt().then(recovered => {
        if (!recovered) {
          this.initializeCardFields(rows, itemTotal, selectMethod, validateCommonFields);
        }
      });
    }
  },

  getCardCheckoutAttempt() {
    try {
      return JSON.parse(sessionStorage.getItem(this.cardCheckoutKey) || 'null');
    } catch {
      return null;
    }
  },

  saveCardCheckoutAttempt(attempt) {
    try {
      sessionStorage.setItem(this.cardCheckoutKey, JSON.stringify(attempt));
    } catch (_) {}
  },

  clearCardCheckoutAttempt() {
    try { sessionStorage.removeItem(this.cardCheckoutKey); } catch (_) {}
  },

  async cancelCardCheckoutAttempt() {
    const attempt = this.getCardCheckoutAttempt();
    if (!attempt?.orderId) return;

    try {
      await db.rpc('cancel_automatic_order_by_id', { p_order_id: attempt.orderId });
    } catch (error) {
      console.warn('Unable to cancel pending card checkout attempt:', error);
    } finally {
      this.clearCardCheckoutAttempt();
    }
  },

  async recoverCardCheckoutAttempt() {
    const attempt = this.getCardCheckoutAttempt();
    if (!attempt?.orderId) return false;

    try {
      const { data:order, error } = await db
        .from('orders')
        .select('id,order_number,payment_status,status')
        .eq('id', attempt.orderId)
        .maybeSingle();

      if (error || !order) {
        this.clearCardCheckoutAttempt();
        return false;
      }

      if (order.payment_status === 'paid') {
        this.clearCardCheckoutAttempt();
        this.clear();
        await Products.load();
        Store.alert(
          Store.state.lang === 'ar'
            ? `تم الدفع بنجاح. الطلب رقم ${order.order_number} قيد المعالجة.`
            : `Payment successful. Order #${order.order_number} is now being processed.`
        );
        Store.go(`receipt/${order.id}`);
        return true;
      }

      if (['cancelled','rejected'].includes(order.status) || ['failed','refunded','reversed'].includes(order.payment_status)) {
        this.clearCardCheckoutAttempt();
      }
    } catch (error) {
      console.warn('Card checkout recovery check failed:', error);
    }

    return false;
  },

  async loadPayPalCardSdk(environment) {
    const expectedSrc = environment === 'live'
      ? 'https://www.paypal.com/web-sdk/v6/core'
      : 'https://www.sandbox.paypal.com/web-sdk/v6/core';

    if (window.paypal?.createInstance && this.cardSdkEnvironment === environment) return;

    const existing = document.getElementById('paypal-web-sdk-v6');
    if (existing && existing.dataset.environment !== environment) {
      existing.remove();
      try { delete window.paypal; } catch (_) { window.paypal = undefined; }
    }

    if (window.paypal?.createInstance) {
      this.cardSdkEnvironment = environment;
      return;
    }

    await new Promise((resolve,reject) => {
      let script = document.getElementById('paypal-web-sdk-v6');
      if (script) {
        script.addEventListener('load', resolve, {once:true});
        script.addEventListener('error', () => reject(new Error('Unable to load secure card payment fields.')), {once:true});
        return;
      }

      script = document.createElement('script');
      script.id = 'paypal-web-sdk-v6';
      script.async = true;
      script.src = expectedSrc;
      script.dataset.environment = environment;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load secure card payment fields.'));
      document.head.appendChild(script);
    });

    if (!window.paypal?.createInstance) {
      throw new Error('Card payment service did not initialize.');
    }

    this.cardSdkEnvironment = environment;
  },

  async initializeCardFields(rows, itemTotal, selectMethod, validateCommonFields) {
    const ar = Store.state.lang === 'ar';
    const loading = document.getElementById('card-payment-loading');
    const panel = document.getElementById('card-payment-panel');
    const cardTab = document.getElementById('payment-method-card');
    const payButton = document.getElementById('card-pay-btn');
    const message = document.getElementById('card-payment-message');

    try {
      const { data:tokenData, error:tokenError } = await db.functions.invoke('paypal-card-client-token', {
        body:{}
      });

      if (tokenError) throw tokenError;
      if (tokenData?.error || !tokenData?.accessToken) {
        throw new Error(tokenData?.error || 'Unable to initialize card payments.');
      }

      await this.loadPayPalCardSdk(tokenData.environment);

      const sdk = await window.paypal.createInstance({
        clientToken: tokenData.accessToken,
        components:['card-fields'],
        pageType:'checkout',
      });

      const methods = await sdk.findEligibleMethods({
        currencyCode:'USD',
        amount:Number(itemTotal || 0).toFixed(2),
      });

      if (!methods?.isEligible?.('advanced_cards')) {
        throw new Error('Direct card payments are not available for this checkout.');
      }

      const session = sdk.createCardFieldsOneTimePaymentSession();
      this.cardPaymentSession = session;

      const fieldStyle = {
        input: {
          fontSize:'16px',
          lineHeight:'24px',
          color:'#111827',
        },
        '.invalid': {
          color:'#b91c1c',
        },
        ':focus': {
          color:'#111827',
        },
      };

      const fields = [
        ['paypal-card-name','name', ar ? 'الاسم على البطاقة' : 'Name on card'],
        ['paypal-card-number','number', ar ? 'رقم البطاقة' : 'Card number'],
        ['paypal-card-expiry','expiry','MM/YY'],
        ['paypal-card-cvv','cvv','CVV'],
      ];

      for (const [id,type,placeholder] of fields) {
        const host = document.getElementById(id);
        if (!host) throw new Error('Card field container is unavailable.');
        host.replaceChildren(
          session.createCardFieldsComponent({type,placeholder,style:fieldStyle})
        );
      }

      loading?.classList.add('hidden');
      cardTab?.classList.remove('hidden');
      payButton.disabled = false;

      if (!this.checkoutPaymentMethodTouched) {
        selectMethod('card');
        this.checkoutPaymentMethodTouched = false;
      }

      payButton.onclick = async () => {
        if (!validateCommonFields()) return;
        await this.submitCardOrder(rows);
      };
    } catch (error) {
      console.warn('Direct card payment unavailable:', error);
      this.cardPaymentSession = null;
      loading?.classList.add('hidden');
      panel?.classList.add('hidden');
      cardTab?.classList.add('hidden');
      document.getElementById('payment-method-paypal')?.classList.add('active');
      document.getElementById('paypal-payment-panel')?.classList.remove('hidden');

      if (message) message.textContent = '';
    }
  },

  async submitCardOrder(rows) {
    const ar = Store.state.lang === 'ar';
    const form = document.getElementById('checkout-form');
    const button = document.getElementById('card-pay-btn');
    const message = document.getElementById('card-payment-message');

    if (!form || !button || !this.cardPaymentSession) return;

    const fd = new FormData(form);
    const items = rows.map(([product,quantity]) => ({
      product_id:product.id,
      quantity
    }));

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = ar ? 'جارٍ تجهيز الدفع…' : 'Preparing payment…';
    if (message) message.textContent = '';

    let attempt = this.getCardCheckoutAttempt();
    let createdLocalOrderId = null;

    try {
      if (!attempt?.orderId || !attempt?.paypalOrderId) {
        const { data:orderData, error:orderError } = await db.rpc('create_order_automatic', {
          p_items:items,
          p_first_name:String(fd.get('first_name')||'').trim(),
          p_last_name:String(fd.get('last_name')||'').trim(),
          p_email:String(fd.get('email')||'').trim(),
          p_mobile_number:String(fd.get('mobile_number')||'').trim(),
          p_delivery_address:String(fd.get('delivery_address')||'').trim(),
          p_customer_notes:String(fd.get('customer_notes')||'').trim() || null
        });

        if (orderError) throw orderError;
        createdLocalOrderId = orderData?.order_id || null;

        const { data:paypal, error:paypalError } = await db.functions.invoke('paypal-create-order', {
          body:{
            action:'create_card',
            order_id:orderData?.order_id
          }
        });

        if (paypalError) throw paypalError;
        if (paypal?.error) throw new Error(paypal.error);
        if (!paypal?.paypal_order_id) throw new Error('Card payment order could not be created.');

        attempt = {
          orderId:String(orderData?.order_id || ''),
          orderNumber:orderData?.order_number,
          paypalOrderId:String(paypal.paypal_order_id),
          environment:paypal.environment,
        };
        this.saveCardCheckoutAttempt(attempt);
      }

      button.textContent = ar ? 'جارٍ التحقق من البطاقة…' : 'Verifying card…';

      const result = await this.cardPaymentSession.submit(attempt.paypalOrderId);

      if (result?.state === 'canceled') {
        if (message) {
          message.textContent = ar
            ? 'تم إلغاء التحقق. يمكنك المحاولة مرة أخرى.'
            : 'Card authentication was cancelled. You can try again.';
        }
        return;
      }

      if (result?.state === 'failed') {
        console.warn('Card submission failed:', result?.data);
        if (message) {
          message.textContent = ar
            ? 'تعذر إكمال الدفع بالبطاقة. تحقق من البيانات أو جرّب بطاقة أخرى.'
            : 'Card payment could not be completed. Check your details or try another card.';
        }
        return;
      }

      if (result?.state !== 'succeeded' || !result?.data?.orderId) {
        console.warn('Unexpected card submission state:', result);
        if (message) {
          message.textContent = ar
            ? 'تعذر إكمال الدفع. يرجى المحاولة مرة أخرى.'
            : 'Unable to complete the card payment. Please try again.';
        }
        return;
      }

      if (String(result.data.orderId) !== String(attempt.paypalOrderId)) {
        throw new Error('Card payment order mismatch.');
      }

      button.textContent = ar ? 'جارٍ إكمال الدفع…' : 'Completing payment…';

      const { data:capture, error:captureError } = await db.functions.invoke('paypal-capture-order', {
        body:{
          action:'capture_order',
          paypal_order_id:attempt.paypalOrderId
        }
      });

      if (captureError) throw captureError;
      if (capture?.error) throw new Error(capture.error);
      if (!capture?.success) throw new Error('Payment capture did not complete.');

      this.clearCardCheckoutAttempt();
      this.clear();
      await Products.load();

      Store.alert(
        ar
          ? `تم الدفع بنجاح. الطلب رقم ${capture?.order_number || attempt.orderNumber || ''} قيد المعالجة.`
          : `Payment successful. Order #${capture?.order_number || attempt.orderNumber || ''} is now being processed.`
      );
      Store.go(`receipt/${capture?.order_id || attempt.orderId}`);
    } catch (error) {
      console.error('Card checkout failed:', error);

      let backendMessage = '';
      try {
        if (error?.context?.json) {
          const body = await error.context.json();
          backendMessage = body?.error || '';
        }
      } catch (_) {}

      const text = String(backendMessage || error?.message || '');
      const authFailure =
        text.includes('3D Secure') ||
        text.includes('CARD_AUTHENTICATION_NOT_ACCEPTED') ||
        text.toLowerCase().includes('authentication');

      if (!attempt?.orderId && createdLocalOrderId) {
        try {
          await db.rpc('cancel_automatic_order_by_id', { p_order_id:createdLocalOrderId });
        } catch (_) {}
      }

      if (authFailure && attempt?.orderId) {
        await this.cancelCardCheckoutAttempt();
        attempt = null;
      }

      if (message) {
        message.textContent = authFailure
          ? (ar
              ? 'تعذر التحقق من البطاقة بأمان. جرّب مرة أخرى أو استخدم بطاقة أخرى أو PayPal.'
              : 'We could not securely verify this card. Try again, use another card, or choose PayPal.')
          : (ar
              ? 'تعذر إكمال الدفع. تحقق من طلباتك قبل إعادة المحاولة لتجنب الدفع مرتين.'
              : 'Payment could not be completed. Check My Orders before trying again to avoid paying twice.');
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  },

  async submitAutomaticOrder(rows) {
    const ar = Store.state.lang === 'ar';
    const form = document.getElementById('checkout-form');
    const button = document.getElementById('automatic-paypal-btn');
    if (!form || !button) return;

    const fd = new FormData(form);
    const items = rows.map(([product,quantity]) => ({
      product_id: product.id,
      quantity
    }));

    Store.setBusy(button, true, ar ? 'جارٍ إنشاء الطلب…' : 'Creating order…');

    let createdOrder = null;

    try {
      const { data, error } = await db.rpc('create_order_automatic', {
        p_items: items,
        p_first_name: String(fd.get('first_name')||'').trim(),
        p_last_name: String(fd.get('last_name')||'').trim(),
        p_email: String(fd.get('email')||'').trim(),
        p_mobile_number: String(fd.get('mobile_number')||'').trim(),
        p_delivery_address: String(fd.get('delivery_address')||'').trim(),
        p_customer_notes: String(fd.get('customer_notes')||'').trim() || null
      });

      if (error) throw error;
      createdOrder = data;

      const { data: paypal, error: paypalError } = await db.functions.invoke('paypal-create-order', {
        body: {
          action:'create',
          order_id:data?.order_id
        }
      });

      if (paypalError) throw paypalError;
      if (paypal?.error) throw new Error(paypal.error);
      if (!paypal?.approve_url) throw new Error('PayPal did not return an approval URL.');

      try {
        sessionStorage.setItem('paypal_checkout_order_id', String(data?.order_id || ''));
        sessionStorage.setItem('paypal_checkout_paypal_order_id', String(paypal?.paypal_order_id || ''));
      } catch (_) {}

      location.href = paypal.approve_url;
    } catch (error) {
      console.error(error);

      if (createdOrder?.order_id) {
        try {
          await db.rpc('cancel_automatic_order_by_id', {
            p_order_id: createdOrder.order_id
          });
        } catch (_) {}
      }

      Store.alert(
        ar
          ? 'تعذر بدء الدفع عبر PayPal. يرجى المحاولة مرة أخرى، أو التواصل معنا إذا استمرت المشكلة.'
          : 'Unable to start PayPal checkout. Please try again, or contact us if the problem continues.',
        'err'
      );
      Store.setBusy(button, false);
    }
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