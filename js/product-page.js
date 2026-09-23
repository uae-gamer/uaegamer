window.ProductPage = {
  product: null,
  images: [],
  imageIndex: 0,

  price(p) {
    const normal = Number(p.price_usd || 0);
    const discounted = Number(p.discounted_price_usd || 0);
    return discounted > 0 && discounted < normal ? discounted : normal;
  },

  async loadProduct() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) throw new Error('Product ID is missing.');

    const [{data:product,error:pError},{data:images,error:iError}] = await Promise.all([
      db.from('products').select('*').eq('id',id).eq('active',true).single(),
      db.from('product_images').select('*').eq('product_id',id).order('sort_order')
    ]);

    if (pError) throw pError;
    if (iError) throw iError;

    this.product = product;
    this.images = images || [];

    const [categoryRes,typeRes] = await Promise.all([
      product.category_id ? db.from('categories').select('*').eq('id',product.category_id).maybeSingle() : Promise.resolve({data:null}),
      product.type_id ? db.from('product_types').select('*').eq('id',product.type_id).maybeSingle() : Promise.resolve({data:null})
    ]);

    product.category = categoryRes.data || null;
    product.type = typeRes.data || null;

    this.render();
  },

  statusHtml() {
    const p = this.product;
    if (p.status === 'coming_soon') return '<span class="stock-coming">Coming Soon</span>';
    if (p.status === 'out_of_stock' || Number(p.stock_quantity||0) <= 0) return '<span class="stock-out">Out of Stock</span>';
    return `<span class="stock-in">In Stock (${Number(p.stock_quantity||0)})</span>`;
  },

  render() {
    const p = this.product;
    const price = Number(p.price_usd||0);
    const active = this.price(p);
    const discounted = Number(p.discounted_price_usd||0);
    const title = PublicSite.localized(p,'title');
    const description = PublicSite.localized(p,'description');
    const canBuy = p.status === 'in_stock' && Number(p.stock_quantity||0) > 0;

    document.title = `${title} — ${PublicSite.localized(PublicSite.state.settings,'site_name') || 'StoreFront'}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', String(description||title).slice(0,155));

    document.getElementById('product-page').innerHTML = `
      <div class="product-detail-grid">
        <div>
          <div class="product-detail-stage">
            ${this.images.length
              ? `<img id="product-detail-image" src="${PublicSite.escAttr(this.images[0].image_url)}" alt="${PublicSite.escAttr(title)}">`
              : '<div class="muted">No image</div>'}
            ${this.images.length > 1 ? `
              <button id="detail-prev" class="gallery-arrow gallery-prev">‹</button>
              <button id="detail-next" class="gallery-arrow gallery-next">›</button>
              <span id="detail-counter" class="gallery-counter">1 / ${this.images.length}</span>` : ''}
          </div>
          ${this.images.length > 1 ? `
            <div class="image-thumbs product-detail-thumbs">
              ${this.images.map((img,i) => `
                <button class="image-thumb ${i===0?'active':''}" data-image-index="${i}">
                  <img loading="lazy" src="${PublicSite.escAttr(img.image_url)}" alt="">
                </button>`).join('')}
            </div>` : ''}
        </div>

        <div class="product-detail-info">
          <h1>${PublicSite.esc(title)}</h1>
          <div class="description product-long-description">${PublicSite.esc(description)}</div>

          ${p.category ? `<p><strong>Category:</strong> ${PublicSite.esc(PublicSite.localized(p.category,'name'))}</p>` : ''}
          ${p.type ? `<p><strong>Type:</strong> ${PublicSite.esc(PublicSite.localized(p.type,'name'))}</p>` : ''}

          <div class="price product-detail-price">
            ${discounted > 0 && discounted < price ? `<span class="old-price">${price.toFixed(2)} USD</span><br>` : ''}
            ${active.toFixed(2)} USD
            <div class="muted">Equals approximately ${(active*3.67).toFixed(2)} AED</div>
          </div>

          <p>${this.statusHtml()}</p>

          <div class="product-actions">
            <button id="detail-included" class="btn">Included Content</button>
            ${canBuy ? '<button id="detail-add" class="btn primary">Add to Cart</button>' : '<button class="btn" disabled>Unavailable</button>'}
            <a class="btn secondary" href="./index.html#home">Back to Store</a>
          </div>

          <div id="product-action-note"></div>
        </div>
      </div>

      <section id="detail-included-section" class="product-included-section hidden">
        <h2>Included Content</h2>
        <div id="detail-included-body"></div>
      </section>
    `;

    this.bind();
  },

  showImage(index) {
    if (!this.images.length) return;
    this.imageIndex = (index + this.images.length) % this.images.length;
    const img = document.getElementById('product-detail-image');
    if (img) img.src = this.images[this.imageIndex].image_url;
    const counter = document.getElementById('detail-counter');
    if (counter) counter.textContent = `${this.imageIndex+1} / ${this.images.length}`;
    document.querySelectorAll('[data-image-index]').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.imageIndex) === this.imageIndex);
    });
  },

  bind() {
    document.getElementById('detail-prev')?.addEventListener('click', () => this.showImage(this.imageIndex-1));
    document.getElementById('detail-next')?.addEventListener('click', () => this.showImage(this.imageIndex+1));
    document.querySelectorAll('[data-image-index]').forEach(b => {
      b.onclick = () => this.showImage(Number(b.dataset.imageIndex));
    });
    document.getElementById('detail-included')?.addEventListener('click', () => this.loadIncluded(1));
    document.getElementById('detail-add')?.addEventListener('click', () => this.addToCart());
  },

  async loadIncluded(page=1) {
    const per = 25;
    const from = (page-1)*per;
    const to = from+per-1;

    const {data,error,count} = await db.from('included_content')
      .select('id,name,sort_order', {count:'exact'})
      .eq('product_id',this.product.id)
      .order('sort_order')
      .range(from,to);

    if (error) {
      document.getElementById('detail-included-body').innerHTML = `<div class="alert err">${PublicSite.esc(error.message)}</div>`;
      return;
    }

    const section = document.getElementById('detail-included-section');
    section.classList.remove('hidden');

    const total = Number(count||0);
    const pages = Math.max(1,Math.ceil(total/per));

    document.getElementById('detail-included-body').innerHTML = `
      <p class="muted">${total.toLocaleString()} entries</p>
      ${total ? `<ul class="included-list">${(data||[]).map(x => `<li>${PublicSite.esc(x.name||'')}</li>`).join('')}</ul>`
              : '<div class="card">No Included Content has been added.</div>'}
      ${pages > 1 ? `<div class="pagination">
        ${page>1 ? `<button class="mini detail-content-page" data-p="${page-1}">Previous</button>` : ''}
        <span class="mini active">Page ${page} of ${pages}</span>
        ${page<pages ? `<button class="mini detail-content-page" data-p="${page+1}">Next</button>` : ''}
      </div>` : ''}
    `;

    document.querySelectorAll('.detail-content-page').forEach(b => {
      b.onclick = () => this.loadIncluded(Number(b.dataset.p));
    });
    section.scrollIntoView({behavior:'smooth',block:'start'});
  },

  async addToCart() {
    const {data:{session}} = await db.auth.getSession();
    if (!session) {
      location.href = './index.html#login';
      return;
    }

    const key = 'storefront_cart_v1';
    let cart = {};
    try { cart = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}

    const current = Number(cart[this.product.id]||0);
    cart[this.product.id] = Math.min(current+1, Number(this.product.stock_quantity||1));
    localStorage.setItem(key,JSON.stringify(cart));

    document.getElementById('product-action-note').innerHTML = `
      <div class="alert ok">Item added to cart. <a href="./index.html#cart">Open Cart</a></div>
    `;
  },

  async start() {
    try {
      await PublicSite.init();
      await this.loadProduct();
    } catch (e) {
      console.error(e);
      document.getElementById('product-page').innerHTML = `<div class="alert err">${PublicSite.esc(e.message||e)}</div>`;
      document.documentElement.classList.add('app-ready');
    }
  }
};
ProductPage.start();
