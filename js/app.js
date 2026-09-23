window.Store = {
  footerCache: { at: 0, pages: [], guides: [] },

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

  safeUrl(value, { image = false } = {}) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw, location.href);
      const protocol = url.protocol.toLowerCase();

      if (image && protocol === 'data:') {
        return /^data:image\/(?:png|jpe?g|gif|webp);/i.test(raw) ? raw : '';
      }

      if (['http:','https:'].includes(protocol)) return url.href;
      if (!image && ['mailto:','tel:'].includes(protocol)) return url.href;

      // Same-site relative links are allowed.
      if (url.origin === location.origin && ['http:','https:'].includes(protocol)) return url.href;
    } catch (_) {}

    return '';
  },

  sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');

    const allowed = new Set([
      'P','BR','STRONG','B','EM','I','U','S','H1','H2','H3','H4','H5','H6',
      'UL','OL','LI','BLOCKQUOTE','PRE','CODE','A','TABLE','THEAD','TBODY',
      'TFOOT','TR','TH','TD','DIV','SPAN','HR','IMG'
    ]);

    const elements = Array.from(template.content.querySelectorAll('*'));

    for (const el of elements) {
      if (!allowed.has(el.tagName)) {
        if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','SVG','MATH'].includes(el.tagName)) {
          el.remove();
        } else {
          el.replaceWith(...Array.from(el.childNodes));
        }
        continue;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();

        if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
          el.removeAttribute(attr.name);
          continue;
        }

        const common = ['class','title','dir','lang','colspan','rowspan'];
        const allowedForTag =
          common.includes(name) ||
          (el.tagName === 'A' && ['href','target','rel'].includes(name)) ||
          (el.tagName === 'IMG' && ['src','alt','width','height','loading'].includes(name));

        if (!allowedForTag && !name.startsWith('aria-')) {
          el.removeAttribute(attr.name);
        }
      }

      if (el.tagName === 'A') {
        const href = this.safeUrl(el.getAttribute('href') || '');
        if (!href) el.removeAttribute('href');
        else el.setAttribute('href', href);

        if (el.getAttribute('target') === '_blank') {
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (el.tagName === 'IMG') {
        const src = this.safeUrl(el.getAttribute('src') || '', { image: true });
        if (!src) el.remove();
        else {
          el.setAttribute('src', src);
          el.setAttribute('loading', 'lazy');
        }
      }
    }

    return template.innerHTML;
  },

  cssSize(value, fallback = '14px') {
    const v = String(value ?? '').trim();
    if (!v) return fallback;
    if (/^\d+(?:\.\d+)?$/.test(v)) return `${v}px`;
    return v;
  },

  async withTimeout(promise, ms = 12000, label = 'Request') {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  },

  setBusy(target, busy = true, label = 'Working…') {
    if (!target) return;
    if (busy) {
      if (!target.dataset.originalText) target.dataset.originalText = target.textContent || '';
      target.disabled = true;
      target.textContent = label;
    } else {
      target.disabled = false;
      if (target.dataset.originalText) {
        target.textContent = target.dataset.originalText;
        delete target.dataset.originalText;
      }
    }
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
    document.documentElement.dataset.theme = this.state.theme;

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
      try {
        localStorage.setItem('sf_cached_settings', JSON.stringify(this.state.settings));
      } catch (_) {}
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

    const brand = document.getElementById('brand');
    const title = document.getElementById('site-title');
    const subtitle = document.getElementById('site-subtitle');
    const footerName = document.getElementById('footer-name');

    document.documentElement.style.setProperty('--base-font-size', this.cssSize(s.font_size, '14px'));
    document.documentElement.style.setProperty(
      '--body-font',
      this.state.lang === 'ar'
        ? (s.font_family_ar || "'Noto Sans Arabic', sans-serif")
        : (s.font_family || "'Noto Sans', sans-serif")
    );
    document.documentElement.style.setProperty(
      '--header-font',
      this.state.lang === 'ar'
        ? (s.header_title_font_family_ar || "'Noto Sans Arabic', sans-serif")
        : (s.header_title_font_family || "'Montserrat', sans-serif")
    );

    if (brand) {
      const headerFont =
        this.state.lang === 'ar'
          ? (s.header_title_font_family_ar || "'Noto Sans Arabic', sans-serif")
          : (s.header_title_font_family || "'Montserrat', sans-serif");

      const safeLogoUrl = this.safeUrl(s.logo_url || '', { image: true });
      if (s.header_type === 'image' && safeLogoUrl) {
        brand.innerHTML = `
          <img class="site-logo" src="${this.escAttr(safeLogoUrl)}" alt="${this.escAttr(name)}">
        `;
      } else {
        brand.innerHTML = `<h1 id="site-title">${this.esc(name)}</h1>`;
        const h = brand.querySelector('h1');
        h.style.fontFamily = 'var(--header-font)';
        h.style.fontSize = this.cssSize(s.header_title_font_size, '2.5rem');

        if (s.header_type === 'gradient') {
          h.classList.add('gradient-title');
          h.style.setProperty('--g1', s.gradient_color_1 || '#ff007f');
          h.style.setProperty('--g2', s.gradient_color_2 || '#7f00ff');
          h.style.setProperty('--g3', s.gradient_color_3 || '#00e5ff');
          h.style.setProperty('--g4', s.gradient_color_4 || '#00ff7f');
          h.style.setProperty('--g5', s.gradient_color_5 || '#ffbe00');
        }
      }
    }

    if (subtitle) subtitle.textContent = description;
    if (footerName) footerName.textContent = name;
    document.title = name;

    FontLoader?.apply?.(s, this.state.lang);

    let favicon = document.querySelector('link[data-site-favicon]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.dataset.siteFavicon = '1';
      document.head.appendChild(favicon);
    }
    if (s.favicon_url) favicon.href = s.favicon_url;
    else favicon.removeAttribute('href');

    VantaBackground?.apply?.(s).catch(error => console.error('Vanta background failed:', error));

    const social = [];
    const instagramUrl = this.safeUrl(s.instagram_url || '');
    const whatsappUrl = this.safeUrl(s.whatsapp_url || '');
    const snapchatUrl = this.safeUrl(s.snapchat_url || '');
    const tiktokUrl = this.safeUrl(s.tiktok_url || '');
    if (s.show_social_icons && instagramUrl) {
      social.push(`<a class="btn" target="_blank" rel="noopener noreferrer" href="${this.escAttr(instagramUrl)}">Instagram</a>`);
    }
    if (s.show_social_icons && whatsappUrl) {
      social.push(`<a class="btn" target="_blank" rel="noopener noreferrer" href="${this.escAttr(whatsappUrl)}">WhatsApp</a>`);
    }
    if (s.show_social_icons && snapchatUrl) {
      social.push(`<a class="btn" target="_blank" rel="noopener noreferrer" href="${this.escAttr(snapchatUrl)}">Snapchat</a>`);
    }
    if (s.show_social_icons && tiktokUrl) {
      social.push(`<a class="btn" target="_blank" rel="noopener noreferrer" href="${this.escAttr(tiktokUrl)}">TikTok</a>`);
    }

    const socialHost = document.getElementById('social-links');
    if (socialHost) socialHost.innerHTML = social.join(' ');
    this.renderPublicStats().catch(console.error);
  },

  renderNav() {
    const profile = this.state.profile;
    const user = this.state.user;
    const current = (location.hash || '#home').slice(1);
    const navCurrent =
      current === 'checkout' ? 'cart' :
      current.startsWith('admin/') ? 'admin' :
      current.startsWith('receipt/') ? 'orders' :
      current;

    const links = [['home', t('home')]];

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
      location.hash = 'home';
      return;
    }

    const nextHash = `#${route}`;
    if (location.hash === nextHash) {
      await this.route();
    } else {
      location.hash = route;
    }
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
      const footerPanel=document.querySelector('.footer-panel');
      footerPanel?.appendChild(host);
    }
    const { data, error } = await db.rpc('public_store_stats');
    if (error) { console.error(error); host.innerHTML=''; return; }
    host.innerHTML = `<span class="stat-pill">Page Views: ${Number(data?.page_views||0).toLocaleString()}</span><span class="stat-pill">Unique Visitors: ${Number(data?.unique_visitors||0).toLocaleString()}</span><span class="stat-pill">Registered Members: ${Number(data?.registered_users||0).toLocaleString()}</span><span class="stat-pill">Users Online: ${Number(data?.online_users||0).toLocaleString()}</span>`;
  },

  async refreshShell() {
    // keep current page stable while refreshing shell data only
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

    if (this.state.settings?.show_notification_button === false || !this.state.user) {
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
    if (route === 'admin' || route.startsWith('admin/')) {
      const adminTab = route.includes('/') ? route.split('/')[1] : 'items';
      return Admin.render(adminTab);
    }

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
          <label>${t('email')}</label>
          <input name="email" type="email" required autocomplete="email">
        </div>

        <div class="form-group">
          <label>${t('password')}</label>
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
        this.alert(this.state.lang === 'ar' ? 'تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.' : (e.message || String(e)), 'err');
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
            <label>${t('username')}</label>
            <input name="username" required>
          </div>

          <div class="form-group">
            <label>${t('email')}</label>
            <input name="email" type="email" required autocomplete="email">
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>${t('firstName')}</label>
            <input name="first_name">
          </div>

          <div class="form-group">
            <label>${t('lastName')}</label>
            <input name="last_name">
          </div>
        </div>

        <div class="form-group">
          <label>${t('mobile')}</label>
          <input name="mobile_number" type="tel" autocomplete="tel">
        </div>

        <div class="form-group">
          <label>${t('password')}</label>
          <input name="password" type="password" minlength="8" required autocomplete="new-password">
        </div>

        <button class="btn primary">${t('register')}</button>
      </form>
    `);

    document.getElementById('reg-form')?.addEventListener('submit', async event => {
      event.preventDefault();

      try {
        await Auth.register(new FormData(event.currentTarget));
        this.alert(this.state.lang === 'ar' ? 'تم إرسال التسجيل. تحقق من بريدك الإلكتروني إذا كان تأكيد البريد مفعلاً.' : 'Registration submitted. Check your email if confirmation is enabled.');
        location.hash = 'login';
        await this.route();
      } catch (e) {
        this.alert(this.state.lang === 'ar' ? 'تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.' : (e.message || String(e)), 'err');
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
            <label>${t('username')}</label>
            <input name="username" value="${this.escAttr(p.username || '')}" required>
          </div>

          <div class="form-group">
            <label>${t('email')}</label>
            <input value="${this.escAttr(this.state.user.email || '')}" disabled>
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>${t('firstName')}</label>
            <input name="first_name" value="${this.escAttr(p.first_name || '')}">
          </div>

          <div class="form-group">
            <label>${t('lastName')}</label>
            <input name="last_name" value="${this.escAttr(p.last_name || '')}">
          </div>
        </div>

        <div class="form-group">
          <label>${t('mobile')}</label>
          <input name="mobile_number" value="${this.escAttr(p.mobile_number || '')}">
        </div>

        <div class="form-group">
          <label>${t('deliveryAddress')}</label>
          <textarea name="delivery_address">${this.esc(p.delivery_address || '')}</textarea>
        </div>

        <div class="form-group">
          <label>${t('newPassword')}</label>
          <input name="new_password" type="password" autocomplete="new-password">
        </div>

        <button class="btn primary">${t('saveChanges')}</button>
      </form>
    `);

    document.getElementById('account-form')?.addEventListener('submit', async event => {
      event.preventDefault();

      try {
        await Auth.updateProfile(new FormData(event.currentTarget));
        this.alert(this.state.lang === 'ar' ? 'تم تحديث الحساب.' : 'Account updated.');
        this.renderNav();
      } catch (e) {
        this.alert(this.state.lang === 'ar' ? 'تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.' : (e.message || String(e)), 'err');
      }
    });
  },

  async ordersView() {
    if (!this.state.user) return this.go('login');

    const { data, error } = await db
      .from('orders')
      .select('*,order_items(*)')
      .eq('user_id', this.state.user.id)
      .is('deleted_at', null)
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
              <strong>${t('order')} #${this.esc(o.order_number)}</strong><br>
              <span class="muted">${o.created_at ? new Date(o.created_at).toLocaleString() : ''}</span>
            </div>
            <div>${this.statusBadge(o.status)}</div>
          </div>
          <div><strong>${t('total')}:</strong> ${Number(o.total_usd || 0).toFixed(2)} ${t('usd')}</div>
          <ul>
            ${(o.order_items || []).map(i => `
              <li>${this.esc(i.product_title)} × ${Number(i.quantity || 0)}
              <br><small>${t('transactionId')}: ${this.esc(i.paypal_transaction_id || (this.state.lang === 'ar' ? 'غير متوفر' : 'N/A'))}</small></li>
            `).join('')}
          </ul>
          ${receiptStatuses.has(o.status)
            ? `<button class="btn secondary receipt-btn" data-id="${o.id}">${t('viewReceipt')}</button>`
            : `<span class="muted">${t('receiptAvailable')}</span>`}
        </div>
      `).join('') || `<div class="card">${t('noOrders')}</div>`}
    `);

    document.querySelectorAll('.receipt-btn').forEach(btn => {
      btn.onclick = () => this.go(`receipt/${btn.dataset.id}`);
    });
  },

  statusBadge(status) {
    const ar = this.state.lang === 'ar';
    const map = {
      pending: [ar ? 'بانتظار التحقق' : 'Pending Verification','status-pending'],
      processing: [ar ? 'قيد المعالجة' : 'Processing','status-processing'],
      confirmed: [ar ? 'تم التحقق / مؤكد' : 'Verified / Confirmed','status-confirmed'],
      shipped: [ar ? 'تم الشحن للتوصيل' : 'Shipped for Delivery','status-shipped'],
      delivered: [ar ? 'تم التوصيل / مكتمل' : 'Delivered / Completed','status-delivered'],
      cancelled: [ar ? 'ملغي' : 'Cancelled','status-cancelled'],
      rejected: [ar ? 'غير متحقق / مرفوض' : 'Unverified / Rejected','status-rejected']
    };
    const pair = map[status] || [ar ? 'غير معروف' : (status || 'Unknown'),''];
    return `<span class="order-status-badge ${pair[1]}">${this.esc(pair[0])}</span>`;
  },

  async receiptView(orderId) {
    if (!this.state.user) return this.go('login');

    const ar = this.state.lang === 'ar';

    const { data: order, error } = await db
      .from('orders')
      .select('*,order_items(*)')
      .eq('id', orderId)
      .single();

    if (error || !order || (order.deleted_at && this.state.profile?.role !== 'admin')) {
      this.view(`<div class="alert err">${ar ? 'لم يتم العثور على الإيصال أو الطلب.' : 'Receipt/order not found.'}</div>`);
      return;
    }

    const allowed = ['processing','confirmed','shipped','delivered'].includes(order.status)
      || this.state.profile?.role === 'admin';

    if (!allowed) {
      this.view(`<div class="alert err">${ar ? 'إيصال الدفع غير متاح لأن الطلب لم يتم التحقق منه بعد.' : 'Payment receipt is unavailable because the order is not verified yet.'}</div>
      <button id="receipt-back" class="btn">${t('backOrders')}</button>`);
      document.getElementById('receipt-back').onclick = () => this.go('orders');
      return;
    }

    const items = order.order_items || [];
    const currency = t('usd');

    this.view(`
      <div class="receipt-box">
        <div class="receipt-header">
          <h2>${this.esc(localize(this.state.settings,'site_name') || (ar ? 'المتجر' : 'StoreFront'))}</h2>
          <strong>${ar ? 'إيصال دفع رسمي' : 'OFFICIAL PAYMENT RECEIPT'}</strong>
        </div>
        <div class="receipt-meta">
          <div><strong>${ar ? 'رقم الطلب' : 'Order #'}:</strong> ${this.esc(order.order_number)}<br>
          <strong>${ar ? 'التاريخ والوقت' : 'Date and Time'}:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString() : ''}<br>
          <strong>${ar ? 'حالة الطلب' : 'Order Status'}:</strong> ${this.statusBadge(order.status)}</div>
          <div><strong>${ar ? 'اسم العميل' : 'Customer Name'}:</strong> ${this.esc((order.first_name||'')+' '+(order.last_name||''))}<br>
          <strong>${t('email')}:</strong> ${this.esc(order.email||'')}<br>
          <strong>${ar ? 'الهاتف المتحرك' : 'Mobile'}:</strong> ${this.esc(order.mobile_number||'')}<br>
          <strong>${t('deliveryAddress')}:</strong> ${this.esc(order.delivery_address||'')}</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>${ar ? 'اسم المنتج' : 'Item Title'}</th>
            <th>${ar ? 'سعر الوحدة' : 'Unit Price'}</th>
            <th>${t('quantity')}</th>
            <th>${t('subtotal')}</th>
            <th>${t('transactionId')}</th>
          </tr></thead>
          <tbody>${items.map(i => `
            <tr><td>${this.esc(i.product_title||'')}</td>
            <td>${Number(i.unit_price_usd||0).toFixed(2)} ${currency}</td>
            <td>${Number(i.quantity||0)}</td>
            <td>${(Number(i.unit_price_usd||0)*Number(i.quantity||0)).toFixed(2)} ${currency}</td>
            <td>${this.esc(i.paypal_transaction_id||(ar?'غير متوفر':'N/A'))}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="receipt-totals">
          <div>${t('deliveryFee')}: ${Number(order.delivery_fee_usd||0).toFixed(2)} ${currency}</div>
          <div>${t('gatewayFee')}: ${Number(order.payment_gateway_fee_usd||0).toFixed(2)} ${currency}</div>
          <div>${t('vat')}: ${Number(order.vat_usd||0).toFixed(2)} ${currency}</div>
          <div class="receipt-grand-total">${t('total')}: ${Number(order.total_usd||0).toFixed(2)} ${currency}</div>
        </div>
      </div>
      <div class="receipt-actions">
        <button id="print-receipt" class="btn secondary">${t('printReceipt')}</button>
        <button id="receipt-back" class="btn">${t('backOrders')}</button>
      </div>
    `);

    document.getElementById('print-receipt').onclick = () => window.print();
    document.getElementById('receipt-back').onclick = () => this.go('orders');
  },

  contactView() {
    const ar = this.state.lang === 'ar';

    if (!this.state.user) {
      this.view(`<div class="card"><h2>${t('contactUs')}</h2>
      <p>${ar ? 'يجب تسجيل الدخول لإرسال رسالة.' : 'Please log in to submit a contact message.'}</p>
      <button id="contact-login" class="btn primary">${t('login')}</button></div>`);
      document.getElementById('contact-login').onclick = () => this.go('login');
      return;
    }

    this.view(`
      <form id="contact-form" class="panel">
        <h2>${t('contactUs')}</h2>
        <div class="form-group">
          <label>${t('emailAddress')} <small class="muted">— ${t('emailReplyNote')}</small></label>
          <input name="email" type="email" value="${this.escAttr(this.state.user.email||'')}" required>
        </div>
        <div class="form-group"><label>${t('messageType')}</label>
          <select name="type" required>
            <option value="Order Related">${t('orderRelated')}</option>
            <option value="Complain">${t('complaint')}</option>
            <option value="Feedback">${t('feedback')}</option>
            <option value="Question">${t('question')}</option>
          </select></div>
        <div class="form-group"><label>${t('yourMessage')}</label>
          <textarea name="message" rows="6" required></textarea></div>
        <button class="btn primary">${t('submitMessage')}</button>
      </form>`);

    document.getElementById('contact-form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);

      const { error } = await db.from('messages').insert({
        user_id: this.state.user.id,
        email: String(fd.get('email')||'').trim(),
        type: String(fd.get('type')||'').trim(),
        message: String(fd.get('message')||'').trim()
      });

      if (error) {
        this.alert(ar ? 'تعذر إرسال الرسالة.' : 'Unable to send message: ' + error.message, 'err');
        return;
      }

      form.reset();
      const emailField = form.querySelector('[name="email"]');
      if (emailField) emailField.value = this.state.user.email || '';

      this.alert(ar ? 'تم إرسال رسالتك بنجاح.' : 'Your message has been sent successfully.');
    };
  },

  async footer() {
    const host = document.getElementById('footer-links');
    if (!host) return;

    const safeLoad = async table => {
      const { data, error } = await db.from(table).select('*');
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    };

    let pages = this.footerCache.pages;
    let guides = this.footerCache.guides;

    if (Date.now() - this.footerCache.at >= 120000 || (!pages.length && !guides.length)) {
      [pages, guides] = await Promise.all([safeLoad('pages'), safeLoad('guide_pages')]);
      this.footerCache = { at: Date.now(), pages, guides };
    }

    const pageMap = new Map(pages.filter(x => x.enabled !== false).map(x => [x.page_key, x]));
    const guideMap = new Map(guides.filter(x => x.enabled !== false).map(x => [x.page_key, x]));

    const entries = [
      pageMap.get('terms') && { row:pageMap.get('terms'), href:'./terms.html', fallback:t('terms') },
      pageMap.get('privacy') && { row:pageMap.get('privacy'), href:'./privacy.html', fallback:t('privacy') },
      pageMap.get('delivery') && { row:pageMap.get('delivery'), href:'./delivery.html', fallback:t('delivery') },
      { row:null, href:'#contact', fallback:t('contactUs') },
      guideMap.get('guide_1') && { row:guideMap.get('guide_1'), href:'./custom_page_a.html', fallback:t('page1') },
      guideMap.get('guide_2') && { row:guideMap.get('guide_2'), href:'./custom_page_b.html', fallback:t('page2') },
      guideMap.get('guide_3') && { row:guideMap.get('guide_3'), href:'./custom_page_c.html', fallback:t('page3') },
      guideMap.get('guide_4') && { row:guideMap.get('guide_4'), href:'./custom_page_d.html', fallback:t('page4') }
    ].filter(Boolean);

    host.innerHTML = entries.map(entry => {
      const label = entry.row ? (localize(entry.row,'title') || entry.fallback) : entry.fallback;
      return `<a class="btn footer-page" href="${entry.href}">${this.esc(label)}</a>`;
    }).join('');
  },

  async start() {
    document.getElementById('year').textContent = new Date().getFullYear();
    const powered = document.getElementById('powered-by');
    if (powered) powered.textContent = t('powered');

    // Track meaningful unsaved edits without interfering with background-tab focus changes.
    let formDirty = false;
    document.addEventListener('input', event => {
      const form = event.target?.closest?.('form');
      if (form && !form.dataset.noDirtyGuard) formDirty = true;
    });
    document.addEventListener('change', event => {
      const form = event.target?.closest?.('form');
      if (form && !form.dataset.noDirtyGuard) formDirty = true;
    });
    document.addEventListener('submit', () => { formDirty = false; }, true);
    window.addEventListener('beforeunload', event => {
      if (!formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });

    // Wire controls first, but keep the visual shell cloaked until real settings are applied.
    this.wireStaticControls();
    this.applyBasicUI();

    try {
      await this.loadSettings();
      this.applySettings();

      // Reveal the shell as soon as the true appearance has been applied.
      document.documentElement.classList.add('app-ready');

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

      await this.footer();

      try {
        await this.notifications();
      } catch (e) {
        console.error(e);
      }

      await this.route();

      try {
        const flash = sessionStorage.getItem('sf_flash');
        if (flash) {
          sessionStorage.removeItem('sf_flash');
          this.alert(flash);
        }
      } catch (_) {}

      db.auth.onAuthStateChange((event, session) => {
        const currentUserId = this.state.user?.id || null;
        const nextUserId = session?.user?.id || null;

        // Background tab activation can emit TOKEN_REFRESHED and sometimes SIGNED_IN
        // for the SAME existing session. Neither should rebuild the current route/form.
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_IN' && currentUserId === nextUserId) return;
        if (event === 'SIGNED_OUT' && currentUserId === null) return;

        setTimeout(async () => {
          // USER_UPDATED normally changes account metadata/password, not the route.
          // Refresh the shell/navigation only so active unsaved forms stay untouched.
          if (event === 'USER_UPDATED' && currentUserId === nextUserId) {
            await Auth.refresh();
            this.renderNav();
            return;
          }

          // A genuine identity transition (login/logout/account switch) may change
          // permissions and available routes, so rebuild normally.
          await this.refreshShell();
          await this.route();
        }, 0);
      });
    } finally {
      // Never leave the page invisible if a startup dependency fails.
      document.documentElement.classList.add('app-ready');
    }
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