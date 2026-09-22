window.Admin = {
  tabs: [
    ['items','Listed Items'],
    ['categories','Categories'],
    ['types','Types'],
    ['textbar','Text Bar'],
    ['orders','Orders'],
    ['messages','Messages'],
    ['pages','Footer Pages'],
    ['guides','Guide Pages'],
    ['settings','Site Settings']
  ],

  async render(tab='items') {
    if (Store.state.profile?.role !== 'admin') {
      Store.view('<div class="alert err">Admin access required.</div>');
      return;
    }

    Store.view(`
      <nav class="sub-nav">
        ${this.tabs.map(([key,name]) =>
          `<button class="mini ${key===tab?'active':''}" data-tab="${key}">${name}</button>`
        ).join('')}
      </nav>
      <div id="admin-body"></div>
    `);

    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => this.render(b.dataset.tab));
    await this[tab]();
  },

  err(error) {
    console.error(error);
    Store.alert(error?.message || String(error), 'err');
  },

  productForm(product=null) {
    const p = product || {};
    const editing = Boolean(product);

    return `
      <form id="product-form" class="panel">
        <h3>${editing ? 'Edit Listed Item' : 'Add Listed Item'}</h3>

        <div class="bilingual">
          <div class="form-group">
            <label>Title - English</label>
            <input name="title" value="${Store.escAttr(p.title||'')}" required>
          </div>
          <div class="form-group">
            <label>Title - Arabic</label>
            <input name="title_ar" dir="rtl" value="${Store.escAttr(p.title_ar||'')}">
          </div>
        </div>

        <div class="form-group">
          <label>Description - English</label>
          <textarea name="description">${Store.esc(p.description||'')}</textarea>
        </div>

        <div class="form-group">
          <label>Description - Arabic</label>
          <textarea name="description_ar" dir="rtl">${Store.esc(p.description_ar||'')}</textarea>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>Price USD</label>
            <input name="price_usd" type="number" step=".01" min="0"
                   value="${p.price_usd ?? 0}" required>
          </div>
          <div class="form-group">
            <label>Discounted Price USD</label>
            <input name="discounted_price_usd" type="number" step=".01" min="0"
                   value="${p.discounted_price_usd ?? ''}">
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>Stock Quantity</label>
            <input name="stock_quantity" type="number" min="0" value="${p.stock_quantity ?? 0}">
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              <option value="in_stock" ${p.status==='in_stock'?'selected':''}>In Stock</option>
              <option value="out_of_stock" ${p.status==='out_of_stock'?'selected':''}>Out of Stock</option>
              <option value="coming_soon" ${p.status==='coming_soon'?'selected':''}>Coming Soon</option>
            </select>
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>Category</label>
            <select name="category_id">
              <option value="">None</option>
              ${(Store.state.categories||[]).map(x =>
                `<option value="${x.id}" ${p.category_id===x.id?'selected':''}>${Store.esc(x.name)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="type_id">
              <option value="">None</option>
              ${(Store.state.types||[]).map(x =>
                `<option value="${x.id}" ${p.type_id===x.id?'selected':''}>${Store.esc(x.name)}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>PayPal Link</label>
          <input name="paypal_link" type="url" value="${Store.escAttr(p.paypal_link||'')}">
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>Display Order</label>
            <input name="sort_order" type="number" value="${p.sort_order ?? 999999}">
          </div>
          <div class="form-group">
            <label style="margin-top:28px">
              <input name="active" type="checkbox" style="width:auto" ${p.active===false?'':'checked'}>
              Active
            </label>
          </div>
        </div>

        <button class="btn success">${editing ? 'Save Changes' : 'Add Listed Item'}</button>
        ${editing ? `<button type="button" id="cancel-edit" class="btn secondary">Cancel</button>` : ''}
      </form>
    `;
  },

  async items(editId=null) {
    const { data, error } = await db.from('products').select('*').order('sort_order');
    if (error) return this.err(error);

    const products = data || [];
    const editProduct = editId ? products.find(p => p.id === editId) : null;
    const host = document.getElementById('admin-body');

    host.innerHTML = `
      <h2>Manage Listed Items (${products.length})</h2>

      ${this.productForm(editProduct)}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Order</th>
              <th>Active</th>
              <th style="min-width:260px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>${Store.esc(p.title)}</td>
                <td>${Number(p.price_usd||0).toFixed(2)} USD</td>
                <td>${Number(p.stock_quantity||0)}</td>
                <td>${Store.esc(p.status)}</td>
                <td>${Number(p.sort_order||0)}</td>
                <td>${p.active ? 'Yes' : 'No'}</td>
                <td>
                  <button class="btn edit-product" data-id="${p.id}">Edit</button>
                  <button class="btn secondary manage-product" data-id="${p.id}">Images / Content / Expenses</button>
                  <button class="btn danger delete-product" data-id="${p.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const form = document.getElementById('product-form');
    form.onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(form);

      const payload = {
        title: String(fd.get('title')||'').trim(),
        title_ar: String(fd.get('title_ar')||'').trim() || null,
        description: String(fd.get('description')||'').trim() || null,
        description_ar: String(fd.get('description_ar')||'').trim() || null,
        price_usd: Number(fd.get('price_usd')||0),
        discounted_price_usd: String(fd.get('discounted_price_usd')||'').trim()
          ? Number(fd.get('discounted_price_usd')) : null,
        stock_quantity: Math.max(0, Number(fd.get('stock_quantity')||0)),
        status: fd.get('status'),
        category_id: fd.get('category_id') || null,
        type_id: fd.get('type_id') || null,
        paypal_link: String(fd.get('paypal_link')||'').trim() || null,
        sort_order: Number(fd.get('sort_order')||999999),
        active: fd.has('active')
      };

      let result;
      if (editProduct) {
        result = await db.from('products').update(payload).eq('id', editProduct.id);
      } else {
        result = await db.from('products').insert(payload);
      }

      if (result.error) return this.err(result.error);

      await Products.load();
      Store.alert(editProduct ? 'Listed item updated.' : 'Listed item added.');
      await this.items();
    };

    document.getElementById('cancel-edit')?.addEventListener('click', () => this.items());

    host.querySelectorAll('.edit-product').forEach(b => {
      b.onclick = () => this.items(b.dataset.id);
    });

    host.querySelectorAll('.manage-product').forEach(b => {
      b.onclick = () => this.manageProduct(b.dataset.id);
    });

    host.querySelectorAll('.delete-product').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Delete this listed item, its images, included content and expense records?')) return;

        const { data: images } = await db
          .from('product_images')
          .select('storage_path')
          .eq('product_id', b.dataset.id);

        const paths = (images||[]).map(x => x.storage_path).filter(Boolean);
        if (paths.length) {
          const removed = await db.storage.from('product-images').remove(paths);
          if (removed.error) {
            console.error(removed.error);
            if (!confirm('Some image files could not be removed from Storage. Continue deleting the product record?')) return;
          }
        }

        const result = await db.from('products').delete().eq('id', b.dataset.id);
        if (result.error) return this.err(result.error);

        await Products.load();
        Store.alert('Listed item deleted.');
        await this.items();
      };
    });
  },

  async manageProduct(productId) {
    const [pRes, iRes, cRes, eRes] = await Promise.all([
      db.from('products').select('*').eq('id', productId).single(),
      db.from('product_images').select('*').eq('product_id', productId).order('sort_order'),
      db.from('included_content').select('*').eq('product_id', productId).order('sort_order'),
      db.from('product_expenses').select('*').eq('product_id', productId).order('sort_order')
    ]);

    if (pRes.error) return this.err(pRes.error);
    if (iRes.error) return this.err(iRes.error);
    if (cRes.error) return this.err(cRes.error);
    if (eRes.error) return this.err(eRes.error);

    const product = pRes.data;
    const images = iRes.data || [];
    const content = cRes.data || [];
    const expenses = eRes.data || [];
    const host = document.getElementById('admin-body');

    host.innerHTML = `
      <button id="back-products" class="btn secondary">← Back to Listed Items</button>
      <h2>${Store.esc(product.title)}</h2>

      <section class="panel">
        <h3>Product Images (${images.length})</h3>
        <p class="muted">JPEG, PNG, GIF or WEBP. Maximum 8 MB each. You may select multiple files.</p>

        <form id="image-upload-form">
          <div class="form-group">
            <input id="product-image-files" type="file"
                   accept="image/jpeg,image/png,image/gif,image/webp" multiple required>
          </div>
          <button class="btn success">Upload Images</button>
        </form>

        <div id="upload-status" class="muted"></div>

        <div class="admin-image-grid">
          ${images.map(img => `
            <div class="admin-image-card">
              <img src="${Store.escAttr(img.image_url)}" alt="">
              <label>Order
                <input class="image-order" data-id="${img.id}" type="number"
                       value="${Number(img.sort_order||0)}">
              </label>
              <button class="btn danger delete-image"
                      data-id="${img.id}"
                      data-path="${Store.escAttr(img.storage_path||'')}">Delete</button>
            </div>
          `).join('') || '<p class="muted">No images uploaded yet.</p>'}
        </div>

        ${images.length ? `<button id="save-image-order" class="btn">Save Image Order</button>` : ''}
      </section>

      <section class="panel">
        <h3>Included Content (${content.length})</h3>
        <p class="muted">Displayed exactly as entered. No Arabic translation is applied to this list.</p>

        <form id="content-form" class="inline-admin-form">
          <input name="name" placeholder="Included content name" required>
          <input name="sort_order" type="number" value="${content.length+1}" placeholder="Order">
          <button class="btn success">Add</button>
        </form>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Content</th><th>Order</th><th>Action</th></tr></thead>
            <tbody>
              ${content.map(row => `
                <tr>
                  <td><input class="content-name" data-id="${row.id}" value="${Store.escAttr(row.name||'')}"></td>
                  <td><input class="content-order" data-id="${row.id}" type="number" value="${Number(row.sort_order||0)}"></td>
                  <td><button class="btn danger delete-content" data-id="${row.id}">Delete</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${content.length ? `<button id="save-content" class="btn">Save Included Content Changes</button>` : ''}
      </section>

      <section class="panel">
        <h3>Product Expenses (${expenses.length})</h3>
        <p class="muted">Expenses are private admin data and are used later by the revenue/profit report.</p>

        <form id="expense-form" class="inline-admin-form">
          <input name="name" placeholder="Expense name" required>
          <select name="expense_type">
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage of selling price</option>
          </select>
          <input name="expense_value" type="number" step=".01" min="0" placeholder="Value" required>
          <input name="sort_order" type="number" value="${expenses.length+1}" placeholder="Order">
          <button class="btn success">Add Expense</button>
        </form>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Order</th><th>Action</th></tr></thead>
            <tbody>
              ${expenses.map(row => `
                <tr>
                  <td><input class="expense-name" data-id="${row.id}" value="${Store.escAttr(row.name||'')}"></td>
                  <td>
                    <select class="expense-type" data-id="${row.id}">
                      <option value="fixed" ${row.expense_type==='fixed'?'selected':''}>Fixed</option>
                      <option value="percentage" ${row.expense_type==='percentage'?'selected':''}>Percentage</option>
                    </select>
                  </td>
                  <td><input class="expense-value" data-id="${row.id}" type="number" step=".01" min="0" value="${Number(row.expense_value||0)}"></td>
                  <td><input class="expense-order" data-id="${row.id}" type="number" value="${Number(row.sort_order||0)}"></td>
                  <td><button class="btn danger delete-expense" data-id="${row.id}">Delete</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${expenses.length ? `<button id="save-expenses" class="btn">Save Expense Changes</button>` : ''}
      </section>
    `;

    document.getElementById('back-products').onclick = () => this.items();

    document.getElementById('image-upload-form').onsubmit = async event => {
      event.preventDefault();

      const input = document.getElementById('product-image-files');
      const files = Array.from(input.files || []);
      const status = document.getElementById('upload-status');

      if (!files.length) return;

      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) {
          return this.err(new Error(`${file.name} exceeds the 8 MB limit.`));
        }

        if (!['image/jpeg','image/png','image/gif','image/webp'].includes(file.type)) {
          return this.err(new Error(`${file.name} has an unsupported image type.`));
        }
      }

      status.textContent = `Uploading 0 of ${files.length}...`;

      let nextOrder = images.length
        ? Math.max(...images.map(x => Number(x.sort_order||0))) + 1
        : 0;

      for (let index=0; index<files.length; index++) {
        const file = files[index];
        const ext = (file.name.split('.').pop() || 'img').toLowerCase().replace(/[^a-z0-9]/g,'');
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;

        const uploaded = await db.storage
          .from('product-images')
          .upload(path, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false
          });

        if (uploaded.error) return this.err(uploaded.error);

        const publicUrl = db.storage.from('product-images').getPublicUrl(path).data.publicUrl;

        const inserted = await db.from('product_images').insert({
          product_id: productId,
          image_url: publicUrl,
          storage_path: path,
          sort_order: nextOrder++
        });

        if (inserted.error) {
          await db.storage.from('product-images').remove([path]);
          return this.err(inserted.error);
        }

        status.textContent = `Uploading ${index+1} of ${files.length}...`;
      }

      Store.alert(`${files.length} image(s) uploaded.`);
      await Products.load();
      await this.manageProduct(productId);
    };

    document.getElementById('save-image-order')?.addEventListener('click', async () => {
      const fields = Array.from(document.querySelectorAll('.image-order'));

      for (const field of fields) {
        const result = await db.from('product_images')
          .update({ sort_order: Number(field.value||0) })
          .eq('id', field.dataset.id);

        if (result.error) return this.err(result.error);
      }

      Store.alert('Image order saved.');
      await Products.load();
      await this.manageProduct(productId);
    });

    document.querySelectorAll('.delete-image').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this image?')) return;

        const path = btn.dataset.path;
        if (path) {
          const removed = await db.storage.from('product-images').remove([path]);
          if (removed.error) return this.err(removed.error);
        }

        const deleted = await db.from('product_images').delete().eq('id', btn.dataset.id);
        if (deleted.error) return this.err(deleted.error);

        Store.alert('Image deleted.');
        await Products.load();
        await this.manageProduct(productId);
      };
    });

    document.getElementById('content-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);

      const result = await db.from('included_content').insert({
        product_id: productId,
        name: String(fd.get('name')||'').trim(),
        name_ar: null,
        sort_order: Number(fd.get('sort_order')||0)
      });

      if (result.error) return this.err(result.error);

      Store.alert('Included content added.');
      await Products.load();
      await this.manageProduct(productId);
    };

    document.getElementById('save-content')?.addEventListener('click', async () => {
      const names = Array.from(document.querySelectorAll('.content-name'));

      for (const nameField of names) {
        const id = nameField.dataset.id;
        const orderField = document.querySelector(`.content-order[data-id="${CSS.escape(id)}"]`);

        const result = await db.from('included_content').update({
          name: nameField.value.trim(),
          name_ar: null,
          sort_order: Number(orderField?.value||0)
        }).eq('id', id);

        if (result.error) return this.err(result.error);
      }

      Store.alert('Included content updated.');
      await Products.load();
      await this.manageProduct(productId);
    });

    document.querySelectorAll('.delete-content').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this included-content entry?')) return;

        const result = await db.from('included_content').delete().eq('id', btn.dataset.id);
        if (result.error) return this.err(result.error);

        Store.alert('Included content deleted.');
        await Products.load();
        await this.manageProduct(productId);
      };
    });

    document.getElementById('expense-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);

      const result = await db.from('product_expenses').insert({
        product_id: productId,
        name: String(fd.get('name')||'').trim(),
        expense_type: fd.get('expense_type'),
        expense_value: Number(fd.get('expense_value')||0),
        sort_order: Number(fd.get('sort_order')||0)
      });

      if (result.error) return this.err(result.error);

      Store.alert('Expense added.');
      await this.manageProduct(productId);
    };

    document.getElementById('save-expenses')?.addEventListener('click', async () => {
      const names = Array.from(document.querySelectorAll('.expense-name'));

      for (const nameField of names) {
        const id = nameField.dataset.id;
        const typeField = document.querySelector(`.expense-type[data-id="${CSS.escape(id)}"]`);
        const valueField = document.querySelector(`.expense-value[data-id="${CSS.escape(id)}"]`);
        const orderField = document.querySelector(`.expense-order[data-id="${CSS.escape(id)}"]`);

        const result = await db.from('product_expenses').update({
          name: nameField.value.trim(),
          expense_type: typeField.value,
          expense_value: Number(valueField.value||0),
          sort_order: Number(orderField.value||0)
        }).eq('id', id);

        if (result.error) return this.err(result.error);
      }

      Store.alert('Expenses updated.');
      await this.manageProduct(productId);
    });

    document.querySelectorAll('.delete-expense').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this expense?')) return;

        const result = await db.from('product_expenses').delete().eq('id', btn.dataset.id);
        if (result.error) return this.err(result.error);

        Store.alert('Expense deleted.');
        await this.manageProduct(productId);
      };
    });
  },

  async simpleTable(table, title, nameKey='name', arKey='name_ar') {
    const { data, error } = await db.from(table).select('*').order('sort_order');
    if (error) return this.err(error);

    const rows = data || [];
    const host = document.getElementById('admin-body');

    host.innerHTML = `
      <h2>Manage ${title} (${rows.length})</h2>

      <form id="simple-form" class="panel">
        <div class="bilingual">
          <div class="form-group">
            <label>English</label>
            <input name="${nameKey}" required>
          </div>
          <div class="form-group">
            <label>Arabic</label>
            <input name="${arKey}" dir="rtl">
          </div>
        </div>

        <div class="form-group">
          <label>Display Order</label>
          <input name="sort_order" type="number" value="${rows.length+1}">
        </div>

        ${table==='text_bar'
          ? `<div class="form-group"><label><input type="checkbox" name="enabled" style="width:auto" checked> Enabled</label></div>`
          : ''}

        <button class="btn success">Add</button>
      </form>

      <div class="table-wrap">
        <table>
          <thead><tr><th>English</th><th>Arabic</th><th>Order</th><th>Action</th></tr></thead>
          <tbody>
            ${rows.map(x => `
              <tr>
                <td>${Store.esc(x[nameKey]||'')}</td>
                <td dir="rtl">${Store.esc(x[arKey]||'')}</td>
                <td>${Number(x.sort_order||0)}</td>
                <td><button class="btn danger simple-del" data-id="${x.id}">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('simple-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const payload = {
        [nameKey]: String(fd.get(nameKey)||'').trim(),
        [arKey]: String(fd.get(arKey)||'').trim() || null,
        sort_order: Number(fd.get('sort_order')||0)
      };
      if (table === 'text_bar') payload.enabled = fd.has('enabled');

      const result = await db.from(table).insert(payload);
      if (result.error) return this.err(result.error);

      await Products.load();
      Store.alert(`${title} entry added.`);
      await this.simpleTable(table,title,nameKey,arKey);
    };

    document.querySelectorAll('.simple-del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this entry?')) return;

        const result = await db.from(table).delete().eq('id',btn.dataset.id);
        if (result.error) return this.err(result.error);

        await Products.load();
        await this.simpleTable(table,title,nameKey,arKey);
      };
    });
  },

  categories() { return this.simpleTable('categories','Categories'); },
  types() { return this.simpleTable('product_types','Types'); },
  textbar() { return this.simpleTable('text_bar','Text Bar','text','text_ar'); },

  async orders() {
    const {data,error} = await db.from('orders').select('*,order_items(*)').order('created_at',{ascending:false});
    if (error) return this.err(error);

    document.getElementById('admin-body').innerHTML = `
      <h2>Manage Orders (${(data||[]).length})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${(data||[]).map(o => `
          <tr>
            <td>${Store.esc(o.order_number)}</td>
            <td>${Store.esc((o.first_name||'')+' '+(o.last_name||''))}<br>${Store.esc(o.email||'')}</td>
            <td>${Number(o.total_usd||0).toFixed(2)} USD</td>
            <td>${Store.esc(o.status||'')}</td>
            <td>${o.created_at?new Date(o.created_at).toLocaleString():''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `;
  },

  async messages() {
    const {data,error} = await db.from('messages').select('*').order('created_at',{ascending:false});
    if (error) return this.err(error);

    document.getElementById('admin-body').innerHTML = `
      <h2>Contact Messages (${(data||[]).length})</h2>
      <div class="table-wrap"><table>
        ${(data||[]).map(m => `
          <tr>
            <td>${m.created_at?new Date(m.created_at).toLocaleString():''}</td>
            <td>${Store.esc(m.email||'')}</td>
            <td>${Store.esc(m.type||'')}</td>
            <td>${Store.esc(m.message||'')}</td>
          </tr>`).join('')}
      </table></div>
    `;
  },

  pages() { return this.contentTable('pages','Footer Pages'); },
  guides() { return this.contentTable('guide_pages','Guide Pages'); },

  async contentTable(table,title) {
    const {data,error} = await db.from(table).select('*');
    if (error) return this.err(error);

    document.getElementById('admin-body').innerHTML = `
      <h2>${title}</h2>
      ${(data||[]).map(x => `
        <div class="card">
          <strong>${Store.esc(x.title||x.page_key||x.slug||'Page')}</strong>
          <div class="description">${Store.esc((x.content||'').slice(0,250))}</div>
        </div>
      `).join('') || '<div class="card">No pages yet.</div>'}
      <p class="muted">Full rich page editing will be added in a later milestone.</p>
    `;
  },

  async settings() {
    const {data,error} = await db.from('site_settings').select('*').eq('id',1).single();
    if (error) return this.err(error);

    document.getElementById('admin-body').innerHTML = `
      <h2>Site Settings</h2>

      <form id="settings-form" class="panel">
        <div class="bilingual">
          <div class="form-group">
            <label>Site Name</label>
            <input name="site_name" value="${Store.escAttr(data.site_name||'')}">
          </div>
          <div class="form-group">
            <label>Site Name Arabic</label>
            <input name="site_name_ar" dir="rtl" value="${Store.escAttr(data.site_name_ar||'')}">
          </div>
        </div>

        <div class="form-group">
          <label>Description</label>
          <input name="site_description" value="${Store.escAttr(data.site_description||'')}">
        </div>

        <div class="form-group">
          <label>Description Arabic</label>
          <input name="site_description_ar" dir="rtl" value="${Store.escAttr(data.site_description_ar||'')}">
        </div>

        <div class="form-group">
          <label>Theme Color</label>
          <input name="theme_color" type="color" value="${Store.escAttr(data.theme_color||'#0066cc')}">
        </div>

        <button class="btn success">Save Settings</button>
      </form>
    `;

    document.getElementById('settings-form').onsubmit = async event => {
      event.preventDefault();

      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const result = await db.from('site_settings').update(payload).eq('id',1);

      if (result.error) return this.err(result.error);

      await Store.loadSettings();
      Store.applySettings();
      Store.alert('Settings saved.');
    };
  }
};