window.PublicSite = {
  state: {
    lang: localStorage.getItem('sf_lang') || 'en',
    theme: localStorage.getItem('sf_theme') || 'light',
    settings: {}
  },

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  },

  escAttr(v) { return this.esc(v); },

  localized(row, field) {
    if (!row) return '';
    if (this.state.lang === 'ar') return row[`${field}_ar`] || row[field] || '';
    return row[field] || row[`${field}_ar`] || '';
  },

  async loadSettings() {
    const { data, error } = await db.from('site_settings').select('*').eq('id',1).single();
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
    root.style.setProperty('--base-font-size', s.font_size || '14px');
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
      if (s.header_type === 'image' && s.logo_url) {
        brand.innerHTML = `<a href="./index.html#home"><img class="site-logo" src="${this.escAttr(s.logo_url)}" alt="${this.escAttr(name)}"></a>`;
      } else {
        brand.innerHTML = `<a class="public-brand-link" href="./index.html#home"><h1>${this.esc(name)}</h1></a>`;
        const h = brand.querySelector('h1');
        h.style.fontFamily = 'var(--header-font)';
        h.style.fontSize = s.header_title_font_size || '2.5rem';

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
      await this.loadSettings();
      this.applyAppearance();
      await this.footer();
    } finally {
      document.documentElement.classList.add('app-ready');
    }
  }
};
