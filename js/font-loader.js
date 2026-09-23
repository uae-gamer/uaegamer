window.FontLoader = {
  loaded: new Set(),

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
