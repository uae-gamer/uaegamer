window.PublicSite = {
  state: {
    lang: localStorage.getItem('sf_lang') || 'en',
    theme: localStorage.getItem('sf_theme') || 'light',
    settings: {},
    user: null,
    profile: null
  },

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  },

  escAttr(v) { return this.esc(v); },

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

    for (const el of Array.from(template.content.querySelectorAll('*'))) {
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
        const ok =
          common.includes(name) ||
          (el.tagName === 'A' && ['href','target','rel'].includes(name)) ||
          (el.tagName === 'IMG' && ['src','alt','width','height','loading'].includes(name));

        if (!ok && !name.startsWith('aria-')) el.removeAttribute(attr.name);
      }

      if (el.tagName === 'A') {
        const href = this.safeUrl(el.getAttribute('href') || '');
        if (!href) el.removeAttribute('href');
        else el.setAttribute('href', href);
        if (el.getAttribute('target') === '_blank') el.setAttribute('rel','noopener noreferrer');
      }

      if (el.tagName === 'IMG') {
        const src = this.safeUrl(el.getAttribute('src') || '', { image:true });
        if (!src) el.remove();
        else {
          el.setAttribute('src', src);
          el.setAttribute('loading','lazy');
        }
      }
    }

    return template.innerHTML;
  },

  cssSize(value, fallback='14px') {
    const v = String(value ?? '').trim();
    if (!v) return fallback;
    if (/^\d+(?:\.\d+)?$/.test(v)) return `${v}px`;
    return v;
  },

  localized(row, field) {
    if (!row) return '';
    if (this.state.lang === 'ar') return row[`${field}_ar`] || row[field] || '';
    return row[field] || row[`${field}_ar`] || '';
  },

  async loadSettings() {
    const { data, error } = await Promise.race([
      db.from('site_settings').select('*').eq('id',1).single(),
      new Promise(resolve => setTimeout(() => resolve({data:null,error:new Error('Settings request timed out.')}),12000))
    ]);
    if (error) throw error;
    this.state.settings = data || {};
    try { localStorage.setItem('sf_cached_settings', JSON.stringify(this.state.settings)); } catch (_) {}
  },

  applyAppearance() {
    const s = this.state.settings || {};
    const root = document.documentElement;

    root.lang = this.state.lang;
    root.dir = this.state.lang === 'ar' ? 'rtl' : 'ltr';
    root.dataset.theme = this.state.theme;
    document.body.classList.toggle('dark', this.state.theme === 'dark');

    root.style.setProperty('--primary', s.theme_color || '#0066cc');
    root.style.setProperty('--base-font-size', this.cssSize(s.font_size, '14px'));
    root.style.setProperty(
      '--body-font',
      this.state.lang === 'ar'
        ? (s.font_family_ar || "'Noto Sans Arabic', sans-serif")
        : (s.font_family || "'Noto Sans', sans-serif")
    );
    root.style.setProperty(
      '--header-font',
      this.state.lang === 'ar'
        ? (s.header_title_font_family_ar || "'Noto Sans Arabic', sans-serif")
        : (s.header_title_font_family || "'Montserrat', sans-serif")
    );

    const name = this.localized(s,'site_name') || 'StoreFront';
    const description = this.localized(s,'site_description') || '';
    const brand = document.getElementById('public-brand');

    if (brand) {
      const safeLogoUrl = this.safeUrl(s.logo_url || '', { image:true });
      if (s.header_type === 'image' && safeLogoUrl) {
        brand.innerHTML = `<a href="./index.html#home"><img class="site-logo" src="${this.escAttr(safeLogoUrl)}" alt="${this.escAttr(name)}"></a>`;
      } else {
        brand.innerHTML = `<a class="public-brand-link" href="./index.html#home"><h1>${this.esc(name)}</h1></a>`;
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

    const subtitle = document.getElementById('public-subtitle');
    if (subtitle) subtitle.textContent = description;

    const footerName = document.getElementById('public-footer-name');
    if (footerName) footerName.textContent = name;

    document.querySelectorAll('[data-public-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.publicLang === this.state.lang);
    });
    document.querySelectorAll('[data-public-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.publicTheme === this.state.theme);
    });
  },

  wireControls() {
    document.querySelectorAll('[data-public-lang]').forEach(btn => {
      btn.onclick = () => {
        localStorage.setItem('sf_lang', btn.dataset.publicLang);
        location.reload();
      };
    });

    document.querySelectorAll('[data-public-theme]').forEach(btn => {
      btn.onclick = () => {
        localStorage.setItem('sf_theme', btn.dataset.publicTheme);
        location.reload();
      };
    });
  },

  pageHref(row, source) {
    const key = row.page_key || row.slug || '';
    if (source === 'pages') {
      if (key === 'terms') return './terms.html';
      if (key === 'privacy') return './privacy.html';
      if (key === 'delivery') return './delivery.html';
    }

    if (source === 'guide_pages') {
      const m = /^guide_(\d+)$/.exec(key);
      if (m) return `./guide-${m[1]}.html`;
    }

    return `./content.html?source=${encodeURIComponent(source)}&id=${encodeURIComponent(row.id)}`;
  },

  async loadAuth() {
    const { data: { user } } = await db.auth.getUser();
    this.state.user = user || null;
    this.state.profile = null;

    if (user) {
      const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
      this.state.profile = data || null;
    }
  },

  cartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem('storefront_cart_v1') || '{}');
      return Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0);
    } catch (_) {
      return 0;
    }
  },

  renderNav() {
    const nav = document.getElementById('public-main-nav');
    if (!nav) return;

    const user = this.state.user;
    const profile = this.state.profile;
    const lang = this.state.lang;

    const labels = lang === 'ar'
      ? {home:'الرئيسية',contact:'اتصل بنا',cart:'السلة',orders:'طلباتي',account:'حسابي',admin:'لوحة الإدارة',logout:'تسجيل الخروج',login:'تسجيل الدخول',register:'تسجيل'}
      : {home:'Home',contact:'Contact',cart:'Cart',orders:'My Orders',account:'Manage Account',admin:'Admin Control',logout:'Logout',login:'Log In',register:'Register'};

    const links = [
      ['./index.html#home', labels.home],
      ['./index.html#contact', labels.contact]
    ];

    if (user) {
      links.push(
        [`./index.html#cart`, `${labels.cart} (${this.cartCount()})`],
        ['./index.html#orders', labels.orders],
        ['./index.html#account', `${labels.account} (${this.esc(profile?.username || user.email || '')})`]
      );
      if (profile?.role === 'admin') links.push(['./index.html#admin', labels.admin]);
      links.push(['#logout', labels.logout]);
    } else {
      links.push(
        ['./index.html#login', labels.login],
        ['./index.html#register', labels.register]
      );
    }

    nav.innerHTML = links.map(([href,label]) => `
      <a class="btn" href="${href}" ${href === '#logout' ? 'data-public-logout="1"' : ''}>${label}</a>
    `).join('');

    nav.querySelector('[data-public-logout]')?.addEventListener('click', async event => {
      event.preventDefault();
      await db.auth.signOut();
      location.href = './index.html#home';
    });
  },

  async footer() {
    const host = document.getElementById('public-footer-links');
    if (!host) return;

    const get = async table => {
      const {data,error} = await db.from(table).select('*');
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    };

    const [pages,guides] = await Promise.all([get('pages'),get('guide_pages')]);
    const entries = [
      ...pages.filter(x => x.enabled !== false).map(x => ({...x,_source:'pages'})),
      ...guides.filter(x => x.enabled !== false).map(x => ({...x,_source:'guide_pages'}))
    ];

    host.innerHTML = entries.map(x => `
      <a class="btn" href="${this.pageHref(x,x._source)}">${this.esc(this.localized(x,'title'))}</a>
    `).join('');
  },

  async init() {
    document.getElementById('public-year').textContent = new Date().getFullYear();
    this.wireControls();

    try {
      await Promise.all([
        this.loadSettings(),
        this.loadAuth()
      ]);
      this.applyAppearance();
      this.renderNav();
      await this.footer();
    } finally {
      document.documentElement.classList.add('app-ready');
    }
  }
};
