window.Products={
async load(){
 const [p,c,ty,tb]=await Promise.all([
  db.from('products').select('*,product_images(*),included_content(*)').eq('active',true).order('sort_order'),
  db.from('categories').select('*').order('sort_order'),
  db.from('product_types').select('*').order('sort_order'),
  db.from('text_bar').select('*').eq('enabled',true).order('sort_order')
 ]);
 if(p.error)throw p.error; Store.state.products=p.data||[];Store.state.categories=c.data||[];Store.state.types=ty.data||[];Store.state.textbar=tb.data||[];
},
price(p){const d=Number(p.discounted_price_usd||0),n=Number(p.price_usd||0);return d>0&&d<n?d:n},
renderHome(){
 const s=Store.state, lang=s.lang;
 const bars=s.textbar.map(x=>localize(x,'text')).filter(Boolean);
 let html=bars.length?`<div class="text-bar"><div class="text-track">${Store.esc(bars.join('  •  '))}</div></div>`:'';
 html+=`<div class="filters"><input id="q" placeholder="${t('search')}"><select id="cat"><option value="">${t('allCategories')}</option>${s.categories.map(x=>`<option value="${x.id}">${Store.esc(localize(x,'name'))}</option>`).join('')}</select><select id="typ"><option value="">${t('allTypes')}</option>${s.types.map(x=>`<option value="${x.id}">${Store.esc(localize(x,'name'))}</option>`).join('')}</select><select id="sort"><option value="default">${t('defaultOrder')}</option><option value="az">${t('az')}</option><option value="za">${t('za')}</option><option value="low">${t('lowHigh')}</option><option value="high">${t('highLow')}</option></select><select id="per"><option>8</option><option>16</option><option>32</option></select></div><div id="catalog"></div>`;
 Store.view(html); ['q','cat','typ','sort','per'].forEach(id=>document.getElementById(id).addEventListener(id==='q'?'input':'change',()=>this.renderCatalog(1)));this.renderCatalog(1);
},
renderCatalog(page=1){
 let a=[...Store.state.products],q=(document.getElementById('q')?.value||'').toLowerCase(),cat=document.getElementById('cat')?.value,typ=document.getElementById('typ')?.value,sort=document.getElementById('sort')?.value||'default',per=Number(document.getElementById('per')?.value||8);
 a=a.filter(p=>(!q||(`${p.title||''} ${p.title_ar||''} ${p.description||''} ${p.description_ar||''}`).toLowerCase().includes(q)))&&(!cat||p.category_id===cat)&&(!typ||p.type_id===typ));
 if(sort==='az')a.sort((x,y)=>localize(x,'title').localeCompare(localize(y,'title')));if(sort==='za')a.sort((x,y)=>localize(y,'title').localeCompare(localize(x,'title')));if(sort==='low')a.sort((x,y)=>this.price(x)-this.price(y));if(sort==='high')a.sort((x,y)=>this.price(y)-this.price(x));
 const pages=Math.max(1,Math.ceil(a.length/per));page=Math.min(page,pages);const slice=a.slice((page-1)*per,page*per);
 let h=slice.length?`<div class="products">${slice.map(p=>this.card(p)).join('')}</div>`:`<div class="card">${t('noItems')}</div>`;
 if(pages>1)h+=`<div class="pagination">${Array.from({length:pages},(_,i)=>`<button class="mini ${i+1===page?'active':''}" data-p="${i+1}">${i+1}</button>`).join('')}</div>`;
 document.getElementById('catalog').innerHTML=h;document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>this.renderCatalog(Number(b.dataset.p)));this.bindCards();
},
card(p){
 const price=Number(p.price_usd||0),d=Number(p.discounted_price_usd||0),active=this.price(p),img=(p.product_images||[]).sort((a,b)=>a.sort_order-b.sort_order)[0]?.image_url;
 const st=p.status==='coming_soon'?`<span class="stock-coming">${t('coming')}</span>`:p.status==='out_of_stock'||p.stock_quantity<=0?`<span class="stock-out">${t('out')}</span>`:`<span class="stock-in">${t('inStock')} (${p.stock_quantity})</span>`;
 return `<article class="product"><div class="product-img">${img?`<img src="${Store.escAttr(img)}" alt="">`:'<span class="muted">No image</span>'}</div><h3>${Store.esc(localize(p,'title'))}</h3><div class="description">${Store.esc(localize(p,'description')).slice(0,180)}</div><div class="price">${d>0&&d<price?`<span class="old-price">${price.toFixed(2)} USD</span><br>`:''}${active.toFixed(2)} USD</div><div>${st}</div><div class="product-actions">${(p.included_content||[]).length?`<button class="btn included" data-id="${p.id}">${t('included')} (${p.included_content.length})</button>`:''}${p.status==='in_stock'&&p.stock_quantity>0?`<button class="btn primary add" data-id="${p.id}">${t('addCart')}</button>`:`<button class="btn" disabled>${p.status==='coming_soon'?t('coming'):t('out')}</button>`}</div></article>`;
},
bindCards(){document.querySelectorAll('.add').forEach(b=>b.onclick=()=>Cart.add(b.dataset.id));document.querySelectorAll('.included').forEach(b=>b.onclick=()=>this.showIncluded(b.dataset.id))},
showIncluded(id){const p=Store.state.products.find(x=>x.id===id),a=[...(p?.included_content||[])].sort((x,y)=>x.sort_order-y);Store.modal(`<h2>${Store.esc(localize(p,'title'))}</h2><h3>${t('included')}</h3><ul class="included-list">${a.map(x=>`<li>${Store.esc(localize(x,'name'))}</li>`).join('')}</ul>`)}};