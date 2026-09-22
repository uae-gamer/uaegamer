window.Products = {
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

    Store.state.products = await safe(
      db.from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
    );

    Store.state.categories = await safe(
      db.from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
    );

    Store.state.types = await safe(
      db.from('product_types')
        .select('*')
        .order('sort_order', { ascending: true })
    );

    // Some early schema versions may not have every optional text-bar column.
    Store.state.textbar = await safe(
      db.from('text_bar')
        .select('*')
        .order('sort_order', { ascending: true })
    );

    // Load product children separately so a relationship naming issue
    // cannot prevent the entire StoreFront from booting.
    for (const product of Store.state.products) {
      product.product_images = await safe(
        db.from('product_images')
          .select('*')
          .eq('product_id', product.id)
          .order('sort_order', { ascending: true })
      );

      product.included_content = await safe(
        db.from('included_content')
          .select('*')
          .eq('product_id', product.id)
          .order('sort_order', { ascending: true })
      );
    }

    // Respect enabled only when that field exists.
    Store.state.textbar = Store.state.textbar.filter(x => x.enabled === undefined || x.enabled === true);
  },

  price(product) {
    const normal = Number(product?.price_usd || 0);
    const discounted = Number(product?.discounted_price_usd || 0);
    return discounted > 0 && discounted < normal ? discounted : normal;
  },

  renderHome() {
    const s = Store.state;
    const bars = (s.textbar || []).map(x => localize(x, 'text')).filter(Boolean);

    let html = bars.length
      ? `<div class="text-bar"><div class="text-track">${Store.esc(bars.join('  •  '))}</div></div>`
      : '';

    html += `
      <div class="filters">
        <input id="q" placeholder="${t('search')}">

        <select id="cat">
          <option value="">${t('allCategories')}</option>
          ${(s.categories || []).map(x =>
            `<option value="${Store.escAttr(x.id)}">${Store.esc(localize(x, 'name'))}</option>`
          ).join('')}
        </select>

        <select id="typ">
          <option value="">${t('allTypes')}</option>
          ${(s.types || []).map(x =>
            `<option value="${Store.escAttr(x.id)}">${Store.esc(localize(x, 'name'))}</option>`
          ).join('')}
        </select>

        <select id="sort">
          <option value="default">${t('defaultOrder')}</option>
          <option value="az">${t('az')}</option>
          <option value="za">${t('za')}</option>
          <option value="low">${t('lowHigh')}</option>
          <option value="high">${t('highHigh') || t('highLow')}</option>
        </select>

        <select id="per">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32">32</option>
        </select>
      </div>

      <div id="catalog"></div>
    `;

    Store.view(html);

    ['q', 'cat', 'typ', 'sort', 'per'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'q' ? 'input' : 'change', () => this.renderCatalog(1));
    });

    this.renderCatalog(1);
  },

  renderCatalog(page = 1) {
    const qEl = document.getElementById('q');
    const catEl = document.getElementById('cat');
    const typEl = document.getElementById('typ');
    const sortEl = document.getElementById('sort');
    const perEl = document.getElementById('per');
    const host = document.getElementById('catalog');

    if (!host) return;

    const q = (qEl?.value || '').trim().toLowerCase();
    const cat = catEl?.value || '';
    const typ = typEl?.value || '';
    const sort = sortEl?.value || 'default';
    const per = Number(perEl?.value || 8);

    let products = [...(Store.state.products || [])];

    products = products.filter(p => {
      const haystack = [
        p.title, p.title_ar, p.description, p.description_ar
      ].filter(Boolean).join(' ').toLowerCase();

      return (!q || haystack.includes(q)) &&
             (!cat || p.category_id === cat) &&
             (!typ || p.type_id === typ);
    });

    if (sort === 'az') {
      products.sort((a, b) => localize(a, 'title').localeCompare(localize(b, 'title')));
    } else if (sort === 'za') {
      products.sort((a, b) => localize(b, 'title').localeCompare(localize(a, 'title')));
    } else if (sort === 'low') {
      products.sort((a, b) => this.price(a) - this.price(b));
    } else if (sort === 'high') {
      products.sort((a, b) => this.price(b) - this.price(a));
    }

    const pages = Math.max(1, Math.ceil(products.length / per));
    page = Math.max(1, Math.min(page, pages));
    const visible = products.slice((page - 1) * per, page * per);

    let html = visible.length
      ? `<div class="products">${visible.map(p => this.card(p)).join('')}</div>`
      : `<div class="card">${t('noItems')}</div>`;

    if (pages > 1) {
      html += `
        <div class="pagination">
          ${Array.from({ length: pages }, (_, i) =>
            `<button class="mini ${i + 1 === page ? 'active' : ''}" data-p="${i + 1}">${i + 1}</button>`
          ).join('')}
        </div>
      `;
    }

    host.innerHTML = html;

    document.querySelectorAll('[data-p]').forEach(btn => {
      btn.addEventListener('click', () => this.renderCatalog(Number(btn.dataset.p)));
    });

    this.bindCards();
  },

  card(p) {
    const normal = Number(p.price_usd || 0);
    const discounted = Number(p.discounted_price_usd || 0);
    const activePrice = this.price(p);

    const images = [...(p.product_images || [])].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );
    const img = images[0]?.image_url || '';

    let stockHtml;
    if (p.status === 'coming_soon') {
      stockHtml = `<span class="stock-coming">${t('coming')}</span>`;
    } else if (p.status === 'out_of_stock' || Number(p.stock_quantity || 0) <= 0) {
      stockHtml = `<span class="stock-out">${t('out')}</span>`;
    } else {
      stockHtml = `<span class="stock-in">${t('inStock')} (${Number(p.stock_quantity || 0)})</span>`;
    }

    const includedCount = (p.included_content || []).length;
    const canBuy = p.status === 'in_stock' && Number(p.stock_quantity || 0) > 0;

    return `
      <article class="product">
        <div class="product-img">
          ${img
            ? `<img src="${Store.escAttr(img)}" alt="${Store.escAttr(localize(p, 'title'))}">`
            : `<span class="muted">No image</span>`
          }
        </div>

        <h3>${Store.esc(localize(p, 'title'))}</h3>

        <div class="description">${Store.esc(localize(p, 'description')).slice(0, 180)}</div>

        <div class="price">
          ${discounted > 0 && discounted < normal
            ? `<span class="old-price">${normal.toFixed(2)} USD</span><br>`
            : ''
          }
          ${activePrice.toFixed(2)} USD
        </div>

        <div>${stockHtml}</div>

        <div class="product-actions">
          ${includedCount
            ? `<button class="btn included" data-id="${Store.escAttr(p.id)}">${t('included')} (${includedCount})</button>`
            : ''
          }

          ${canBuy
            ? `<button class="btn primary add" data-id="${Store.escAttr(p.id)}">${t('addCart')}</button>`
            : `<button class="btn" disabled>${p.status === 'coming_soon' ? t('coming') : t('out')}</button>`
          }
        </div>
      </article>
    `;
  },

  bindCards() {
    document.querySelectorAll('.add').forEach(btn => {
      btn.addEventListener('click', () => Cart.add(btn.dataset.id));
    });

    document.querySelectorAll('.included').forEach(btn => {
      btn.addEventListener('click', () => this.showIncluded(btn.dataset.id));
    });
  },

  showIncluded(id) {
    const product = (Store.state.products || []).find(x => x.id === id);
    if (!product) return;

    const items = [...(product.included_content || [])].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    Store.modal(`
      <h2>${Store.esc(localize(product, 'title'))}</h2>
      <h3>${t('included')}</h3>
      <ul class="included-list">
        ${items.map(x => `<li>${Store.esc(localize(x, 'name'))}</li>`).join('')}
      </ul>
    `);
  }
};