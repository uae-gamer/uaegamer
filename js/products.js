window.Products = {
  catalog: {
    query: '',
    category: '',
    type: '',
    sort: 'default',
    per: 8,
    page: 1,
    total: 0,
    loadingToken: 0
  },

  async load() {
    const safe = async (promise, fallback = []) => {
      try {
        const { data, error } = await promise;
        if (error) {
          console.error(error);
          return fallback;
        }
        return data || fallback;
      } catch (e) {
        console.error(e);
        return fallback;
      }
    };

    // Startup now loads only small catalog metadata.
    // Product rows themselves are fetched page-by-page in renderCatalog().
    Store.state.products = [];

    const [categories, types, textbar] = await Promise.all([
      safe(db.from('categories').select('*').order('sort_order', { ascending: true })),
      safe(db.from('product_types').select('*').order('sort_order', { ascending: true })),
      safe(db.from('text_bar').select('*').order('sort_order', { ascending: true }))
    ]);

    Store.state.categories = categories;
    Store.state.types = types;
    Store.state.textbar = textbar.filter(x => x.enabled === undefined || x.enabled === true);
  },

  price(product) {
    const normal = Number(product?.price_usd || 0);
    const discounted = Number(product?.discounted_price_usd || 0);
    return discounted > 0 && discounted < normal ? discounted : normal;
  },

  async loadImagesForProducts(products) {
    const ids = (products || []).map(p => p.id).filter(Boolean);
    if (!ids.length) return;

    const result = await Store.withTimeout(
      db.from('product_images')
      .select('*')
      .in('product_id', ids)
      .order('sort_order', { ascending: true }),
      10000,
      'Product image request'
    ).catch(error => ({ data:null, error }));

    const { data, error } = result;

    if (error) {
      console.error(error);
      for (const p of products) p.product_images = [];
      return;
    }

    const byProduct = new Map();
    for (const img of (data || [])) {
      if (!byProduct.has(img.product_id)) byProduct.set(img.product_id, []);
      byProduct.get(img.product_id).push(img);
    }

    for (const p of products) {
      p.product_images = byProduct.get(p.id) || [];
    }
  },

  renderHome() {
    const s = Store.state;
    const c = this.catalog;
    const bars = (s.textbar || []).map(x => localize(x, 'text')).filter(Boolean);

    let html = bars.length
      ? `<div class="text-bar"><div class="text-track">${Store.esc(bars.join('  •  '))}</div></div>`
      : '';

    html += `
      <div class="filters">
        <input id="q" value="${Store.escAttr(c.query)}" placeholder="${t('search')}">

        <select id="cat">
          <option value="">${t('allCategories')}</option>
          ${(s.categories || []).map(x =>
            `<option value="${Store.escAttr(x.id)}" ${c.category===x.id?'selected':''}>${Store.esc(localize(x, 'name'))}</option>`
          ).join('')}
        </select>

        <select id="typ">
          <option value="">${t('allTypes')}</option>
          ${(s.types || []).map(x =>
            `<option value="${Store.escAttr(x.id)}" ${c.type===x.id?'selected':''}>${Store.esc(localize(x, 'name'))}</option>`
          ).join('')}
        </select>

        <select id="sort">
          <option value="default" ${c.sort==='default'?'selected':''}>${t('defaultOrder')}</option>
          <option value="az" ${c.sort==='az'?'selected':''}>${t('az')}</option>
          <option value="za" ${c.sort==='za'?'selected':''}>${t('za')}</option>
          <option value="low" ${c.sort==='low'?'selected':''}>${t('lowHigh')}</option>
          <option value="high" ${c.sort==='high'?'selected':''}>${t('highLow')}</option>
        </select>

        <select id="per">
          <option value="8" ${c.per===8?'selected':''}>8</option>
          <option value="16" ${c.per===16?'selected':''}>16</option>
          <option value="32" ${c.per===32?'selected':''}>32</option>
        </select>
      </div>

      <div id="catalog"></div>
    `;

    Store.view(html);

    let searchTimer = null;

    document.getElementById('q')?.addEventListener('input', event => {
      clearTimeout(searchTimer);
      c.query = event.currentTarget.value.trim();
      searchTimer = setTimeout(() => {
        c.page = 1;
        this.renderCatalog(1);
      }, 250);
    });

    document.getElementById('cat')?.addEventListener('change', event => {
      c.category = event.currentTarget.value;
      c.page = 1;
      this.renderCatalog(1);
    });

    document.getElementById('typ')?.addEventListener('change', event => {
      c.type = event.currentTarget.value;
      c.page = 1;
      this.renderCatalog(1);
    });

    document.getElementById('sort')?.addEventListener('change', event => {
      c.sort = event.currentTarget.value;
      c.page = 1;
      this.renderCatalog(1);
    });

    document.getElementById('per')?.addEventListener('change', event => {
      c.per = Number(event.currentTarget.value || 8);
      c.page = 1;
      this.renderCatalog(1);
    });

    this.renderCatalog(c.page || 1);
  },

  async renderCatalog(page = 1) {
    const host = document.getElementById('catalog');
    if (!host) return;

    const c = this.catalog;
    c.query = (document.getElementById('q')?.value ?? c.query ?? '').trim();
    c.category = document.getElementById('cat')?.value ?? c.category ?? '';
    c.type = document.getElementById('typ')?.value ?? c.type ?? '';
    c.sort = document.getElementById('sort')?.value ?? c.sort ?? 'default';
    c.per = Number(document.getElementById('per')?.value ?? c.per ?? 8);

    const token = ++c.loadingToken;
    host.innerHTML = `<div class="card catalog-loading">Loading products…</div>`;

    let requestedPage = Math.max(1, Number(page || 1));
    let offset = (requestedPage - 1) * c.per;

    const runQuery = async () => db.rpc('catalog_products', {
      p_search: c.query || null,
      p_category_id: c.category || null,
      p_type_id: c.type || null,
      p_sort: c.sort,
      p_lang: Store.state.lang,
      p_limit: c.per,
      p_offset: offset
    });

    let queryResult;
    try {
      queryResult = await Store.withTimeout(runQuery(), 12000, 'Catalog request');
    } catch (e) {
      if (token !== c.loadingToken) return;
      host.innerHTML = `<div class="alert err">${Store.esc(e.message || e)} <button class="mini retry-catalog">Retry</button></div>`;
      host.querySelector('.retry-catalog')?.addEventListener('click', () => this.renderCatalog(requestedPage));
      return;
    }

    let { data, error } = queryResult;

    if (token !== c.loadingToken) return;

    if (error) {
      console.error(error);
      host.innerHTML = `<div class="alert err">Unable to load products: ${Store.esc(error.message)}</div>`;
      return;
    }

    let total = Number(data?.total || 0);
    let pages = Math.max(1, Math.ceil(total / c.per));

    // If data changed and the current page disappeared, automatically clamp and refetch.
    if (requestedPage > pages && total > 0) {
      requestedPage = pages;
      offset = (requestedPage - 1) * c.per;
      try {
        ({ data, error } = await Store.withTimeout(runQuery(), 12000, 'Catalog request'));
      } catch (e) {
        host.innerHTML = `<div class="alert err">${Store.esc(e.message || e)} <button class="mini retry-catalog">Retry</button></div>`;
        host.querySelector('.retry-catalog')?.addEventListener('click', () => this.renderCatalog(requestedPage));
        return;
      }

      if (token !== c.loadingToken) return;
      if (error) {
        host.innerHTML = `<div class="alert err">Unable to load products: ${Store.esc(error.message)}</div>`;
        return;
      }

      total = Number(data?.total || 0);
      pages = Math.max(1, Math.ceil(total / c.per));
    }

    const visible = Array.isArray(data?.items) ? data.items : [];
    await this.loadImagesForProducts(visible);

    if (token !== c.loadingToken) return;

    c.page = requestedPage;
    c.total = total;

    // Store only the currently needed catalog products.
    // Cart hydration adds off-page cart items on demand without loading the full catalog.
    Store.state.products = visible;

    let html = `
      <div class="catalog-summary">
        ${total.toLocaleString()} ${total === 1 ? t('item') : t('items')}
      </div>
    `;

    html += visible.length
      ? `<div class="products">${visible.map(p => this.card(p)).join('')}</div>`
      : `<div class="card">${t('noItems')}</div>`;

    if (pages > 1) {
      html += this.paginationHtml(requestedPage, pages);
    }

    host.innerHTML = html;

    host.querySelectorAll('[data-catalog-page]').forEach(button => {
      button.onclick = () => this.renderCatalog(Number(button.dataset.catalogPage));
    });

    this.bindCards();
  },

  paginationHtml(page, pages) {
    const nums = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
    const valid = [...nums].filter(n => n >= 1 && n <= pages).sort((a,b) => a-b);

    let controls = '';
    if (page > 1) {
      controls += `<button class="mini" data-catalog-page="${page-1}">${t('previous')}</button>`;
    }

    let last = 0;
    for (const n of valid) {
      if (last && n - last > 1) controls += `<span class="pagination-gap">…</span>`;
      controls += `<button class="mini ${n===page?'active':''}" data-catalog-page="${n}">${n}</button>`;
      last = n;
    }

    if (page < pages) {
      controls += `<button class="mini" data-catalog-page="${page+1}">${t('next')}</button>`;
    }

    return `<div class="pagination">${controls}</div>`;
  },

  card(p) {
    const price = Number(p.price_usd || 0);
    const discounted = Number(p.discounted_price_usd || 0);
    const activePrice = this.price(p);
    const hasDiscount = discounted > 0 && discounted < price;
    const discountPct = hasDiscount ? Math.round(((price - discounted) / price) * 100) : 0;

    const images = [...(p.product_images || [])]
      .sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0))
      .filter(x => x.image_url);

    const mainImage = images[0]?.image_url || '';
    const canBuy = p.status === 'in_stock' && Number(p.stock_quantity || 0) > 0;

    const statusClass = p.status === 'coming_soon'
      ? 'coming'
      : (!canBuy ? 'out' : 'in');

    const statusText = p.status === 'coming_soon'
      ? t('coming')
      : (!canBuy ? t('out') : t('inStock'));

    const category = Store.state.lang === 'ar'
      ? String(p.category_name_ar || '')
      : String(p.category_name || '');

    const type = Store.state.lang === 'ar'
      ? String(p.type_name_ar || '')
      : String(p.type_name || '');

    const description = localize(p,'description');

    return `
      <article class="product modern-product-card">
        <div class="product-media">
          <div class="product-img product-gallery-main">
            ${mainImage
              ? `<img loading="lazy"
                      class="product-gallery-image"
                      data-main-image="${Store.escAttr(p.id)}"
                      src="${Store.escAttr(mainImage)}"
                      alt="${Store.escAttr(localize(p,'title'))}">`
              : `<span class="muted">${t('noImage')}</span>`}

            <div class="product-badges">
              <span class="product-pill status-pill ${statusClass}">${statusText}</span>
              ${hasDiscount ? `<span class="product-pill discount-pill">-${discountPct}%</span>` : ''}
            </div>
          </div>

          ${images.length > 1 ? `
            <div class="product-thumbnails" aria-label="${Store.state.lang==='ar'?'صور المنتج':'Product images'}">
              ${images.map((img,index) => `
                <button type="button"
                        class="product-thumbnail ${index===0?'active':''}"
                        data-product-id="${Store.escAttr(p.id)}"
                        data-image-url="${Store.escAttr(img.image_url)}"
                        aria-label="${Store.state.lang==='ar' ? `الصورة ${index+1}` : `Image ${index+1}`}">
                  <img loading="lazy" src="${Store.escAttr(img.image_url)}" alt="">
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="product-card-body">
          <h3>${Store.esc(localize(p,'title'))}</h3>

          ${description
            ? `<div class="product-description clamp-3">${Store.esc(description)}</div>`
            : ''}

          ${(category || type) ? `
            <div class="product-meta-row">
              ${category ? `<span class="product-pill meta-pill">${Store.esc(category)}</span>` : ''}
              ${type ? `<span class="product-pill meta-pill">${Store.esc(type)}</span>` : ''}
            </div>
          ` : ''}

          <div class="product-pricing">
            ${hasDiscount ? `<div class="previous-price-line">${price.toFixed(2)} ${t('usd')}</div>` : ''}
            <div class="current-price">${activePrice.toFixed(2)} ${t('usd')}</div>
            <div class="aed-estimate">${t('equalsApprox')}: ${(activePrice * 3.67).toFixed(2)} ${t('aed')}</div>
          </div>

          <div class="product-actions">
            ${canBuy
              ? `<button class="btn primary add" data-id="${Store.escAttr(p.id)}">${t('addCart')}</button>`
              : `<button class="btn" disabled>${p.status==='coming_soon'?t('coming'):t('out')}</button>`}
            <a class="btn secondary product-details-link"
               href="./product.html?id=${encodeURIComponent(p.id)}">${t('viewDetails')}</a>
          </div>
        </div>
      </article>
    `;
  },

  bindCards() {
    document.querySelectorAll('.add').forEach(button => {
      button.onclick = () => Cart.add(button.dataset.id);
    });

    document.querySelectorAll('.product-thumbnail').forEach(button => {
      button.onclick = () => {
        const productId = button.dataset.productId;
        const imageUrl = button.dataset.imageUrl;
        const mainImage = document.querySelector(`[data-main-image="${CSS.escape(productId)}"]`);

        if (!mainImage || !imageUrl) return;

        mainImage.src = imageUrl;

        button.closest('.product-thumbnails')
          ?.querySelectorAll('.product-thumbnail')
          .forEach(x => x.classList.toggle('active', x === button));
      };
    });
  },

  changeImage(productId, delta) {
    const product = (Store.state.products || []).find(x => x.id === productId);
    const gallery = document.querySelector(`.product-gallery[data-product="${CSS.escape(productId)}"]`);
    if (!product || !gallery) return;

    const images = [...(product.product_images || [])].sort(
      (a,b) => Number(a.sort_order||0)-Number(b.sort_order||0)
    );
    if (images.length < 2) return;

    let index = Number(gallery.dataset.index || 0);
    index = (index + delta + images.length) % images.length;
    gallery.dataset.index = String(index);

    const img = gallery.querySelector('.product-gallery-image');
    const counter = gallery.querySelector('.gallery-counter');
    if (img) img.src = images[index].image_url;
    if (counter) counter.textContent = `${index + 1} / ${images.length}`;
  },

  openImageViewer(productId, index = 0) {
    const product = (Store.state.products || []).find(x => x.id === productId);
    if (!product) return;

    const images = [...(product.product_images || [])].sort(
      (a,b) => Number(a.sort_order||0)-Number(b.sort_order||0)
    );
    if (!images.length) return;

    index = Math.max(0, Math.min(index, images.length - 1));

    Store.modal(`
      <div class="image-viewer" data-product="${Store.escAttr(productId)}" data-index="${index}">
        <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
        <div class="image-viewer-stage">
          ${images.length > 1 ? `<button id="viewer-prev" class="gallery-arrow viewer-arrow viewer-prev">‹</button>` : ''}
          <img id="viewer-image" src="${Store.escAttr(images[index].image_url)}" alt="">
          ${images.length > 1 ? `<button id="viewer-next" class="gallery-arrow viewer-arrow viewer-next">›</button>` : ''}
        </div>
        <div id="viewer-counter" class="gallery-viewer-counter">${index + 1} / ${images.length}</div>
        ${images.length > 1 ? `
          <div class="image-thumbs">
            ${images.map((img,i) => `
              <button class="image-thumb ${i===index?'active':''}" data-i="${i}">
                <img loading="lazy" src="${Store.escAttr(img.image_url)}" alt="">
              </button>
            `).join('')}
          </div>` : ''}
      </div>
    `);

    const show = newIndex => {
      const viewer = document.querySelector('.image-viewer');
      if (!viewer) return;

      newIndex = (newIndex + images.length) % images.length;
      viewer.dataset.index = String(newIndex);
      document.getElementById('viewer-image').src = images[newIndex].image_url;
      document.getElementById('viewer-counter').textContent = `${newIndex + 1} / ${images.length}`;
      document.querySelectorAll('.image-thumb').forEach(x => {
        x.classList.toggle('active', Number(x.dataset.i) === newIndex);
      });
    };

    document.getElementById('viewer-prev')?.addEventListener('click', () => {
      const viewer = document.querySelector('.image-viewer');
      show(Number(viewer.dataset.index||0)-1);
    });

    document.getElementById('viewer-next')?.addEventListener('click', () => {
      const viewer = document.querySelector('.image-viewer');
      show(Number(viewer.dataset.index||0)+1);
    });

    document.querySelectorAll('.image-thumb').forEach(btn => {
      btn.onclick = () => show(Number(btn.dataset.i));
    });
  },

  async showIncluded(productId, page = 1) {
    const product = (Store.state.products || []).find(x => x.id === productId);
    if (!product) return;

    const per = 25;
    const from = (page - 1) * per;
    const to = from + per - 1;

    Store.modal(`
      <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
      <div class="card" style="text-align:center">Loading Included Content…</div>
    `);

    const { data, error, count } = await db
      .from('included_content')
      .select('id,name,sort_order', { count: 'exact' })
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .range(from, to);

    if (error) {
      Store.modal(`<div class="alert err">${Store.esc(error.message)}</div>`);
      return;
    }

    const total = Number(count || 0);
    const pages = Math.max(1, Math.ceil(total / per));

    Store.modal(`
      <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
      <h3 style="text-align:center">${t('included')} (${total.toLocaleString()})</h3>
      ${total
        ? `<ul class="included-list">${(data || []).map(x => `<li>${Store.esc(x.name || '')}</li>`).join('')}</ul>`
        : `<div class="card" style="text-align:center">No Included Content</div>`}
      ${pages > 1 ? `
        <div class="pagination">
          ${page > 1 ? `<button class="mini included-page" data-p="${page-1}">${t('previous')}</button>` : ''}
          <span class="mini active">Page ${page} of ${pages}</span>
          ${page < pages ? `<button class="mini included-page" data-p="${page+1}">${t('next')}</button>` : ''}
        </div>` : ''}
    `);

    document.querySelectorAll('.included-page').forEach(btn => {
      btn.onclick = () => this.showIncluded(productId, Number(btn.dataset.p));
    });
  }
};
