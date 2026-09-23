window.Admin = {
  tabs: [
    ['items','Listed Items'],
    ['categories','Categories'],
    ['types','Types'],
    ['textbar','Text Bar'],
    ['users','Registered Users'],
    ['audit','Audit Log'],
    ['email_log','Email Log'],
    ['orders','Orders'],
    ['report','Revenue Report'],
    ['statistics','Statistics & Reports'],
    ['messages','Messages'],
    ['pages','Footer Pages'],
    ['guides','Guide Pages'],
    ['settings','Site Settings'],
    ['csv','CSV Data']
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

    document.querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => {
        const route = `admin/${b.dataset.tab}`;
        if (location.hash.slice(1) === route) {
          this.render(b.dataset.tab);
        } else {
          location.hash = route;
        }
      };
    });

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

  async callAdminUserFunction(payload) {
    const { data, error } = await db.functions.invoke('admin-user', {
      body: payload
    });

    if (error) {
      let message = error.message || 'Edge Function request failed.';
      try {
        const context = error.context;
        if (context?.json) {
          const body = await context.json();
          if (body?.error) message = body.error;
        }
      } catch (_) {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  },

  async users() {
    const body = document.getElementById('admin-body');
    body.innerHTML = '<div class="card">Loading registered users…</div>';

    const [profilesResult, authResult] = await Promise.allSettled([
      db.from('profiles').select('*').order('created_at', { ascending: false }),
      this.callAdminUserFunction({ action: 'list', page: 1, per_page: 200 })
    ]);

    if (profilesResult.status === 'rejected') {
      return this.err(profilesResult.reason);
    }

    const profileResponse = profilesResult.value;
    if (profileResponse.error) return this.err(profileResponse.error);

    const profiles = profileResponse.data || [];
    const authUsers = authResult.status === 'fulfilled' ? (authResult.value.users || []) : [];
    const authById = new Map(authUsers.map(u => [u.id, u]));

    body.innerHTML = `
      <h2>Manage Registered Users (${profiles.length})</h2>

      ${authResult.status === 'rejected' ? `
        <div class="alert err">
          Auth administration Edge Function is not available yet:
          ${Store.esc(authResult.reason?.message || authResult.reason)}
        </div>` : ''}

      <p class="muted">
        Profile fields and roles are stored in the database. Login email, password and account
        disable/enable actions are performed by the secure Supabase Edge Function.
      </p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th><th>Email</th><th>Name</th><th>Mobile</th><th>Role</th>
              <th>Auth Status</th><th>Last Sign In</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${profiles.map(u => {
              const auth = authById.get(u.id);
              const disabled = auth?.banned_until && new Date(auth.banned_until).getTime() > Date.now();

              return `
                <tr>
                  <td>${Store.esc(u.username||'')}</td>
                  <td>${Store.esc(auth?.email||'Unavailable')}</td>
                  <td>${Store.esc(`${u.first_name||''} ${u.last_name||''}`.trim())}</td>
                  <td>${Store.esc(u.mobile_number||'')}</td>
                  <td>${Store.esc(u.role||'customer')}</td>
                  <td>${disabled ? '<span class="auth-disabled">Disabled</span>' : '<span class="auth-enabled">Enabled</span>'}</td>
                  <td>${auth?.last_sign_in_at ? new Date(auth.last_sign_in_at).toLocaleString() : 'N/A'}</td>
                  <td><button class="btn edit-user" data-id="${u.id}">Manage User</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div id="user-editor"></div>
    `;

    document.querySelectorAll('.edit-user').forEach(btn => {
      const profile = profiles.find(x => x.id === btn.dataset.id);
      const auth = authById.get(btn.dataset.id) || null;
      btn.onclick = () => this.editUserProfile(profile, auth);
    });
  },

  editUserProfile(user, authUser = null) {
    if (!user) return;

    const host = document.getElementById('user-editor');
    const disabled = authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now();

    host.innerHTML = `
      <div class="admin-grid user-management-grid">
        <form id="user-profile-form" class="panel">
          <h3>Profile: ${Store.esc(user.username||'')}</h3>

          <div class="bilingual">
            <div class="form-group">
              <label>Username</label>
              <input name="username" value="${Store.escAttr(user.username||'')}" required>
            </div>

            <div class="form-group">
              <label>Role</label>
              <select name="role">
                <option value="customer" ${user.role==='customer'?'selected':''}>Customer</option>
                <option value="admin" ${user.role==='admin'?'selected':''}>Admin</option>
              </select>
            </div>
          </div>

          <div class="bilingual">
            <div class="form-group">
              <label>First Name</label>
              <input name="first_name" value="${Store.escAttr(user.first_name||'')}">
            </div>

            <div class="form-group">
              <label>Last Name</label>
              <input name="last_name" value="${Store.escAttr(user.last_name||'')}">
            </div>
          </div>

          <div class="form-group">
            <label>Mobile Number</label>
            <input name="mobile_number" value="${Store.escAttr(user.mobile_number||'')}">
          </div>

          <div class="form-group">
            <label>Delivery Address</label>
            <textarea name="delivery_address" rows="3">${Store.esc(user.delivery_address||'')}</textarea>
          </div>

          <button class="btn success">Save Profile</button>
        </form>

        <form id="user-auth-form" class="panel">
          <h3>Authentication Account</h3>

          <div class="form-group">
            <label>Login Email</label>
            <input name="email" type="email" value="${Store.escAttr(authUser?.email||'')}" ${authUser?'':'disabled'}>
          </div>

          <div class="form-group">
            <label>New Password</label>
            <input name="password" type="password" minlength="8"
                   placeholder="Leave blank to keep current password"
                   ${authUser?'':'disabled'}>
          </div>

          <p class="muted">
            Password changes are immediate. Login email changes are performed through the
            Auth Admin API rather than exposing an elevated key in the browser.
          </p>

          ${authUser ? `
            <button class="btn success">Save Auth Account</button>
            <button type="button" id="toggle-user-disabled"
                    class="btn ${disabled?'secondary':'danger'}">
              ${disabled ? 'Enable Account' : 'Disable Account'}
            </button>
          ` : `
            <div class="alert err">Auth details unavailable. Deploy the admin-user Edge Function first.</div>
          `}
        </form>
      </div>

      <button type="button" id="close-user-editor" class="btn secondary">Close</button>
    `;

    document.getElementById('close-user-editor').onclick = () => host.innerHTML = '';

    document.getElementById('user-profile-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);

      const { error } = await db.rpc('admin_update_profile', {
        p_user_id: user.id,
        p_username: String(fd.get('username')||'').trim(),
        p_first_name: String(fd.get('first_name')||'').trim() || null,
        p_last_name: String(fd.get('last_name')||'').trim() || null,
        p_mobile_number: String(fd.get('mobile_number')||'').trim() || null,
        p_delivery_address: String(fd.get('delivery_address')||'').trim() || null,
        p_role: fd.get('role')
      });

      if (error) return this.err(error);

      Store.alert('User profile updated.');
      if (user.id === Store.state.user?.id) await Auth.refresh();
      await this.users();
    };

    if (authUser) {
      document.getElementById('user-auth-form').onsubmit = async event => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const email = String(fd.get('email')||'').trim();
        const password = String(fd.get('password')||'');

        if (email === String(authUser.email||'') && !password) {
          Store.alert('No Auth account changes were entered.', 'err');
          return;
        }

        try {
          await this.callAdminUserFunction({
            action: 'update_auth',
            user_id: user.id,
            email: email !== String(authUser.email||'') ? email : '',
            password
          });

          Store.alert('Auth account updated.');
          await this.users();
        } catch (e) {
          this.err(e);
        }
      };

      document.getElementById('toggle-user-disabled').onclick = async () => {
        const nextDisabled = !disabled;
        const verb = nextDisabled ? 'disable' : 'enable';

        if (!confirm(`Are you sure you want to ${verb} this account?`)) return;

        try {
          await this.callAdminUserFunction({
            action: 'set_disabled',
            user_id: user.id,
            disabled: nextDisabled
          });

          Store.alert(`User account ${nextDisabled ? 'disabled' : 'enabled'}.`);
          await this.users();
        } catch (e) {
          this.err(e);
        }
      };
    }
  },

  async audit() {
    const { data, error } = await db
      .from('admin_audit_log')
      .select('*,actor:actor_user_id(username),target:target_user_id(username)')
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) return this.err(error);

    const rows = data || [];
    document.getElementById('admin-body').innerHTML = `
      <h2>Admin Audit Log (${rows.length})</h2>
      <p class="muted">
        Sensitive Auth administration actions performed through the Edge Function are recorded here.
      </p>

      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Admin</th><th>Target</th><th>Action</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                  <td>${Store.esc(r.actor?.username || r.actor_user_id || 'N/A')}</td>
                  <td>${Store.esc(r.target?.username || r.target_user_id || 'N/A')}</td>
                  <td><strong>${Store.esc(r.action)}</strong></td>
                  <td><code>${Store.esc(JSON.stringify(r.details || {}))}</code></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="card">No sensitive admin actions have been recorded yet.</div>'}
    `;
  },

  async email_log() {
    const { data, error } = await db
      .from('email_delivery_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) return this.err(error);

    const rows = data || [];
    document.getElementById('admin-body').innerHTML = `
      <h2>Email Delivery Log (${rows.length})</h2>
      <p class="muted">
        Transactional emails sent by the Supabase Edge Function through Resend.
      </p>

      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Event</th><th>Recipient</th><th>Subject</th>
                <th>Status</th><th>Provider ID / Error</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                  <td>${Store.esc(r.event_type || '')}</td>
                  <td>${Store.esc(r.recipient || '')}</td>
                  <td>${Store.esc(r.subject || '')}</td>
                  <td><span class="email-status email-${Store.escAttr(r.status || '')}">${Store.esc(r.status || '')}</span></td>
                  <td>${Store.esc(r.provider_message_id || r.error_message || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="card">No transactional email attempts have been recorded yet.</div>'}
    `;
  },

  pages() {
    return this.manageContentPages('pages','Footer Pages');
  },

  guides() {
    return this.manageContentPages('guide_pages','Guide Pages');
  },

  async manageContentPages(table, title) {
    const { data, error } = await db.from(table).select('*').order('created_at', { ascending: true });
    if (error) return this.err(error);

    const rows = data || [];
    document.getElementById('admin-body').innerHTML = `
      <h2>Manage ${title}</h2>
      <p class="muted">Edit English/Arabic titles and HTML content. Enabled pages are available to visitors.</p>

      ${rows.map((row, index) => `
        <form class="panel content-page-form" data-id="${row.id}">
          <h3>${Store.esc(row.page_key || row.slug || row.title || `${title} ${index+1}`)}</h3>

          <div class="bilingual">
            <div class="form-group">
              <label>Title - English</label>
              <input name="title" value="${Store.escAttr(row.title||'')}" required>
            </div>
            <div class="form-group">
              <label>Title - Arabic</label>
              <input name="title_ar" dir="rtl" value="${Store.escAttr(row.title_ar||'')}">
            </div>
          </div>

          <div class="bilingual">
            <div class="form-group">
              <label>HTML Content - English</label>
              <textarea name="content" rows="8">${Store.esc(row.content||'')}</textarea>
            </div>
            <div class="form-group">
              <label>HTML Content - Arabic</label>
              <textarea name="content_ar" rows="8" dir="rtl">${Store.esc(row.content_ar||'')}</textarea>
            </div>
          </div>

          <label>
            <input type="checkbox" name="enabled" style="width:auto" ${row.enabled===false?'':'checked'}>
            Enable / Show
          </label>

          <div style="margin-top:10px">
            <button class="btn success">Save Page</button>
          </div>
        </form>
      `).join('') || '<div class="card">No pages exist yet.</div>'}
    `;

    document.querySelectorAll('.content-page-form').forEach(form => {
      form.onsubmit = async event => {
        event.preventDefault();
        const f = event.currentTarget;
        const fd = new FormData(f);

        const payload = {
          title: String(fd.get('title')||'').trim(),
          title_ar: String(fd.get('title_ar')||'').trim() || null,
          content: String(fd.get('content')||''),
          content_ar: String(fd.get('content_ar')||'') || null,
          enabled: fd.has('enabled')
        };

        const result = await db.from(table).update(payload).eq('id', f.dataset.id);
        if (result.error) return this.err(result.error);

        Store.alert('Page updated.');
        await Store.footer();
      };
    });
  },

  async settings() {
    const { data, error } = await db.from('site_settings').select('*').eq('id',1).single();
    if (error) return this.err(error);

    document.getElementById('admin-body').innerHTML = `
      <h2>Site Configuration & Customization</h2>

      <form id="settings-form" class="panel">
        <div class="bilingual">
          <div class="form-group"><label>Site Name - English</label>
            <input name="site_name" value="${Store.escAttr(data.site_name||'')}" required></div>
          <div class="form-group"><label>Site Name - Arabic</label>
            <input name="site_name_ar" dir="rtl" value="${Store.escAttr(data.site_name_ar||'')}" required></div>
        </div>

        <div class="bilingual">
          <div class="form-group"><label>Site Description - English</label>
            <input name="site_description" value="${Store.escAttr(data.site_description||'')}"></div>
          <div class="form-group"><label>Site Description - Arabic</label>
            <input name="site_description_ar" dir="rtl" value="${Store.escAttr(data.site_description_ar||'')}"></div>
        </div>

        <div class="bilingual">
          <div class="form-group">
            <label>Header Display Mode</label>
            <select name="header_type">
              <option value="text" ${data.header_type==='text'?'selected':''}>Text Title</option>
              <option value="image" ${data.header_type==='image'?'selected':''}>Logo Image URL</option>
              <option value="gradient" ${data.header_type==='gradient'?'selected':''}>Animated Gradient Text</option>
            </select>
          </div>
          <div class="form-group">
            <label>Logo Image URL</label>
            <input name="logo_url" type="url" value="${Store.escAttr(data.logo_url||'')}">
          </div>
        </div>

        <div class="bilingual">
          <div class="form-group"><label>Primary Theme Color</label>
            <input name="theme_color" type="color" value="${Store.escAttr(data.theme_color||'#0066cc')}"></div>
          <div class="form-group"><label>Default Theme Mode</label>
            <select name="theme_mode">
              <option value="light" ${data.theme_mode==='light'?'selected':''}>Light Mode</option>
              <option value="dark" ${data.theme_mode==='dark'?'selected':''}>Dark Mode</option>
            </select></div>
        </div>

        <h3>Fonts</h3>
        <div class="bilingual">
          <div class="form-group"><label>Base Font - English</label>
            <input name="font_family" value="${Store.escAttr(data.font_family||"'Noto Sans', sans-serif")}"></div>
          <div class="form-group"><label>Base Font - Arabic</label>
            <input name="font_family_ar" dir="ltr" value="${Store.escAttr(data.font_family_ar||"'Noto Sans Arabic', sans-serif")}"></div>
        </div>

        <div class="form-group"><label>Base Font Size</label>
          <input name="font_size" value="${Store.escAttr(data.font_size||'14px')}"></div>

        <div class="bilingual">
          <div class="form-group"><label>Header Title Font - English</label>
            <input name="header_title_font_family" value="${Store.escAttr(data.header_title_font_family||"'Montserrat', sans-serif")}"></div>
          <div class="form-group"><label>Header Title Font - Arabic</label>
            <input name="header_title_font_family_ar" dir="ltr" value="${Store.escAttr(data.header_title_font_family_ar||"'Noto Sans Arabic', sans-serif")}"></div>
        </div>

        <div class="form-group"><label>Header Title Font Size</label>
          <input name="header_title_font_size" value="${Store.escAttr(data.header_title_font_size||'2.5rem')}"></div>

        <h3>Gradient Header Colors</h3>
        <div class="gradient-settings">
          ${[1,2,3,4,5].map(i => `
            <label>Color ${i}
              <input type="color" name="gradient_color_${i}"
                     value="${Store.escAttr(data[`gradient_color_${i}`] || ['#ff007f','#7f00ff','#00e5ff','#00ff7f','#ffbe00'][i-1])}">
            </label>`).join('')}
        </div>

        <h3>Social Media / Statistics</h3>
        <label class="check-line">
          <input type="checkbox" name="show_social_icons" style="width:auto" ${data.show_social_icons?'checked':''}>
          Show Instagram and WhatsApp links
        </label>

        <div class="bilingual">
          <div class="form-group"><label>Instagram URL</label>
            <input type="url" name="instagram_url" value="${Store.escAttr(data.instagram_url||'')}"></div>
          <div class="form-group"><label>WhatsApp URL</label>
            <input type="url" name="whatsapp_url" value="${Store.escAttr(data.whatsapp_url||'')}"></div>
        </div>

        <label class="check-line">
          <input type="checkbox" name="show_stats" style="width:auto" ${data.show_stats?'checked':''}>
          Show Website Statistics Bar in Footer
        </label>


        <h3>Transactional Email</h3>
        <p class="muted">
          Resend API credentials are stored only in Supabase Edge Function Secrets, never here.
          The sender address must belong to a domain verified in Resend.
        </p>

        <div class="bilingual">
          <div class="form-group">
            <label>Sender Name</label>
            <input name="email_from_name" value="${Store.escAttr(data.email_from_name||data.site_name||'')}">
          </div>
          <div class="form-group">
            <label>Sender Email Address</label>
            <input name="email_from_address" type="email" value="${Store.escAttr(data.email_from_address||'')}"
                   placeholder="orders@yourdomain.com">
          </div>
        </div>

        <div class="form-group">
          <label>Admin Order Notification Email</label>
          <input name="admin_notification_email" type="email"
                 value="${Store.escAttr(data.admin_notification_email||'')}">
        </div>

        <label class="check-line">
          <input type="checkbox" name="send_welcome_email" style="width:auto" ${data.send_welcome_email?'checked':''}>
          Send welcome email when a new profile is created
        </label>

        <label class="check-line">
          <input type="checkbox" name="send_order_customer_emails" style="width:auto" ${data.send_order_customer_emails!==false?'checked':''}>
          Send customer order submission and status emails
        </label>

        <label class="check-line">
          <input type="checkbox" name="send_admin_new_order_email" style="width:auto" ${data.send_admin_new_order_email?'checked':''}>
          Send admin email when a new order is submitted
        </label>

        <div style="margin-top:14px">
          <button class="btn success">Save Settings</button>
        </div>
      </form>
    `;

    document.getElementById('settings-form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);

      const payload = {};
      for (const [key,value] of fd.entries()) payload[key] = value;
      payload.show_social_icons = fd.has('show_social_icons');
      payload.show_stats = fd.has('show_stats');
      payload.send_welcome_email = fd.has('send_welcome_email');
      payload.send_order_customer_emails = fd.has('send_order_customer_emails');
      payload.send_admin_new_order_email = fd.has('send_admin_new_order_email');

      const result = await db.from('site_settings').update(payload).eq('id',1);
      if (result.error) return this.err(result.error);

      // A settings save can affect global typography, header mode, colors and footer.
      // Reloading the current URL guarantees every component starts from the same saved state.
      try { sessionStorage.setItem('sf_flash', 'Site settings saved.'); } catch (_) {}
      location.reload();
    };
  },

  csvEscape(value) {
    const s = String(value ?? '');
    return `"${s.replaceAll('"','""')}"`;
  },

  downloadCsv(filename, headers, rows) {
    const body = [
      headers.map(x => this.csvEscape(x)).join(','),
      ...rows.map(row => headers.map(h => this.csvEscape(row[h])).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + body], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;

    for (let i=0; i<text.length; i++) {
      const ch = text[i];

      if (quoted) {
        if (ch === '"') {
          if (text[i+1] === '"') {
            field += '"';
            i++;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') quoted = true;
        else if (ch === ',') {
          row.push(field);
          field = '';
        } else if (ch === '\n') {
          row.push(field.replace(/\r$/,''));
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }

    if (field.length || row.length) {
      row.push(field.replace(/\r$/,''));
      rows.push(row);
    }

    const clean = rows.filter(r => r.some(v => String(v).trim() !== ''));
    if (!clean.length) return [];

    const headers = clean[0].map((h,i) =>
      (i===0 ? h.replace(/^\uFEFF/,'') : h).trim()
    );

    return clean.slice(1).map(values => {
      const obj = {};
      headers.forEach((h,i) => obj[h] = values[i] ?? '');
      return obj;
    });
  },

  async csv() {
    document.getElementById('admin-body').innerHTML = `
      <h2>CSV Data Import & Export</h2>
      <p class="muted">
        Listed Items and Included Content use separate CSV files. Included Content uses one row
        per entry so very large lists are not limited by spreadsheet-cell length.
      </p>

      <div class="card csv-actions">
        <button id="export-items" class="btn secondary">Export Listed Items CSV</button>
        <button id="export-content" class="btn secondary">Export Included Content CSV</button>
      </div>

      <div class="admin-grid">
        <form id="import-items-form" class="panel">
          <h3>Import Listed Items CSV</h3>
          <input id="items-csv-file" type="file" accept=".csv,text/csv" required>
          <p class="muted">Existing UUID rows are updated; rows without an ID are inserted.</p>
          <button class="btn success">Import Listed Items CSV</button>
        </form>

        <form id="import-content-form" class="panel">
          <h3>Import Included Content CSV</h3>
          <input id="content-csv-file" type="file" accept=".csv,text/csv" required>
          <p class="muted">product_id must refer to an existing listed item.</p>
          <button class="btn success">Import Included Content CSV</button>
        </form>
      </div>
    `;

    document.getElementById('export-items').onclick = async () => {
      const { data, error } = await db.from('products').select('*').order('sort_order');
      if (error) return this.err(error);

      const headers = [
        'id','title','title_ar','description','description_ar',
        'price_usd','discounted_price_usd','stock_quantity','status',
        'paypal_link','category_id','type_id','sort_order','active'
      ];
      this.downloadCsv(`listed_items_export_${new Date().toISOString().slice(0,10)}.csv`, headers, data||[]);
      Store.alert('Listed Items CSV exported.');
    };

    document.getElementById('export-content').onclick = async () => {
      const { data, error } = await db.from('included_content').select('*').order('product_id').order('sort_order');
      if (error) return this.err(error);

      const headers = ['id','product_id','name','sort_order'];
      this.downloadCsv(`included_content_export_${new Date().toISOString().slice(0,10)}.csv`, headers, data||[]);
      Store.alert('Included Content CSV exported.');
    };

    document.getElementById('import-items-form').onsubmit = async event => {
      event.preventDefault();
      const file = document.getElementById('items-csv-file').files[0];
      if (!file) return;

      const rows = this.parseCsv(await file.text());
      if (!rows.length) return this.err(new Error('CSV contains no data rows.'));

      let inserted = 0, updated = 0;

      for (const row of rows) {
        const payload = {
          title: String(row.title||'').trim(),
          title_ar: String(row.title_ar||'').trim() || null,
          description: row.description || null,
          description_ar: row.description_ar || null,
          price_usd: Number(row.price_usd||0),
          discounted_price_usd: String(row.discounted_price_usd||'').trim()
            ? Number(row.discounted_price_usd) : null,
          stock_quantity: Math.max(0, Number(row.stock_quantity||0)),
          status: row.status || 'out_of_stock',
          paypal_link: row.paypal_link || null,
          category_id: row.category_id || null,
          type_id: row.type_id || null,
          sort_order: Number(row.sort_order||999999),
          active: !['0','false','no'].includes(String(row.active||'true').toLowerCase())
        };

        if (!payload.title) return this.err(new Error('Every product row requires a title.'));

        let result;
        if (String(row.id||'').trim()) {
          result = await db.from('products').update(payload).eq('id', row.id.trim());
          updated++;
        } else {
          result = await db.from('products').insert(payload);
          inserted++;
        }

        if (result.error) return this.err(result.error);
      }

      await Products.load();
      Store.alert(`CSV import completed: ${inserted} inserted, ${updated} updated.`);
    };

    document.getElementById('import-content-form').onsubmit = async event => {
      event.preventDefault();
      const file = document.getElementById('content-csv-file').files[0];
      if (!file) return;

      const rows = this.parseCsv(await file.text());
      if (!rows.length) return this.err(new Error('CSV contains no data rows.'));

      let inserted = 0, updated = 0;

      for (const row of rows) {
        if (!row.product_id || !row.name) {
          return this.err(new Error('Every Included Content row requires product_id and name.'));
        }

        const payload = {
          product_id: row.product_id.trim(),
          name: row.name,
          name_ar: null,
          sort_order: Number(row.sort_order||0)
        };

        let result;
        if (String(row.id||'').trim()) {
          result = await db.from('included_content').update(payload).eq('id', row.id.trim());
          updated++;
        } else {
          result = await db.from('included_content').insert(payload);
          inserted++;
        }

        if (result.error) return this.err(result.error);
      }

      await Products.load();
      Store.alert(`Included Content import completed: ${inserted} inserted, ${updated} updated.`);
    };
  }

};