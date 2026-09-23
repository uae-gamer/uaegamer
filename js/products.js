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
      db.from('categories').select('*').order('sort_order', { ascending: true })
    );

    Store.state.types = await safe(
      db.from('product_types').select('*').order('sort_order', { ascending: true })
    );

    Store.state.textbar = await safe(
      db.from('text_bar').select('*').order('sort_order', { ascending: true })
    );

    // Load images in batches instead of one request per product.
    const ids = Store.state.products.map(p => p.id);
    const allImages = [];

    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      if (!chunk.length) continue;

      const rows = await safe(
        db.from('product_images')
          .select('*')
          .in('product_id', chunk)
          .order('sort_order', { ascending: true })
      );
      allImages.push(...rows);
    }

    const imagesByProduct = new Map();
    for (const image of allImages) {
      if (!imagesByProduct.has(image.product_id)) imagesByProduct.set(image.product_id, []);
      imagesByProduct.get(image.product_id).push(image);
    }

    for (const product of Store.state.products) {
      product.product_images = imagesByProduct.get(product.id) || [];
      // Included Content is intentionally NOT loaded during startup.
      // It is fetched 25 rows at a time only when requested.
    }

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
          <option value="high">${t('highLow')}</option>
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
    const host = document.getElementById('catalog');
    if (!host) return;

    const q = (document.getElementById('q')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('cat')?.value || '';
    const typ = document.getElementById('typ')?.value || '';
    const sort = document.getElementById('sort')?.value || 'default';
    const per = Number(document.getElementById('per')?.value || 8);

    let products = [...(Store.state.products || [])];

    products = products.filter(p => {
      const haystack = [p.title, p.title_ar, p.description, p.description_ar]
        .filter(Boolean).join(' ').toLowerCase();

      return (!q || haystack.includes(q)) &&
             (!cat || p.category_id === cat) &&
             (!typ || p.type_id === typ);
    });

    if (sort === 'az') products.sort((a,b) => localize(a,'title').localeCompare(localize(b,'title')));
    if (sort === 'za') products.sort((a,b) => localize(b,'title').localeCompare(localize(a,'title')));
    if (sort === 'low') products.sort((a,b) => this.price(a)-this.price(b));
    if (sort === 'high') products.sort((a,b) => this.price(b)-this.price(a));

    const pages = Math.max(1, Math.ceil(products.length / per));
    page = Math.min(Math.max(1, page), pages);
    const visible = products.slice((page-1)*per, page*per);

    let html = visible.length
      ? `<div class="products">${visible.map(p => this.card(p)).join('')}</div>`
      : `<div class="card">${t('noItems')}</div>`;

    if (pages > 1) {
      html += `<div class="pagination">${
        Array.from({length: pages}, (_,i) =>
          `<button class="mini ${i+1===page?'active':''}" data-p="${i+1}">${i+1}</button>`
        ).join('')
      }</div>`;
    }

    host.innerHTML = html;
    host.querySelectorAll('[data-p]').forEach(b => b.onclick = () => this.renderCatalog(Number(b.dataset.p)));
    this.bindCards();
  },

  card(p) {
    const price = Number(p.price_usd || 0);
    const discounted = Number(p.discounted_price_usd || 0);
    const activePrice = this.price(p);
    const images = [...(p.product_images || [])].sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0));
    const image = images[0]?.image_url || '';
    const imageCount = images.length;

    const status = p.status === 'coming_soon'
      ? `<span class="stock-coming">${t('coming')}</span>`
      : (p.status === 'out_of_stock' || Number(p.stock_quantity || 0) <= 0)
        ? `<span class="stock-out">${t('out')}</span>`
        : `<span class="stock-in">${t('inStock')} (${Number(p.stock_quantity || 0)})</span>`;

    const canBuy = p.status === 'in_stock' && Number(p.stock_quantity || 0) > 0;

    return `
      <article class="product">
        <div class="product-img product-gallery" data-product="${Store.escAttr(p.id)}" data-index="0">
          ${image
            ? `<img loading="lazy" class="product-gallery-image" src="${Store.escAttr(image)}" alt="${Store.escAttr(localize(p,'title'))}">`
            : `<span class="muted">No image</span>`}

          ${imageCount > 1 ? `
            <button type="button" class="gallery-arrow gallery-prev" data-id="${Store.escAttr(p.id)}" aria-label="Previous image">‹</button>
            <button type="button" class="gallery-arrow gallery-next" data-id="${Store.escAttr(p.id)}" aria-label="Next image">›</button>
            <span class="gallery-counter">1 / ${imageCount}</span>
          ` : ''}
        </div>

        <h3>${Store.esc(localize(p,'title'))}</h3>
        <div class="description">${Store.esc(localize(p,'description')).slice(0,180)}</div>

        <div class="price">
          ${discounted > 0 && discounted < price
            ? `<span class="old-price">${price.toFixed(2)} USD</span><br>` : ''}
          ${activePrice.toFixed(2)} USD
        </div>

        <div>${status}</div>

        <div class="product-actions">
          <a class="btn secondary product-details-link" href="./product.html?id=${encodeURIComponent(p.id)}">View Details</a>
          <button class="btn included" data-id="${Store.escAttr(p.id)}">${t('included')}</button>

          ${canBuy
            ? `<button class="btn primary add" data-id="${Store.escAttr(p.id)}">${t('addCart')}</button>`
            : `<button class="btn" disabled>${p.status==='coming_soon'?t('coming'):t('out')}</button>`}
        </div>
      </article>
    `;
  },

  bindCards() {
    document.querySelectorAll('.add').forEach(b => b.onclick = () => Cart.add(b.dataset.id));
    document.querySelectorAll('.included').forEach(b => b.onclick = () => this.showIncluded(b.dataset.id, 1));

    document.querySelectorAll('.gallery-prev').forEach(b => {
      b.onclick = event => {
        event.stopPropagation();
        this.changeImage(b.dataset.id, -1);
      };
    });

    document.querySelectorAll('.gallery-next').forEach(b => {
      b.onclick = event => {
        event.stopPropagation();
        this.changeImage(b.dataset.id, 1);
      };
    });

    document.querySelectorAll('.product-gallery-image').forEach(img => {
      img.onclick = () => {
        const gallery = img.closest('.product-gallery');
        if (gallery) this.openImageViewer(gallery.dataset.product, Number(gallery.dataset.index || 0));
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
                <img src="${Store.escAttr(img.image_url)}" alt="">
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
    page = Math.min(Math.max(1, page), pages);

    Store.modal(`
      <h2 style="text-align:center">${Store.esc(localize(product,'title'))}</h2>
      <h3 style="text-align:center">${t('included')} (${total.toLocaleString()})</h3>

      ${total
        ? `<ul class="included-list">${(data || []).map(x => `<li>${Store.esc(x.name || '')}</li>`).join('')}</ul>`
        : `<div class="card" style="text-align:center">No Included Content</div>`}

      ${pages > 1 ? `
        <div class="pagination">
          ${page > 1 ? `<button class="mini included-page" data-p="${page-1}">Previous</button>` : ''}
          <span class="mini active">Page ${page} of ${pages}</span>
          ${page < pages ? `<button class="mini included-page" data-p="${page+1}">Next</button>` : ''}
        </div>` : ''}
    `);

    document.querySelectorAll('.included-page').forEach(btn => {
      btn.onclick = () => this.showIncluded(productId, Number(btn.dataset.p));
    });
  }
};