window.FontLoader = {
  loaded: new Set(),

  fitHeaderButton(button) {
    this.headerButtonObserver?.disconnect();
    this.headerButtonObserver = null;
    if (!button) return;
    const label = button.querySelector('.header-home-button-label');
    if (!label) return;

    const fit = () => {
      if (!button.isConnected || !button.clientWidth) return;
      const style = getComputedStyle(button);
      const width = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 6;
      const height = button.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 6;
      if (width <= 0 || height <= 0) return;
      const preferred = parseFloat(style.getPropertyValue('--header-button-font-size')) || 40;
      let low = 1;
      let high = Math.max(preferred, height * .76);
      for (let i = 0; i < 16; i++) {
        const middle = (low + high) / 2;
        label.style.fontSize = `${middle}px`;
        if (label.getBoundingClientRect().width <= width && label.getBoundingClientRect().height <= height) low = middle;
        else high = middle;
      }
      label.style.fontSize = `${low}px`;
    };

    fit();
    if (typeof ResizeObserver !== 'undefined') {
      this.headerButtonObserver = new ResizeObserver(fit);
      this.headerButtonObserver.observe(button);
    } else window.addEventListener('resize', fit, { passive:true });
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit, { once:true });
  },

  cssFamily(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^['"]?([^,'"]+)['"]?/);
    return match ? match[1].trim() : '';
  },

  async loadFamily(cssValue) {
    const family = this.cssFamily(cssValue);
    if (!family) return;

    const system = new Set([
      'Arial','Tahoma','Verdana','Trebuchet MS','Georgia',
      'Times New Roman','Courier New','system-ui'
    ]);

    if (system.has(family) || this.loaded.has(family)) return;

    const supported = new Set([
      'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Nunito',
      'Raleway','Ubuntu','Noto Sans','Noto Sans Arabic','Cairo','Tajawal',
      'Almarai','IBM Plex Sans Arabic','Noto Kufi Arabic'
    ]);

    if (!supported.has(family)) return;

    const id = 'dynamic-font-' + family.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    if (document.getElementById(id)) {
      this.loaded.add(family);
      return;
    }

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,'+')}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
    this.loaded.add(family);
  },

  apply(settings, lang) {
    const s = settings || {};
    const body = lang === 'ar' ? s.font_family_ar : s.font_family;
    const header = lang === 'ar' ? s.header_title_font_family_ar : s.header_title_font_family;
    this.loadFamily(body);
    this.loadFamily(header);
  }
};
