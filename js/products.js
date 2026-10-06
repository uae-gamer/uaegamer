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
    const guideRefs = await db.from('products').select('id,operation_guide_id,operation_guides(id,enabled)').in('id',ids);
    if (guideRefs.error) console.error('Guide lookup failed:',guideRefs.error);
    const guides = new Map((guideRefs.data||[]).filter(x=>x.operation_guides?.enabled).map(x=>[x.id,x.operation_guide_id]));
    products.forEach(p=>{p.operation_guide_id=guides.get(p.id)||null;});

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
      <div class="filters ${s.settings?.show_sort_items_per_page === false ? 'filters-basic' : 'filters-full'}">
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

        ${s.settings?.show_sort_items_per_page === false ? '' : `
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
        `}
      </div>

      <div id="catalog"></div>
    `;

    Store.view(html);
    this.startTextBar();

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

  startTextBar() {
    this.textBarObserver?.disconnect();
    this.textBarAnimation?.cancel();
    if (this.textBarResizeHandler) window.removeEventListener('resize', this.textBarResizeHandler);
    const bar = document.querySelector('.text-bar');
    const track = bar?.querySelector('.text-track');
    if (!bar || !track) return;
    const animate = () => {
      if (!bar.isConnected || !bar.clientWidth) return;
      this.textBarAnimation?.cancel();
      const width = track.scrollWidth;
      const viewport = bar.clientWidth;
      bar.style.minHeight = `${Math.max(40, track.offsetHeight + 2)}px`;
      const rtl = Store.state.lang === 'ar';
      // Start at the entry edge and reset as soon as the trailing edge exits.
      const from = rtl ? -width + 1 : viewport - 1;
      const to = rtl ? viewport : -width;
      this.textBarAnimation = track.animate([
        {transform:`translateX(${from}px)`},
        {transform:`translateX(${to}px)`}
      ], {duration:Math.abs(to-from) / 40 * 1000, iterations:Infinity, easing:'linear'});
    };
    animate();
    bar.addEventListener('mouseenter', () => this.textBarAnimation?.pause());
    bar.addEventListener('mouseleave', () => this.textBarAnimation?.play());
    if (typeof ResizeObserver !== 'undefined') {
      this.textBarObserver = new ResizeObserver(animate);
      this.textBarObserver.observe(bar);
      this.textBarObserver.observe(track);
    } else {
      this.textBarResizeHandler = animate;
      window.addEventListener('resize', animate, {passive:true});
    }
    document.fonts?.ready.then(animate);
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
      ? `<div class="products ${Number(Store.state.settings?.catalog_desktop_columns)===2?'catalog-two-columns':''}">${visible.map(p => this.card(p)).join('')}</div>`
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

    const assignedCategoryIds = p.category_ids || (p.category_id?[p.category_id]:[]);
    const categories = (Store.state.categories||[])
      .filter(c => assignedCategoryIds.includes(c.id))
      .sort((a,b) => Number(a.sort_order??0)-Number(b.sort_order??0))
      .map(c => Store.state.lang==='ar' ? (c.name_ar||c.name) : c.name);
    const category = categories.length > 0;

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
              <a class="product-thumbnail thumbnail-more" href="./product.html?id=${encodeURIComponent(p.id)}"
                 aria-label="${Store.state.lang==='ar'?'عرض جميع صور المنتج':'View all product images'}" hidden>
                <img alt=""><span class="thumbnail-more-overlay" aria-hidden="true">+</span>
              </a>
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
              ${categories.map(name=>`<span class="product-pill meta-pill">${Store.esc(name)}</span>`).join('')}
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
            ${p.operation_guide_id ? `<a class="btn operation-guide-button" href="./content.html?source=operation_guides&id=${encodeURIComponent(p.operation_guide_id)}">${Store.state.lang==='ar'?'تعليمات التشغيل':'Operation Guide'}</a>` : ''}
          </div>
        </div>
      </article>
    `;
  },

  bindCards() {
    this.thumbnailObserver?.disconnect();
    const fitThumbnails = row => {
      if (!row.isConnected || !row.clientWidth) return;
      const thumbnails = [...row.querySelectorAll('button.product-thumbnail')];
      const more = row.querySelector('.thumbnail-more');
      const capacity = Math.max(1, Math.floor((row.clientWidth + 6) / 50));
      const overflow = thumbnails.length > capacity;
      const visibleCount = overflow ? capacity - 1 : thumbnails.length;
      thumbnails.forEach((thumbnail, index) => { thumbnail.hidden = index >= visibleCount; });
      more.hidden = !overflow;
      if (overflow) more.querySelector('img').src = thumbnails[visibleCount].dataset.imageUrl;
    };
    const rows = [...document.querySelectorAll('.modern-product-card .product-thumbnails')];
    rows.forEach(fitThumbnails);
    if (typeof ResizeObserver !== 'undefined') {
      this.thumbnailObserver = new ResizeObserver(entries => entries.forEach(entry => fitThumbnails(entry.target)));
      rows.forEach(row => this.thumbnailObserver.observe(row));
    } else {
      if (this.thumbnailResizeHandler) window.removeEventListener('resize', this.thumbnailResizeHandler);
      this.thumbnailResizeHandler = () => rows.forEach(fitThumbnails);
      window.addEventListener('resize', this.thumbnailResizeHandler, {passive:true});
    }

    document.querySelectorAll('.add').forEach(button => {
      button.onclick = () => Cart.add(button.dataset.id);
    });

    document.querySelectorAll('button.product-thumbnail').forEach(button => {
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

  async showIncluded(productId, page = 1, search = '', category=this.includedSelections?.[productId] ?? '*') {
    const product = (Store.state.products || []).find(x => x.id === productId);
    if (!product) return;

    this.includedSelections ||= {}; this.includedSelections[productId]=category;
    const request = this.includedRequest = (this.includedRequest||0)+1;
    let groups;
    try {groups=await IncludedCategories.load(productId);} catch(error){Store.alert(error.message,'err');return;}
    if(request!==this.includedRequest)return;
    const per = 25;
    const term = String(search || '').trim();
    const from = (page - 1) * per;
    const to = from + per - 1;

    Store.modal(`
      <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
      <div class="card" style="text-align:center">${Store.state.lang === 'ar' ? 'جارٍ تحميل المحتويات…' : 'Loading Included Content…'}</div>
    `);

    let query = db
      .from('included_content')
      .select('id,name,sort_order', { count:'exact' })
      .eq('product_id', productId)
      .order('sort_order', { ascending:true })
      .range(from, to);

    query = IncludedCategories.apply(query,category);
    if (term) query = query.ilike('name', `%${term}%`);

    const { data, error, count } = await query;
    if(request!==this.includedRequest)return;
    if (error) {
      Store.modal(`<div class="alert err">${Store.esc(error.message)}</div>`);
      return;
    }

    const total = Number(count || 0);
    const pages = Math.max(1, Math.ceil(total / per));
    if (page > pages) return this.showIncluded(productId, pages, term);
    const ar = Store.state.lang === 'ar';

    Store.modal(`
      <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
      <h3 style="text-align:center">${t('included')} (${total.toLocaleString()})</h3>
      ${IncludedCategories.html(groups,category,Store.state.lang,value=>Store.escAttr(value))}

      <div class="form-group">
        <input id="public-included-search" type="search"
               placeholder="${ar ? 'ابحث في المحتويات المشمولة…' : 'Search Included Content…'}"
               value="${Store.escAttr(term)}">
      </div>

      ${term ? `<div class="muted" style="text-align:center;margin-bottom:10px">${ar ? 'نتائج البحث عن' : 'Search results for'} “${Store.esc(term)}”</div>` : ''}

      ${total
        ? `<ul class="included-list">${(data || []).map(x => `<li>${Store.esc(x.name || '')}</li>`).join('')}</ul>`
        : `<div class="card" style="text-align:center">${ar ? 'لم يتم العثور على محتوى مطابق.' : 'No matching Included Content found.'}</div>`}

      ${pages > 1 ? `
        <div class="pagination">
          <button class="mini included-page" data-p="${page-1}" ${page<=1?'disabled':''}>${t('previous')}</button>
          <span class="mini active">${ar ? 'الصفحة' : 'Page'} ${page} ${ar ? 'من' : 'of'} ${pages}</span>
          <button class="mini included-page" data-p="${page+1}" ${page>=pages?'disabled':''}>${t('next')}</button>
        </div>
        <div class="inline-actions" style="justify-content:center;margin-top:10px">
          <label>${ar ? 'الانتقال إلى الصفحة:' : 'Go to page:'}
            <input id="public-included-page" type="number" min="1" max="${pages}" value="${page}" style="width:90px">
          </label>
          <button id="public-included-go" class="btn secondary">${ar ? 'انتقال' : 'Go'}</button>
        </div>` : ''}
    `);

    document.querySelectorAll('.included-category-tab').forEach(b=>b.onclick=()=>this.showIncluded(productId,1,'',b.dataset.category));
    let timer;
    document.getElementById('public-included-search')?.addEventListener('input', event => {
      clearTimeout(timer);
      const value = event.target.value.trim();
      timer = setTimeout(() => this.showIncluded(productId, 1, value), 300);
    });

    document.querySelectorAll('.included-page').forEach(btn => {
      btn.onclick = () => {
        if (btn.disabled) return;
        this.showIncluded(productId, Number(btn.dataset.p), term);
      };
    });

    document.getElementById('public-included-go')?.addEventListener('click', () => {
      const input = document.getElementById('public-included-page');
      const target = Math.max(1, Math.min(pages, Number(input?.value || 1)));
      this.showIncluded(productId, target, term);
    });
  }};
