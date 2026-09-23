window.ContentPage = {
  config() {
    const body = document.body;
    const params = new URLSearchParams(location.search);
    return {
      source: body.dataset.source || params.get('source') || 'pages',
      key: body.dataset.pageKey || '',
      id: params.get('id') || ''
    };
  },

  async load() {
    const cfg = this.config();
    let query = db.from(cfg.source).select('*');

    if (cfg.key) query = query.eq('page_key', cfg.key);
    else if (cfg.id) query = query.eq('id', cfg.id);
    else throw new Error('No page was specified.');

    const {data,error} = await query.single();
    if (error) throw error;

    const title = PublicSite.localized(data,'title');
    const html = PublicSite.state.lang === 'ar'
      ? (data.content_ar || data.content || '')
      : (data.content || data.content_ar || '');

    document.getElementById('public-page-title').textContent = title;
    document.getElementById('public-page-content').innerHTML = html;
    document.title = `${title} — ${PublicSite.localized(PublicSite.state.settings,'site_name') || 'StoreFront'}`;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', title);
  },

  async start() {
    try {
      await PublicSite.init();
      await this.load();
    } catch (e) {
      console.error(e);
      document.getElementById('public-page-content').innerHTML =
        `<div class="alert err">${PublicSite.esc(e.message || e)}</div>`;
      document.documentElement.classList.add('app-ready');
    }
  }
};
ContentPage.start();
