window.Store = {
  state: {
    lang: localStorage.getItem('sf_lang') || 'en',
    theme: localStorage.getItem('sf_theme') || 'light',
    user: null,
    profile: null,
    settings: {},
    products: [],
    categories: [],
    types: [],
    textbar: [],
    notifications: []
  },

  esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  },

  escAttr(value) {
    return String(value ?? '').replace(/["&<>]/g, m => ({
      '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'
    }[m]));
  },

  view(html) {
    const view = document.getElementById('view');
    if (view) view.innerHTML = html;
  },

  alert(message, type = 'ok') {
    const host = document.getElementById('toast-host');
    if (!host) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 2800);
  },

  clearAlert() {
    document.getElementById('alert-host')?.replaceChildren();
  },

  modal(html) {
    const body = document.getElementById('modal-body');
    const modal = document.getElementById('modal');
    if (!body || !modal) return;
    body.innerHTML = html;
    modal.classList.remove('hidden');
  },

  applyBasicUI() {
    document.documentElement.lang = this.state.lang;
    document.documentElement.dir = this.state.lang === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('dark', this.state.theme === 'dark');

    document.querySelectorAll('[data-lang]').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === this.state.lang);
    });

    document.querySelectorAll('[data-theme]').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === this.state.theme);
    });

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
  },

  wireStaticControls() {
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.state.lang = btn.dataset.lang;
        localStorage.setItem('sf_lang', this.state.lang);
        this.applyBasicUI();
        this.applySettings();
        this.renderNav();
        await this.footer();
        await this.route();
      });
    });

    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.theme = btn.dataset.theme;
        localStorage.setItem('sf_theme', this.state.theme);
        this.applyBasicUI();
        this.applySettings();
      });
    });

    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('modal')?.classList.add('hidden');
    });

    document.getElementById('modal')?.addEventListener('click', event => {
      if (event.target.id === 'modal') {
        event.currentTarget.classList.add('hidden');
      }
    });

    document.getElementById('notify-btn')?.addEventListener('click', async () => {
      const panel = document.getElementById('notify-panel');
      panel?.classList.toggle('hidden');
      if (panel && !panel.classList.contains('hidden')) await this.markNotificationsRead();
    });

    document.getElementById('notify-close')?.addEventListener('click', () => {
      document.getElementById('notify-panel')?.classList.add('hidden');
    });

    window.addEventListener('hashchange', () => this.route());
  },

  async loadSettings() {
    try {
      const { data, error } = await db
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      this.state.settings = data || {};
      return true;
    } catch (e) {
      console.error('Site settings load failed:', e);
      this.state.settings = {};
      this.alert('StoreFront loaded, but site settings could not be read: ' + (e.message || e), 'err');
      return false;
    }
  },

  applySettings() {
    this.applyBasicUI();

    const s = this.state.settings || {};
    document.documentElement.style.setProperty('--primary', s.theme_color || '#0066cc');

    const name = localize(s, 'site_name') || 'StoreFront';
    const description = localize(s, 'site_description') || '';

    const title = document.getElementById('site-title');
    const subtitle = document.getElementById('site-subtitle');
    const footerName = document.getElementById('footer-name');

    if (title) title.textContent = name;
    if (subtitle) subtitle.textContent = description;
    if (footerName) footerName.textContent = name;
    document.title = name;

    const social = [];
    if (s.show_social_icons && s.instagram_url) {
      social.push(`<a class="btn" target="_blank" rel="noopener" href="${this.escAttr(s.instagram_url)}">Instagram</a>`);
    }
    if (s.show_social_icons && s.whatsapp_url) {
      social.push(`<a class="btn" target="_blank" rel="noopener" href="${this.escAttr(s.whatsapp_url)}">WhatsApp</a>`);
    }

    const socialHost = document.getElementById('social-links');
    if (socialHost) socialHost.innerHTML = social.join(' ');
    this.renderPublicStats().catch(console.error);
  },

  renderNav() {
    const profile = this.state.profile;
    const user = this.state.user;
    const current = (location.hash || '#home').slice(1);
    const navCurrent = current === 'checkout' ? 'cart' : current;

    const links = [['home', t('home')], ['contact', this.state.lang === 'ar' ? 'اتصل بنا' : 'Contact']];

    if (user) {
      links.push(
        ['cart', `${t('cart')} (${Cart.count()})`],
        ['orders', t('orders')],
        ['account', `${t('account')} (${this.esc(profile?.username || user.email || '')})`]
      );

      if (profile?.role === 'admin') {
        links.push(['admin', t('admin')]);
      }

      links.push(['logout', t('logout')]);
    } else {
      links.push(['login', t('login')], ['register', t('register')]);
    }

    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.innerHTML = links.map(([route, label]) => `
      <a href="#${route}" data-route="${route}" class="btn ${navCurrent === route ? 'active' : ''}">
        ${label}
      </a>
    `).join('');

    nav.querySelectorAll('[data-route]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        this.go(link.dataset.route);
      });
    });
  },

  async go(route) {
    if (route === 'logout') {
      try {
        await Auth.logout();
      } catch (e) {
        console.error(e);
      }
      await this.refreshShell();
      location.hash = 'home';
      return;
    }

    location.hash = route;
    await this.route();
  },

  visitorId() {
    let id = localStorage.getItem('storefront_visitor_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('storefront_visitor_id', id); }
    return id;
  },

  async trackView() {
    const route = (location.hash || '#home').slice(1);
    if (route === 'admin' || route.startsWith('receipt/')) return;
    const { error } = await db.rpc('track_page_view', { p_visitor_id: this.visitorId(), p_path: route || 'home' });
    if (error) console.error('Analytics tracking failed:', error);
  },

  async renderPublicStats() {
    const s = this.state.settings || {};
    let host = document.getElementById('public-stats');
    if (!s.show_stats) { host?.remove(); return; }
    if (!host) {
      host = document.createElement('div'); host.id='public-stats'; host.className='stats-bar public-stats';
      const footer=document.querySelector('footer.footer'); footer?.insertBefore(host,footer.querySelector('p'));
    }
    const { data, error } = await db.rpc('public_store_stats');
    if (error) { console.error(error); host.innerHTML=''; return; }
    host.innerHTML = `<span class="stat-pill">Page Views: ${Number(data?.page_views||0).toLocaleString()}</span><span class="stat-pill">Unique Visitors: ${Number(data?.unique_visitors||0).toLocaleString()}</span><span class="stat-pill">Registered Members: ${Number(data?.registered_users||0).toLocaleString()}</span><span class="stat-pill">Users Online: ${Number(data?.online_users||0).toLocaleString()}</span>`;
  },

  async refreshShell() {
    try {
      await Auth.refresh();
    } catch (e) {
      console.error('Auth refresh failed:', e);
      this.state.user = null;
      this.state.profile = null;
    }

    this.renderNav();

    try {
      await this.notifications();
    } catch (e) {
      console.error('Notifications failed:', e);
    }
  },

  async notifications() {
    const button = document.getElementById('notify-btn');
    const badge = document.getElementById('notify-badge');
    const list = document.getElementById('notify-list');

    if (!button || !badge || !list) return;

    if (!this.state.user) {
      button.classList.add('hidden');
      badge.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    button.classList.remove('hidden');

    let query = db
      .from('notifications')
      .select('*')
      .eq('user_id', this.state.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      list.innerHTML = `<div class="notify-item muted">Notifications unavailable.</div>`;
      badge.classList.add('hidden');
      return;
    }

    this.state.notifications = data || [];

    // Support either is_read or read_at schema styles.
    const unread = this.state.notifications.filter(n => !n.read_at).length;

    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);

    list.innerHTML = this.state.notifications.length
      ? this.state.notifications.map(n => `
          <div class="notify-item">
            <strong>${this.esc(localize(n, 'title'))}</strong>
            <div>${this.esc(localize(n, 'message'))}</div>
            <small class="muted">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</small>
          </div>
        `).join('')
      : `<div class="notify-item muted">No notifications yet.</div>`;
  },

  async markNotificationsRead() {
    if (!this.state.user) return;
    const ids = (this.state.notifications || []).filter(n => !n.read_at).map(n => n.id);
    if (!ids.length) return;
    const { error } = await db.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', this.state.user.id);
    if (!error) await this.notifications();
    else console.error(error);
  },

  async route() {
    const route = (location.hash || '#home').slice(1);
    this.renderNav();
    this.trackView().catch(console.error);

    if (route === 'home') return Products.renderHome();
    if (route === 'cart') return Cart.render();
    if (route === 'checkout') return Cart.renderCheckout();
    if (route === 'login') return this.loginView();
    if (route === 'register') return this.registerView();
    if (route === 'account') return this.accountView();
    if (route === 'orders') return this.ordersView();
    if (route.startsWith('receipt/')) return this.receiptView(route.split('/')[1]);
    if (route === 'contact') return this.contactView();
    if (route === 'admin') return Admin.render();

    return Products.renderHome();
  },

  loginView() {
    if (this.state.user) {
      this.go('account');
      return;
    }

    this.view(`
      <form id="login-form" class="panel">
        <h2>${t('login')}</h2>

        <div class="form-group">
          <label>Email</label>
          <input name="email" type="email" required autocomplete="email">
        </div>

        <div class="form-group">
          <label>Password</label>
          <input name="password" type="password" required autocomplete="current-password">
        </div>

        <button class="btn primary">${t('login')}</button>
      </form>
    `);

    document.getElementById('login-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const f = new FormData(event.currentTarget);

      try {
        await Auth.login(f.get('email'), f.get('password'));
        await this.refreshShell();
        this.clearAlert();
        location.hash = 'home';
        await this.route();
      } catch (e) {
        this.alert(e.message || String(e), 'err');
      }
    });
  },

  registerView() {
    if (this.state.user) {
      this.go('account');
      return;
    }

    this.view(`
      <form id="reg-form" class="panel">
        <h2>${t('register')}</h2>

        <div class="bilingual">
          <div class="form-group">
            <label>Username</label>
            <input name="username" required>
          </div>

          <div class="form-group">
            <label>Email</label>
            <input name="email" type="email" required autocomplete="email">
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>First Name</label>
            <input name="first_name">
          </div>

          <div class="form-group">
            <label>Last Name</label>
            <input name="last_name">
          </div>
        </div>

        <div class="form-group">
          <label>Password</label>
          <input name="password" type="password" minlength="8" required autocomplete="new-password">
        </div>

        <button class="btn primary">${t('register')}</button>
      </form>
    `);

    document.getElementById('reg-form')?.addEventListener('submit', async event => {
      event.preventDefault();

      try {
        await Auth.register(new FormData(event.currentTarget));
        this.alert('Registration submitted. Check your email if confirmation is enabled.');
        location.hash = 'login';
        await this.route();
      } catch (e) {
        this.alert(e.message || String(e), 'err');
      }
    });
  },

  accountView() {
    if (!this.state.user) {
      this.go('login');
      return;
    }

    const p = this.state.profile || {};

    this.view(`
      <form id="account-form" class="panel">
        <h2>${t('account')}</h2>

        <div class="bilingual">
          <div class="form-group">
            <label>Username</label>
            <input name="username" value="${this.escAttr(p.username || '')}" required>
          </div>

          <div class="form-group">
            <label>Email</label>
            <input value="${this.escAttr(this.state.user.email || '')}" disabled>
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>First Name</label>
            <input name="first_name" value="${this.escAttr(p.first_name || '')}">
          </div>

          <div class="form-group">
            <label>Last Name</label>
            <input name="last_name" value="${this.escAttr(p.last_name || '')}">
          </div>
        </div>

        <div class="form-group">
          <label>Mobile Number</label>
          <input name="mobile_number" value="${this.escAttr(p.mobile_number || '')}">
        </div>

        <div class="form-group">
          <label>Delivery Address</label>
          <textarea name="delivery_address">${this.esc(p.delivery_address || '')}</textarea>
        </div>

        <div class="form-group">
          <label>New Password (leave blank to keep existing)</label>
          <input name="new_password" type="password" autocomplete="new-password">
        </div>

        <button class="btn primary">Save Changes</button>
      </form>
    `);

    document.getElementById('account-form')?.addEventListener('submit', async event => {
      event.preventDefault();

      try {
        await Auth.updateProfile(new FormData(event.currentTarget));
        this.alert('Account updated.');
        this.renderNav();
      } catch (e) {
        this.alert(e.message || String(e), 'err');
      }
    });
  },

  async ordersView() {
    if (!this.state.user) return this.go('login');

    const { data, error } = await db
      .from('orders')
      .select('*,order_items(*)')
      .eq('user_id', this.state.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      this.view(`<div class="alert err">Unable to load orders: ${this.esc(error.message)}</div>`);
      return;
    }

    const receiptStatuses = new Set(['processing','confirmed','shipped','delivered']);

    this.view(`
      <h2>${t('orders')} (${(data || []).length})</h2>
      ${(data || []).map(o => `
        <div class="card">
          <div class="order-summary-head">
            <div>
              <strong>Order #${this.esc(o.order_number)}</strong><br>
              <span class="muted">${o.created_at ? new Date(o.created_at).toLocaleString() : ''}</span>
            </div>
            <div>${this.statusBadge(o.status)}</div>
          </div>
          <div><strong>Total:</strong> ${Number(o.total_usd || 0).toFixed(2)} USD</div>
          <ul>
            ${(o.order_items || []).map(i => `
              <li>${this.esc(i.product_title)} × ${Number(i.quantity || 0)}
              <br><small>PayPal Transaction ID: ${this.esc(i.paypal_transaction_id || 'N/A')}</small></li>
            `).join('')}
          </ul>
          ${receiptStatuses.has(o.status)
            ? `<button class="btn secondary receipt-btn" data-id="${o.id}">Print / View Receipt</button>`
            : `<span class="muted">Receipt available after payment/order verification.</span>`}
        </div>
      `).join('') || `<div class="card">You have not placed any orders yet.</div>`}
    `);

    document.querySelectorAll('.receipt-btn').forEach(btn => {
      btn.onclick = () => this.go(`receipt/${btn.dataset.id}`);
    });
  },

  statusBadge(status) {
    const map = {
      pending: ['Pending Verification','status-pending'],
      processing: ['Processing','status-processing'],
      confirmed: ['Verified / Confirmed','status-confirmed'],
      shipped: ['Shipped for Delivery','status-shipped'],
      delivered: ['Delivered / Completed','status-delivered'],
      cancelled: ['Cancelled','status-cancelled'],
      rejected: ['Unverified / Rejected','status-rejected']
    };
    const pair = map[status] || [status || 'Unknown',''];
    return `<span class="order-status-badge ${pair[1]}">${this.esc(pair[0])}</span>`;
  },

  async receiptView(orderId) {
    if (!this.state.user) return this.go('login');

    const { data: order, error } = await db
      .from('orders')
      .select('*,order_items(*)')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      this.view('<div class="alert err">Receipt/order not found.</div>');
      return;
    }

    const allowed = ['processing','confirmed','shipped','delivered'].includes(order.status)
      || this.state.profile?.role === 'admin';

    if (!allowed) {
      this.view(`<div class="alert err">Payment receipt is unavailable because the order is not verified yet.</div>
      <button id="receipt-back" class="btn">Back to Orders</button>`);
      document.getElementById('receipt-back').onclick = () => this.go('orders');
      return;
    }

    const items = order.order_items || [];
    this.view(`
      <div class="receipt-box">
        <div class="receipt-header">
          <h2>${this.esc(localize(this.state.settings,'site_name') || 'StoreFront')}</h2>
          <strong>OFFICIAL PAYMENT RECEIPT</strong>
        </div>
        <div class="receipt-meta">
          <div><strong>Order #:</strong> ${this.esc(order.order_number)}<br>
          <strong>Date & Time:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : ''}<br>
          <strong>Order Status:</strong> ${this.statusBadge(order.status)}</div>
          <div><strong>Customer Name:</strong> ${this.esc((order.first_name||'')+' '+(order.last_name||''))}<br>
          <strong>Email:</strong> ${this.esc(order.email||'')}<br>
          <strong>Mobile:</strong> ${this.esc(order.mobile_number||'')}<br>
          <strong>Delivery Address:</strong> ${this.esc(order.delivery_address||'')}</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Item Title</th><th>Unit Price</th><th>Quantity</th><th>Subtotal</th><th>PayPal Transaction ID</th></tr></thead>
          <tbody>${items.map(i => `
            <tr><td>${this.esc(i.product_title||'')}</td>
            <td>${Number(i.unit_price_usd||0).toFixed(2)} USD</td>
            <td>${Number(i.quantity||0)}</td>
            <td>${(Number(i.unit_price_usd||0)*Number(i.quantity||0)).toFixed(2)} USD</td>
            <td>${this.esc(i.paypal_transaction_id||'N/A')}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="receipt-totals">
          <div>Delivery fee: ${Number(order.delivery_fee_usd||0).toFixed(2)} USD</div>
          <div>Payment gateway fee: ${Number(order.payment_gateway_fee_usd||0).toFixed(2)} USD</div>
          <div>VAT: ${Number(order.vat_usd||0).toFixed(2)} USD</div>
          <div class="receipt-grand-total">Total: ${Number(order.total_usd||0).toFixed(2)} USD</div>
        </div>
      </div>
      <div class="receipt-actions">
        <button id="print-receipt" class="btn secondary">Print Receipt</button>
        <button id="receipt-back" class="btn">Back to Orders</button>
      </div>
    `);

    document.getElementById('print-receipt').onclick = () => window.print();
    document.getElementById('receipt-back').onclick = () => this.go('orders');
  },

  contactView() {
    if (!this.state.user) {
      this.view(`<div class="card"><h2>${this.state.lang === 'ar' ? 'اتصل بنا' : 'Contact Us'}</h2>
      <p>${this.state.lang === 'ar' ? 'يجب تسجيل الدخول لإرسال رسالة.' : 'Please log in to submit a contact message.'}</p>
      <button id="contact-login" class="btn primary">${t('login')}</button></div>`);
      document.getElementById('contact-login').onclick = () => this.go('login');
      return;
    }

    this.view(`
      <form id="contact-form" class="panel">
        <h2>${this.state.lang === 'ar' ? 'اتصل بنا' : 'Contact Us'}</h2>
        <div class="form-group"><label>Email Address</label>
          <input name="email" type="email" value="${this.escAttr(this.state.user.email||'')}" required></div>
        <div class="form-group"><label>Message Type</label>
          <select name="type" required>
            <option value="Order Related">Order Related</option>
            <option value="Complain">Complain</option>
            <option value="Feedback">Feedback</option>
            <option value="Question">Question</option>
          </select></div>
        <div class="form-group"><label>Your Message</label>
          <textarea name="message" rows="6" required></textarea></div>
        <button class="btn primary">Submit Message</button>
      </form>`);

    document.getElementById('contact-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const { error } = await db.from('messages').insert({
        user_id: this.state.user.id,
        email: String(fd.get('email')||'').trim(),
        type: String(fd.get('type')||'').trim(),
        message: String(fd.get('message')||'').trim()
      });
      if (error) return this.alert('Unable to send message: ' + error.message, 'err');
      event.currentTarget.reset();
      event.currentTarget.querySelector('[name="email"]').value = this.state.user.email || '';
      this.alert('Your message has been sent successfully.');
    };
  },

  async footer() {
    const host = document.getElementById('footer-links');
    if (!host) return;

    try {
      const { data, error } = await db.from('pages').select('*');
      if (error) throw error;

      const visible = (data || []).filter(p => p.enabled === undefined || p.enabled === true);

      host.innerHTML = visible.map(p => `
        <a href="#" class="btn footer-page" data-id="${this.escAttr(p.id)}">
          ${this.esc(localize(p, 'title'))}
        </a>
      `).join('');

      host.querySelectorAll('.footer-page').forEach(link => {
        link.addEventListener('click', event => {
          event.preventDefault();
          const page = visible.find(x => String(x.id) === String(link.dataset.id));
          if (!page) return;

          this.modal(`
            <h2>${this.esc(localize(page, 'title'))}</h2>
            <div>${page.content || ''}</div>
          `);
        });
      });
    } catch (e) {
      console.error('Footer pages unavailable:', e);
      host.innerHTML = '';
    }
  },

  async start() {
    // Critical fix: controls and navigation are wired BEFORE any Supabase query.
    document.getElementById('year').textContent = new Date().getFullYear();
    this.wireStaticControls();
    this.applyBasicUI();
    this.renderNav();

    // Always show something useful immediately.
    this.view(`<div class="card">Loading StoreFront...</div>`);

    // Each backend area is isolated. One failure no longer stops the whole site.
    await this.loadSettings();
    this.applySettings();

    try {
      await Auth.refresh();
    } catch (e) {
      console.error('Authentication initialization failed:', e);
    }

    this.renderNav();

    try {
      await Products.load();
    } catch (e) {
      console.error('Product data initialization failed:', e);
      this.alert('The site loaded, but product data could not be loaded: ' + (e.message || e), 'err');
    }

    try {
      await this.footer();
    } catch (e) {
      console.error(e);
    }

    try {
      await this.notifications();
    } catch (e) {
      console.error(e);
    }

    await this.route();

    db.auth.onAuthStateChange(() => {
      setTimeout(async () => {
        await this.refreshShell();
        await this.route();
      }, 0);
    });
  }
};

Store.start().catch(error => {
  console.error('Fatal StoreFront startup error:', error);
  Store.applyBasicUI();
  Store.renderNav();
  Store.view(`
    <div class="alert err">
      StoreFront encountered a startup error: ${Store.esc(error.message || error)}
    </div>
    <div class="card">
      The page controls remain available. Open your browser developer console for the full error.
    </div>
  `);
});