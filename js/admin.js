window.Admin = {
  tabs: [
    ['items','Listed Items'],
    ['categories','Categories'],
    ['types','Types'],
    ['textbar','Text Bar'],
    ['orders','Orders'],
    ['report','Revenue Report'],
    ['statistics','Statistics & Reports'],
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
    const {data,error} = await db.from('orders')
      .select('*,order_items(*)')
      .order('created_at',{ascending:false});

    if (error) return this.err(error);

    const rows = data || [];

    document.getElementById('admin-body').innerHTML = `
      <h2>Manage Orders (${rows.length})</h2>

      ${rows.map(o => `
        <div class="card admin-order-card">
          <div class="admin-order-head">
            <div>
              <strong>Order #${Store.esc(o.order_number)}</strong><br>
              ${Store.esc((o.first_name||'')+' '+(o.last_name||''))}<br>
              ${Store.esc(o.email||'')}<br>
              ${Store.esc(o.mobile_number||'')}
            </div>

            <div>
              <strong>${Number(o.total_usd||0).toFixed(2)} USD</strong><br>
              <span class="muted">${o.created_at?new Date(o.created_at).toLocaleString():''}</span>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>PayPal Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                ${(o.order_items||[]).map(i => `
                  <tr>
                    <td>${Store.esc(i.product_title||'')}</td>
                    <td>${Number(i.quantity||0)}</td>
                    <td>${Number(i.unit_price_usd||0).toFixed(2)} USD</td>
                    <td><code>${Store.esc(i.paypal_transaction_id||'N/A')}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="bilingual">
            <div class="form-group">
              <label>Order Status</label>
              <select class="order-status" data-id="${o.id}">
                ${['pending','processing','confirmed','shipped','delivered','cancelled','rejected']
                  .map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Admin Notes</label>
              <textarea class="order-admin-notes" data-id="${o.id}">${Store.esc(o.admin_notes||'')}</textarea>
            </div>
          </div>

          <button class="btn success save-order" data-id="${o.id}">Save Order Status / Notes</button> <button class="btn secondary admin-receipt" data-id="${o.id}">View Receipt</button>
        </div>
      `).join('') || '<div class="card">No orders yet.</div>'}
    `;

    document.querySelectorAll('.admin-receipt').forEach(btn => {
      btn.onclick = () => Store.go(`receipt/${btn.dataset.id}`);
    });

    document.querySelectorAll('.save-order').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const status = document.querySelector(`.order-status[data-id="${CSS.escape(id)}"]`).value;
        const notes = document.querySelector(`.order-admin-notes[data-id="${CSS.escape(id)}"]`).value.trim();

        const patch = {
          status,
          admin_notes: notes || null,
          delivered_at: status === 'delivered' ? new Date().toISOString() : null,
          cancelled_at: ['cancelled','rejected'].includes(status) ? new Date().toISOString() : null
        };

        const result = await db.from('orders').update(patch).eq('id',id);
        if (result.error) return this.err(result.error);

        Store.alert('Order updated.');
        await this.orders();
      };
    });
  },

  async report() {
    const { data: orders, error } = await db.from('orders').select('*,order_items(*)').order('created_at',{ascending:false});
    if (error) return this.err(error);
    const included=(orders||[]).filter(o=>!['cancelled','rejected'].includes(o.status));
    let income=0, expenses=0, units=0;
    const rows=included.map(order=>{
      let orderIncome=0, orderExpense=0;
      for(const item of (order.order_items||[])){
        const qty=Number(item.quantity||0), unit=Number(item.unit_price_usd||0), subtotal=unit*qty;
        orderIncome+=subtotal; units+=qty;
        const list=Array.isArray(item.expenses_snapshot)?item.expenses_snapshot:[];
        for(const exp of list){
          const type=exp.type||exp.expense_type, value=Math.max(0,Number(exp.value??exp.expense_value??0));
          if(type==='fixed') orderExpense+=value*qty;
          else if(type==='percentage') orderExpense+=subtotal*(Math.min(100,value)/100);
        }
      }
      income+=orderIncome; expenses+=orderExpense;
      return {number:order.order_number,date:order.created_at,customer:`${order.first_name||''} ${order.last_name||''}`.trim(),status:order.status,income:orderIncome,expense:orderExpense,profit:orderIncome-orderExpense};
    });
    document.getElementById('admin-body').innerHTML=`<h2>Revenue Report</h2><p class="muted">Income is calculated from item selling prices only. Delivery charges, VAT and payment-gateway fees are excluded. Cancelled and rejected orders are excluded.</p><div class="stat-grid report-summary"><div class="stat"><span>Total Orders</span><strong>${rows.length.toLocaleString()}</strong></div><div class="stat"><span>Units Sold</span><strong>${units.toLocaleString()}</strong></div><div class="stat"><span>Item Income</span><strong>${income.toFixed(2)}</strong><small>USD</small></div><div class="stat"><span>Expenses</span><strong>${expenses.toFixed(2)}</strong><small>USD</small></div><div class="stat"><span>Net Revenue</span><strong>${(income-expenses).toFixed(2)}</strong><small>USD</small></div></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Income USD</th><th>Expenses USD</th><th>Net Revenue USD</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>#${Store.esc(r.number)}</strong></td><td>${r.date?new Date(r.date).toLocaleString():''}</td><td>${Store.esc(r.customer)}</td><td>${Store.statusBadge?Store.statusBadge(r.status):Store.esc(r.status)}</td><td>${r.income.toFixed(2)}</td><td>${r.expense.toFixed(2)}</td><td><strong>${r.profit.toFixed(2)}</strong></td></tr>`).join('')}</tbody></table></div>`;
  },

  async statistics(period='daily') {
    const body=document.getElementById('admin-body'); body.innerHTML='<div class="card">Loading statistics...</div>';
    const results=await Promise.all([
      db.from('analytics_daily').select('*').order('day'),
      db.from('analytics_daily_visitors').select('day,visitor_id'),
      db.from('analytics_monthly_visitors').select('month,visitor_id'),
      db.from('analytics_visitors').select('visitor_id'),
      db.from('analytics_presence').select('visitor_id,last_seen'),
      db.from('profiles').select('id,role,created_at'),
      db.from('orders').select('id,status,created_at,order_items(quantity,unit_price_usd)'),
      db.from('messages').select('id,created_at')
    ]);
    const failed=results.find(r=>r.error); if(failed) return this.err(failed.error);
    const [dailyR,dvR,mvR,vR,presR,profR,ordR,msgR]=results;
    const daily=dailyR.data||[], dv=dvR.data||[], mv=mvR.data||[], visitors=vR.data||[], profiles=profR.data||[], messages=msgR.data||[];
    const orders=(ordR.data||[]).filter(o=>!['cancelled','rejected'].includes(o.status));
    const online=(presR.data||[]).filter(x=>Date.now()-new Date(x.last_seen).getTime()<=300000).length;
    const kd=d=>new Date(d).toISOString().slice(0,10), km=d=>new Date(d).toISOString().slice(0,7);
    let rows=[];
    if(period==='daily'){
      const keys=new Set(daily.map(x=>x.day)); profiles.forEach(p=>p.role==='customer'&&p.created_at&&keys.add(kd(p.created_at))); orders.forEach(o=>o.created_at&&keys.add(kd(o.created_at))); messages.forEach(m=>m.created_at&&keys.add(kd(m.created_at)));
      rows=[...keys].sort().map(k=>{const tr=daily.find(x=>x.day===k)||{}, os=orders.filter(o=>kd(o.created_at)===k); const inc=os.reduce((a,o)=>a+(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_price_usd||0),0),0); return {period:k,page_views:Number(tr.page_views||0),unique_visitors:dv.filter(x=>x.day===k).length,registered:profiles.filter(p=>p.role==='customer'&&p.created_at&&kd(p.created_at)===k).length,peak_online:Number(tr.peak_online||0),orders:os.length,income:inc,messages:messages.filter(m=>m.created_at&&kd(m.created_at)===k).length};});
    } else if(period==='monthly'){
      const keys=new Set(daily.map(x=>String(x.day).slice(0,7))); profiles.forEach(p=>p.role==='customer'&&p.created_at&&keys.add(km(p.created_at))); orders.forEach(o=>o.created_at&&keys.add(km(o.created_at))); messages.forEach(m=>m.created_at&&keys.add(km(m.created_at)));
      rows=[...keys].sort().map(k=>{const tr=daily.filter(x=>String(x.day).slice(0,7)===k), os=orders.filter(o=>km(o.created_at)===k); const inc=os.reduce((a,o)=>a+(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_price_usd||0),0),0); return {period:k,page_views:tr.reduce((s,x)=>s+Number(x.page_views||0),0),unique_visitors:mv.filter(x=>String(x.month).slice(0,7)===k).length,registered:profiles.filter(p=>p.role==='customer'&&p.created_at&&km(p.created_at)===k).length,peak_online:Math.max(0,...tr.map(x=>Number(x.peak_online||0))),orders:os.length,income:inc,messages:messages.filter(m=>m.created_at&&km(m.created_at)===k).length};});
    } else {
      const inc=orders.reduce((a,o)=>a+(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_price_usd||0),0),0);
      rows=[{period:'All Time',page_views:daily.reduce((s,x)=>s+Number(x.page_views||0),0),unique_visitors:visitors.length,registered:profiles.filter(p=>p.role==='customer').length,peak_online:Math.max(0,...daily.map(x=>Number(x.peak_online||0))),orders:orders.length,income:inc,messages:messages.length}];
    }
    const latest=rows.length?rows[rows.length-1]:{page_views:0,unique_visitors:0,registered:0,peak_online:0,orders:0,income:0,messages:0};
    body.innerHTML=`<h2>Website Statistics & Reports</h2><p class="muted">Page views and anonymous unique visitors are tracked by date. Online Now uses visitor activity within the last five minutes. Cancelled/rejected orders are excluded from order/income totals.</p><div class="period-buttons"><button class="btn ${period==='daily'?'success':''}" data-period="daily">Daily</button><button class="btn ${period==='monthly'?'success':''}" data-period="monthly">Monthly</button><button class="btn ${period==='all'?'success':''}" data-period="all">All Time</button></div><div class="stat-grid stats-summary"><div class="stat"><span>Page Views</span><strong>${latest.page_views.toLocaleString()}</strong></div><div class="stat"><span>Unique Visitors</span><strong>${latest.unique_visitors.toLocaleString()}</strong></div><div class="stat"><span>Registered Users</span><strong>${latest.registered.toLocaleString()}</strong></div><div class="stat"><span>Online Now</span><strong>${online.toLocaleString()}</strong></div><div class="stat"><span>Peak Online</span><strong>${latest.peak_online.toLocaleString()}</strong></div><div class="stat"><span>Orders</span><strong>${latest.orders.toLocaleString()}</strong></div><div class="stat"><span>Income USD</span><strong>${latest.income.toFixed(2)}</strong></div><div class="stat"><span>Messages</span><strong>${latest.messages.toLocaleString()}</strong></div></div>${period!=='all'&&rows.length?'<div class="chart-grid"><div class="chart-card"><canvas id="traffic-chart" height="250"></canvas></div><div class="chart-card"><canvas id="business-chart" height="250"></canvas></div></div>':''}<div class="table-wrap"><table><thead><tr><th>Period</th><th>Page Views</th><th>Unique Visitors</th><th>Registered Users</th><th>Peak Online</th><th>Orders</th><th>Income</th><th>Messages</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${Store.esc(r.period)}</td><td>${r.page_views}</td><td>${r.unique_visitors}</td><td>${r.registered}</td><td>${r.peak_online}</td><td>${r.orders}</td><td>${r.income.toFixed(2)}</td><td>${r.messages}</td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>this.statistics(b.dataset.period));
    if(period!=='all'&&rows.length){this.drawStatsChart('traffic-chart',rows.slice(-31),[['page_views','Page Views'],['unique_visitors','Unique Visitors'],['registered','Registered']]); this.drawStatsChart('business-chart',rows.slice(-31),[['orders','Orders'],['income','Income'],['messages','Messages']]);}
  },

  drawStatsChart(id,rows,series) {
    const c=document.getElementById(id); if(!c)return; const ctx=c.getContext('2d'), rect=c.parentElement.getBoundingClientRect(), w=Math.max(500,rect.width-20), h=280, dpr=window.devicePixelRatio||1;
    c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';ctx.scale(dpr,dpr);
    const pad={l:45,r:15,t:20,b:45},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,max=Math.max(1,...rows.flatMap(r=>series.map(([k])=>Number(r[k])||0))), text=getComputedStyle(document.body).getPropertyValue('--text').trim()||'#222', border=getComputedStyle(document.body).getPropertyValue('--border').trim()||'#bbb';
    ctx.strokeStyle=border;ctx.fillStyle=text;ctx.font='11px sans-serif';
    for(let i=0;i<=4;i++){const y=pad.t+ch-(i/4)*ch;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(String(Math.round(max*i/4)),4,y+4);}
    const x=i=>pad.l+(rows.length===1?cw/2:i*cw/(rows.length-1)), y=v=>pad.t+ch-(Number(v||0)/max)*ch;
    series.forEach(([key,label],si)=>{ctx.beginPath();rows.forEach((r,i)=>{const px=x(i),py=y(r[key]);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.lineWidth=2;ctx.stroke();rows.forEach((r,i)=>{ctx.beginPath();ctx.arc(x(i),y(r[key]),2.5,0,Math.PI*2);ctx.fill()});ctx.fillText(label,pad.l+si*110,12)});
    const step=Math.max(1,Math.ceil(rows.length/8));rows.forEach((r,i)=>{if(i%step===0||i===rows.length-1){ctx.save();ctx.translate(x(i),h-8);ctx.rotate(-.35);ctx.fillText(r.period,0,0);ctx.restore()}});
  },

  async messages() {
    const {data,error} = await db.from('messages').select('*').order('created_at',{ascending:false});
    if (error) return this.err(error);

    const rows = data || [];
    document.getElementById('admin-body').innerHTML = `
      <h2>Contact Messages (${rows.length})</h2>
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Email</th><th>Type</th><th>Message</th><th>Action</th></tr></thead>
        <tbody>${rows.map(m => `
          <tr>
            <td>${m.created_at?new Date(m.created_at).toLocaleString():''}</td>
            <td><a href="mailto:${Store.escAttr(m.email||'')}">${Store.esc(m.email||'')}</a></td>
            <td><strong>${Store.esc(m.type||'')}</strong></td>
            <td>${Store.esc(m.message||'')}</td>
            <td><button class="btn danger delete-message" data-id="${m.id}">Delete</button></td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<div class="card">No contact messages received.</div>'}
    `;

    document.querySelectorAll('.delete-message').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this message?')) return;
        const result = await db.from('messages').delete().eq('id',btn.dataset.id);
        if (result.error) return this.err(result.error);
        Store.alert('Message deleted.');
        await this.messages();
      };
    });
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