window.Admin = {
  tabs: [
    ['items','Listed Items'],
    ['categories','Categories'],
    ['types','Types'],
    ['textbar','Text Bar'],
    ['users','Registered Users'],
    ['audit','Audit Log'],
    ['security','Security Audit'],
    ['backup','Backup and Health'],
    ['email_templates','Email Templates'],
    ['email_log','Email Delivery Log'],
    ['orders','Orders'],
    ['report','Revenue Report'],
    ['statistics','Statistics and Reports'],
    ['messages','Contact Messages'],
    ['pages','Footer Pages'],
    ['guides','Custom Pages'],
    ['settings','Site Settings'],
    ['csv','CSV Data']
  ],

  pageSizes: {
    items: 50,
    orders: 25,
    users: 50,
    messages: 50,
  },

  pager(page, pages, total, label='items') {
    if (pages <= 1) return `<div class="muted">${Number(total||0).toLocaleString()} ${label}</div>`;
    return `
      <div class="pagination admin-pagination">
        <button type="button" class="mini page-prev" ${page<=1?'disabled':''}>Previous</button>
        <span>Page ${page} of ${pages} • ${Number(total||0).toLocaleString()} ${label}</span>
        <button type="button" class="mini page-next" ${page>=pages?'disabled':''}>Next</button>
      </div>
    `;
  },


  async render(tab='items') {
    if (Store.state.profile?.role !== 'admin') {
      Store.view('<div class="alert err">Admin access required.</div>');
      return;
    }

    const sortedTabs = [...this.tabs].sort((a,b) => a[1].localeCompare(b[1], 'en'));

    Store.view(`
      <div class="admin-section-picker">
        <label for="admin-section-select"><strong>Admin Section</strong></label>
        <select id="admin-section-select">
          ${sortedTabs.map(([key,name]) =>
            `<option value="${key}" ${key===tab?'selected':''}>${name}</option>`
          ).join('')}
        </select>
      </div>
      <div id="admin-body"></div>
    `);

    document.getElementById('admin-section-select').onchange = event => {
      const key = event.target.value;
      const route = `admin/${key}`;
      if (location.hash.slice(1) === route) this.render(key);
      else location.hash = route;
    };

    await this[tab]();
  },

  err(error) {
    console.error(error);
    Store.alert(error?.message || String(error), 'err');
  },

  productForm(product=null, suggestedOrder=1) {
    const p = product || {};
    const editing = Boolean(product);

    return `
      <form id="product-form" class="panel">
        <h3>${editing ? 'Edit Listed Item' : 'Create Listed Item'}</h3>

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
            <input name="sort_order" type="number" value="${p.sort_order ?? suggestedOrder}">
          </div>
          <div class="form-group">
            <label style="margin-top:28px">
              <input name="active" type="checkbox" style="width:auto" ${p.active===false?'':'checked'}>
              Active
            </label>
          </div>
        </div>

        <button class="btn success">${editing ? 'Save Listed Item' : 'Create Listed Item'}</button>
        ${editing ? `<button type="button" id="cancel-edit" class="btn secondary">Cancel</button>` : ''}
      </form>
    `;
  },

  async items(editId=null, page=1, search='') {
    const perPage = this.pageSizes.items;
    const offset = (page - 1) * perPage;
    const term = String(search || '').trim();

    let query = db.from('products')
      .select('*', { count:'exact' })
      .order('sort_order', { ascending:true })
      .order('created_at', { ascending:false })
      .range(offset, offset + perPage - 1);

    if (term) query = query.ilike('title', `%${term}%`);

    const [pageResult, maxOrderResult, editResult] = await Promise.all([
      query,
      db.from('products').select('sort_order').order('sort_order',{ascending:false}).limit(1),
      editId ? db.from('products').select('*').eq('id',editId).maybeSingle() : Promise.resolve({data:null,error:null})
    ]);

    if (pageResult.error) return this.err(pageResult.error);
    if (maxOrderResult.error) return this.err(maxOrderResult.error);
    if (editResult.error) return this.err(editResult.error);

    const products = pageResult.data || [];
    const total = Number(pageResult.count || 0);
    const pages = Math.max(1, Math.ceil(total / perPage));

    if (page > pages) return this.items(editId, pages, term);

    const editProduct = editResult.data || null;
    const suggestedOrder = Number(maxOrderResult.data?.[0]?.sort_order || 0) + 1;
    const host = document.getElementById('admin-body');

    host.innerHTML = `
      <h2>Manage Listed Items (${total.toLocaleString()})</h2>

      ${this.productForm(editProduct, suggestedOrder)}

      <div class="included-admin-toolbar">
        <input id="admin-product-search" type="search"
               placeholder="Search listed items by English title..."
               value="${Store.escAttr(term)}">
      </div>

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
                  <button class="btn edit-product" data-id="${p.id}">Edit Item</button>
                  <button class="btn secondary manage-product" data-id="${p.id}">Manage Images, Content and Expenses</button>
                  <button class="btn danger delete-product" data-id="${p.id}">Delete</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7">No listed items found.</td></tr>'}
          </tbody>
        </table>
      </div>

      ${this.pager(page, pages, total, 'items')}
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
        sort_order: Number(fd.get('sort_order') || suggestedOrder),
        active: fd.has('active')
      };

      const result = editProduct
        ? await db.from('products').update(payload).eq('id', editProduct.id)
        : await db.from('products').insert(payload);

      if (result.error) return this.err(result.error);

      await Products.load();
      Store.alert(editProduct ? 'Listed item updated.' : 'Listed item added.');
      await this.items(null, page, term);
    };

    document.getElementById('cancel-edit')?.addEventListener('click', () => this.items(null,page,term));

    let searchTimer;
    document.getElementById('admin-product-search').oninput = event => {
      clearTimeout(searchTimer);
      const value = event.target.value.trim();
      searchTimer = setTimeout(() => this.items(null,1,value),250);
    };

    host.querySelector('.page-prev')?.addEventListener('click', () => this.items(null,page-1,term));
    host.querySelector('.page-next')?.addEventListener('click', () => this.items(null,page+1,term));

    host.querySelectorAll('.edit-product').forEach(b => {
      b.onclick = () => this.items(b.dataset.id, page, term);
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
        await this.items(null,page,term);
      };
    });
  },

  async manageProduct(productId) {
    const [pRes, iRes, eRes] = await Promise.all([
      db.from('products').select('*').eq('id', productId).single(),
      db.from('product_images').select('*').eq('product_id', productId).order('sort_order'),
      db.from('product_expenses').select('*').eq('product_id', productId).order('sort_order')
    ]);

    if (pRes.error) return this.err(pRes.error);
    if (iRes.error) return this.err(iRes.error);
    if (eRes.error) return this.err(eRes.error);

    const product = pRes.data;
    const images = iRes.data || [];
    const expenses = eRes.data || [];
    const host = document.getElementById('admin-body');

    let includedPage = 1;
    let includedSearch = '';
    const includedPerPage = 50;

    const renderIncluded = async () => {
      const offset = (includedPage - 1) * includedPerPage;

      let query = db
        .from('included_content')
        .select('*', { count:'exact' })
        .eq('product_id', productId)
        .order('sort_order', { ascending:true })
        .order('created_at', { ascending:true })
        .range(offset, offset + includedPerPage - 1);

      if (includedSearch) {
        query = query.ilike('name', `%${includedSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) return this.err(error);

      const rows = data || [];
      const total = Number(count || 0);
      const pages = Math.max(1, Math.ceil(total / includedPerPage));

      if (includedPage > pages) {
        includedPage = pages;
        return renderIncluded();
      }

      const listHost = document.getElementById('included-content-list');
      if (!listHost) return;

      listHost.innerHTML = `
        <div class="included-admin-toolbar">
          <input id="included-search" type="search"
                 placeholder="Search Included Content..."
                 value="${Store.escAttr(includedSearch)}">
          <span class="muted">${total.toLocaleString()} entries</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Content</th><th>Order</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td><input class="content-name" data-id="${row.id}" value="${Store.escAttr(row.name||'')}"></td>
                  <td><input class="content-order" data-id="${row.id}" type="number" value="${Number(row.sort_order||0)}"></td>
                  <td>
                    <button class="btn danger delete-content" data-id="${row.id}">Delete</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="3">No Included Content found.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button class="mini included-prev" ${includedPage<=1?'disabled':''}>Previous</button>
          <span>Page ${includedPage} of ${pages}</span>
          <button class="mini included-next" ${includedPage>=pages?'disabled':''}>Next</button>
        </div>

        ${rows.length ? `<button id="save-content-page" class="btn">Save Visible Included Content Changes</button>` : ''}
      `;

      let timer;
      document.getElementById('included-search').oninput = event => {
        clearTimeout(timer);
        const value = event.target.value.trim();
        timer = setTimeout(() => {
          includedSearch = value;
          includedPage = 1;
          renderIncluded();
        }, 250);
      };

      listHost.querySelector('.included-prev')?.addEventListener('click', () => {
        if (includedPage > 1) {
          includedPage--;
          renderIncluded();
        }
      });

      listHost.querySelector('.included-next')?.addEventListener('click', () => {
        if (includedPage < pages) {
          includedPage++;
          renderIncluded();
        }
      });

      document.getElementById('save-content-page')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const fields = Array.from(listHost.querySelectorAll('.content-name'));
        const payload = fields.map(nameField => {
          const id = nameField.dataset.id;
          const orderField = listHost.querySelector(`.content-order[data-id="${CSS.escape(id)}"]`);
          return {
            id,
            name: nameField.value.trim(),
            sort_order: Number(orderField?.value || 0)
          };
        });

        Store.setBusy(button, true, 'Saving…');
        const result = await db.rpc('admin_batch_update_included_content', { p_rows:payload });
        Store.setBusy(button, false);

        if (result.error) return this.err(result.error);

        Store.alert(`${Number(result.data || payload.length)} Included Content changes saved.`);
        renderIncluded();
      });

      listHost.querySelectorAll('.delete-content').forEach(button => {
        button.onclick = async () => {
          if (!confirm('Delete this Included Content entry?')) return;

          const result = await db.from('included_content')
            .delete()
            .eq('id', button.dataset.id);

          if (result.error) return this.err(result.error);

          Store.alert('Included Content deleted.');
          renderIncluded();
        };
      });
    };

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
        <h3>Included Content</h3>
        <p class="muted">
          Displayed exactly as entered. No Arabic translation is applied to this list.
          Large lists are paginated so thousands of entries remain manageable.
        </p>

        <form id="content-form" class="inline-admin-form">
          <input name="name" placeholder="Included Content name" required>
          <input name="sort_order" type="number" placeholder="Order (auto if blank)">
          <button class="btn success">Add Included Content</button>
        </form>

        <div class="inline-actions" style="margin-bottom:12px">
          <button id="remove-all-included-content" type="button" class="btn danger">
            Remove All Included Content
          </button>
        </div>

        <div class="included-import-box">
          <h4>Bulk Import from CSV</h4>
          <p class="muted">
            Recommended for large lists. CSV columns: <code>name,sort_order</code>.
            Only <code>name</code> is required. Exact duplicate names are skipped.
          </p>

          <div class="inline-actions">
            <button id="download-included-template" type="button" class="btn secondary">
              Download CSV Template
            </button>
          </div>

          <div class="form-group">
            <input id="included-csv-file" type="file" accept=".csv,text/csv">
          </div>

          <div id="included-csv-preview" class="muted"></div>
          <button id="import-included-csv" type="button" class="btn primary" disabled>
            Import Included Content
          </button>
          <div id="included-import-progress"></div>
        </div>

        <div id="included-content-list"></div>
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

    document.getElementById('save-image-order')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const fields = Array.from(document.querySelectorAll('.image-order'));
      const payload = fields.map(field => ({
        id:field.dataset.id,
        sort_order:Number(field.value||0)
      }));

      Store.setBusy(button, true, 'Saving…');
      const result = await db.rpc('admin_batch_update_product_images', { p_rows:payload });
      Store.setBusy(button, false);

      if (result.error) return this.err(result.error);

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

    document.getElementById('remove-all-included-content')?.addEventListener('click', async event => {
      const button = event.currentTarget;

      const countResult = await db.from('included_content')
        .select('id', { count:'exact', head:true })
        .eq('product_id', productId);

      if (countResult.error) return this.err(countResult.error);

      const total = Number(countResult.count || 0);

      if (!total) {
        Store.alert('This item has no Included Content to remove.');
        return;
      }

      const confirmed = confirm(
        `Remove ALL ${total.toLocaleString()} Included Content entr${total === 1 ? 'y' : 'ies'} from "${product.title}"?\n\n` +
        'This affects the entire item, including entries not visible on the current page or current search. This action cannot be undone.'
      );

      if (!confirmed) return;

      Store.setBusy(button, true, 'Removing…');

      const result = await db.from('included_content')
        .delete()
        .eq('product_id', productId);

      Store.setBusy(button, false);

      if (result.error) return this.err(result.error);

      includedPage = 1;
      includedSearch = '';
      Store.alert(`Removed all ${total.toLocaleString()} Included Content entr${total === 1 ? 'y' : 'ies'}.`);
      await renderIncluded();
    });

    document.getElementById('content-form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const name = String(fd.get('name')||'').trim();

      if (!name) return;

      const existing = await db.from('included_content')
        .select('id')
        .eq('product_id', productId)
        .ilike('name', name)
        .limit(1);

      if (existing.error) return this.err(existing.error);
      if (existing.data?.length) {
        return this.err(new Error('This Included Content name already exists for this product.'));
      }

      let sortOrder = Number(fd.get('sort_order'));
      if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
        const maxRes = await db.from('included_content')
          .select('sort_order')
          .eq('product_id', productId)
          .order('sort_order', { ascending:false })
          .limit(1);

        if (maxRes.error) return this.err(maxRes.error);
        sortOrder = Number(maxRes.data?.[0]?.sort_order||0) + 1;
      }

      const result = await db.from('included_content').insert({
        product_id: productId,
        name,
        name_ar: null,
        sort_order: sortOrder
      });

      if (result.error) return this.err(result.error);

      event.currentTarget.reset();
      Store.alert('Included Content added.');
      includedPage = 1;
      includedSearch = '';
      await renderIncluded();
    };

    const csvInput = document.getElementById('included-csv-file');
    const preview = document.getElementById('included-csv-preview');
    const importButton = document.getElementById('import-included-csv');
    const progress = document.getElementById('included-import-progress');

    document.getElementById('download-included-template').onclick = () => {
      this.downloadCsv(
        'included-content-template.csv',
        ['name','sort_order'],
        [
          { name:'Example Content 1', sort_order:1 },
          { name:'Example Content 2', sort_order:2 }
        ]
      );
    };

    csvInput.onchange = async () => {
      const file = csvInput.files?.[0];
      importButton.disabled = true;
      preview.textContent = '';
      progress.textContent = '';

      if (!file) return;

      try {
        const rows = this.parseCsv(await file.text())
          .map(row => ({
            name: String(row.name || '').trim(),
            sort_order: String(row.sort_order || '').trim()
          }))
          .filter(row => row.name);

        if (!rows.length) {
          preview.textContent = 'No valid rows found. CSV must contain a name column.';
          return;
        }

        preview.innerHTML = `
          <strong>${rows.length.toLocaleString()} rows detected.</strong><br>
          Preview: ${rows.slice(0,5).map(row => Store.esc(row.name)).join(' • ')}
          ${rows.length > 5 ? ' …' : ''}
        `;

        importButton.disabled = false;
      } catch (e) {
        preview.textContent = e.message || String(e);
      }
    };

    importButton.onclick = async () => {
      const file = csvInput.files?.[0];
      if (!file) return;

      if (!confirm('Import this CSV into the current product? Exact duplicate names will be skipped.')) return;

      importButton.disabled = true;
      csvInput.disabled = true;

      try {
        const parsed = this.parseCsv(await file.text())
          .map(row => ({
            name: String(row.name || '').trim(),
            sort_order: String(row.sort_order || '').trim()
          }))
          .filter(row => row.name);

        const existingRes = await db.from('included_content')
          .select('name,sort_order')
          .eq('product_id', productId);

        if (existingRes.error) throw existingRes.error;

        const existingNames = new Set(
          (existingRes.data || []).map(row => String(row.name||'').trim().toLowerCase())
        );

        const seen = new Set();
        let skipped = 0;
        let maxSort = (existingRes.data || []).reduce(
          (max,row) => Math.max(max, Number(row.sort_order||0)),
          0
        );

        const ready = [];

        for (const row of parsed) {
          const key = row.name.toLowerCase();

          if (existingNames.has(key) || seen.has(key)) {
            skipped++;
            continue;
          }

          seen.add(key);

          let sortOrder = Number(row.sort_order);
          if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
            maxSort += 1;
            sortOrder = maxSort;
          }

          ready.push({
            product_id: productId,
            name: row.name,
            name_ar: null,
            sort_order: sortOrder
          });
        }

        if (!ready.length) {
          progress.innerHTML = `<div class="alert">Nothing to import. ${skipped.toLocaleString()} duplicate row(s) skipped.</div>`;
          return;
        }

        const batchSize = 200;
        let imported = 0;
        const failed = [];

        progress.innerHTML = `
          <div class="alert">Importing 0 / ${ready.length.toLocaleString()}...</div>
          <progress max="${ready.length}" value="0"></progress>
        `;

        for (let offset=0; offset<ready.length; offset+=batchSize) {
          const batch = ready.slice(offset, offset + batchSize);
          const result = await db.from('included_content').insert(batch);

          if (result.error) {
            failed.push({
              from: offset + 1,
              to: offset + batch.length,
              message: result.error.message
            });
          } else {
            imported += batch.length;
          }

          const processed = Math.min(offset + batch.length, ready.length);
          progress.innerHTML = `
            <div class="alert">
              Imported ${imported.toLocaleString()} / ${ready.length.toLocaleString()}
              • Skipped ${skipped.toLocaleString()}
              ${failed.length ? `• Failed batches ${failed.length}` : ''}
            </div>
            <progress max="${ready.length}" value="${processed}"></progress>
          `;
        }

        progress.innerHTML = `
          <div class="alert ${failed.length?'':'ok'}">
            Import complete. Imported ${imported.toLocaleString()}
            • Skipped ${skipped.toLocaleString()}
            ${failed.length ? `• Failed batches ${failed.length}` : ''}
          </div>
        `;

        includedPage = 1;
        includedSearch = '';
        await renderIncluded();
      } catch (e) {
        progress.innerHTML = `<div class="alert err">${Store.esc(e.message || e)}</div>`;
      } finally {
        csvInput.disabled = false;
        importButton.disabled = false;
      }
    };

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

    document.getElementById('save-expenses')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const names = Array.from(document.querySelectorAll('.expense-name'));

      const payload = names.map(nameField => {
        const id = nameField.dataset.id;
        const typeField = document.querySelector(`.expense-type[data-id="${CSS.escape(id)}"]`);
        const valueField = document.querySelector(`.expense-value[data-id="${CSS.escape(id)}"]`);
        const orderField = document.querySelector(`.expense-order[data-id="${CSS.escape(id)}"]`);

        return {
          id,
          name:nameField.value.trim(),
          expense_type:typeField.value,
          expense_value:Number(valueField.value||0),
          sort_order:Number(orderField.value||0)
        };
      });

      Store.setBusy(button, true, 'Saving…');
      const result = await db.rpc('admin_batch_update_product_expenses', { p_rows:payload });
      Store.setBusy(button, false);

      if (result.error) return this.err(result.error);

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

    await renderIncluded();
  },

  async simpleTable(table, title, nameKey='name', arKey='name_ar') {
    const { data, error } = await db.from(table).select('*').order('sort_order');
    if (error) return this.err(error);

    const rows = data || [];
    const host = document.getElementById('admin-body');
    const editable = table === 'categories' || table === 'product_types';

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
                <td>
                  ${editable
                    ? `<input class="simple-name" data-id="${x.id}" value="${Store.escAttr(x[nameKey]||'')}">`
                    : Store.esc(x[nameKey]||'')}
                </td>
                <td dir="rtl">
                  ${editable
                    ? `<input class="simple-name-ar" data-id="${x.id}" dir="rtl" value="${Store.escAttr(x[arKey]||'')}">`
                    : Store.esc(x[arKey]||'')}
                </td>
                <td>
                  ${editable
                    ? `<input class="simple-order" data-id="${x.id}" type="number" value="${Number(x.sort_order||0)}">`
                    : Number(x.sort_order||0)}
                </td>
                <td>
                  ${editable ? `<button class="btn simple-save" data-id="${x.id}">Save</button>` : ''}
                  <button class="btn danger simple-del" data-id="${x.id}">Delete</button>
                </td>
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

    document.querySelectorAll('.simple-save').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const nameField = document.querySelector(`.simple-name[data-id="${CSS.escape(id)}"]`);
        const arField = document.querySelector(`.simple-name-ar[data-id="${CSS.escape(id)}"]`);
        const orderField = document.querySelector(`.simple-order[data-id="${CSS.escape(id)}"]`);

        const name = String(nameField?.value || '').trim();
        if (!name) return this.err(new Error('English name is required.'));

        Store.setBusy(btn, true, 'Saving…');

        const result = await db.from(table)
          .update({
            [nameKey]: name,
            [arKey]: String(arField?.value || '').trim() || null,
            sort_order: Number(orderField?.value || 0)
          })
          .eq('id', id);

        Store.setBusy(btn, false);

        if (result.error) return this.err(result.error);

        await Products.load();
        Store.alert(`${title} entry updated.`);
        await this.simpleTable(table,title,nameKey,arKey);
      };
    });

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

  async orders(showDeleted=false, page=1) {
    const perPage = this.pageSizes.orders;
    const offset = (page - 1) * perPage;

    let query = db.from('orders')
      .select('*,order_items(*),paypal_refunds(*)', { count:'exact' })
      .order(showDeleted ? 'deleted_at' : 'created_at',{ascending:false})
      .range(offset, offset + perPage - 1);

    query = showDeleted ? query.not('deleted_at','is',null) : query.is('deleted_at',null);

    const {data,error,count} = await query;
    if (error) return this.err(error);

    const rows = data || [];
    const total = Number(count || 0);
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) return this.orders(showDeleted, pages);

    document.getElementById('admin-body').innerHTML = `
      <div class="admin-title-row">
        <h2>${showDeleted ? 'Deleted Orders' : 'Manage Orders'} (${total.toLocaleString()})</h2>
        <button id="toggle-deleted-orders" class="btn secondary">
          ${showDeleted ? 'View Active Orders' : 'View Deleted Orders'}
        </button>
      </div>

      ${rows.map(o => `
        <div class="card admin-order-card ${showDeleted?'deleted-order-card':''}">
          <div class="admin-order-head">
            <div>
              <strong>Order #${Store.esc(o.order_number)}</strong><br>
              ${Store.esc((o.first_name||'')+' '+(o.last_name||''))}<br>
              ${Store.esc(o.email||'')}<br>
              ${Store.esc(o.mobile_number||'')}
              ${showDeleted ? `<br><span class="muted">Deleted: ${o.deleted_at?new Date(o.deleted_at).toLocaleString():''}</span>` : ''}
            </div>
            <div>
              <strong>${Number(o.total_usd||0).toFixed(2)} USD</strong><br>
              <span class="muted">${o.created_at?new Date(o.created_at).toLocaleString():''}</span><br>
              <span><strong>Payment:</strong> ${Store.esc(o.payment_status || 'unpaid')}</span>
              ${o.paypal_order_id ? `<br><small>PayPal Order: <code>${Store.esc(o.paypal_order_id)}</code></small>` : ''}
              ${o.paypal_capture_id ? `<br><small>Capture: <code>${Store.esc(o.paypal_capture_id)}</code></small>` : ''}
              ${o.paypal_payment_source ? `<br><small><strong>Payment Source:</strong> ${
                o.paypal_payment_source === 'card'
                  ? `Credit/Debit Card${o.paypal_card_brand ? ` • ${Store.esc(o.paypal_card_brand)}` : ''}${o.paypal_card_last_digits ? ` •••• ${Store.esc(o.paypal_card_last_digits)}` : ''}`
                  : 'PayPal'
              }</small>` : ''}
              ${(() => {
                const completedRefunds = (o.paypal_refunds || []).filter(r => r.status === 'completed');
                const refunded = completedRefunds.reduce((sum,r) => sum + Number(r.amount || 0), 0);
                if (!refunded) return '';
                const remaining = Math.max(0, Number(o.total_usd || 0) - refunded);
                return `<br><small><strong>Refunded:</strong> ${refunded.toFixed(2)} USD • Remaining: ${remaining.toFixed(2)} USD</small>`;
              })()}
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>PayPal Transaction ID</th></tr></thead>
              <tbody>${(o.order_items||[]).map(i => `
                <tr>
                  <td>${Store.esc(i.product_title||'')}</td>
                  <td>${Number(i.quantity||0)}</td>
                  <td>${Number(i.unit_price_usd||0).toFixed(2)} USD</td>
                  <td><code>${Store.esc(i.paypal_transaction_id||'N/A')}</code></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>

          ${(o.paypal_refunds || []).length ? `
            <div class="card" style="margin-top:10px">
              <strong>PayPal Refund History</strong>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Refund ID</th><th>Amount</th><th>Status</th><th>Reason</th><th>Stock Returned</th></tr></thead>
                  <tbody>
                    ${(o.paypal_refunds || []).slice().sort((a,b) => String(b.created_at||'').localeCompare(String(a.created_at||''))).map(r => `
                      <tr>
                        <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                        <td><code>${Store.esc(r.paypal_refund_id || 'Pending')}</code></td>
                        <td>${Number(r.amount || 0).toFixed(2)} ${Store.esc(r.currency || 'USD')}</td>
                        <td>${Store.esc(r.status || '')}</td>
                        <td>${Store.esc(r.reason || '')}</td>
                        <td>${r.stock_restored_at ? 'Yes' : 'No'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          ${showDeleted ? `
            <button class="btn success restore-order" data-id="${o.id}">Restore Order</button>
            <button class="btn secondary admin-receipt" data-id="${o.id}">Open Receipt</button>
          ` : `
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
            <button class="btn success save-order" data-id="${o.id}">Save Order Changes</button>
            <button class="btn secondary admin-receipt" data-id="${o.id}">Open Receipt</button>
            ${o.paypal_order_id ? `<button class="btn secondary reconcile-paypal-order" data-id="${o.id}">Reconcile PayPal</button>` : ''}
            ${o.paypal_capture_id && ['paid','partially_refunded'].includes(o.payment_status)
              ? `<button class="btn danger refund-paypal-order" data-id="${o.id}">Refund PayPal</button>`
              : ''}
            <button class="btn danger soft-delete-order" data-id="${o.id}">Delete Order from Reports</button>
          `}
        </div>
      `).join('') || `<div class="card">${showDeleted ? 'No deleted orders.' : 'No active orders yet.'}</div>`}

      ${this.pager(page, pages, total, 'orders')}
    `;

    document.getElementById('toggle-deleted-orders').onclick = () => this.orders(!showDeleted,1);
    document.querySelector('.page-prev')?.addEventListener('click', () => this.orders(showDeleted,page-1));
    document.querySelector('.page-next')?.addEventListener('click', () => this.orders(showDeleted,page+1));

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

        const result = await db.from('orders').update(patch).eq('id',id).is('deleted_at',null);
        if (result.error) return this.err(result.error);

        Store.alert('Order changes saved.');
        await this.orders(false,page);
      };
    });

    document.querySelectorAll('.refund-paypal-order').forEach(btn => {
      btn.onclick = async () => {
        const order = rows.find(o => String(o.id) === String(btn.dataset.id));
        if (!order) return;

        const completed = (order.paypal_refunds || []).filter(r => r.status === 'completed');
        const refunded = completed.reduce((sum,r) => sum + Number(r.amount || 0), 0);
        const remaining = Math.max(0, Number(order.total_usd || 0) - refunded);

        if (remaining <= 0) {
          Store.alert('This PayPal payment is already fully refunded.', 'err');
          return;
        }

        const entered = prompt(
          `Refund amount in USD.\nRemaining refundable balance: ${remaining.toFixed(2)} USD\n\nEnter ${remaining.toFixed(2)} for the full remaining balance, or a smaller amount for a partial refund:`,
          remaining.toFixed(2)
        );
        if (entered === null) return;

        const amount = Number(entered);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
          Store.alert(`Invalid refund amount. Maximum: ${remaining.toFixed(2)} USD`, 'err');
          return;
        }

        const fullRemaining = Math.abs(amount - remaining) < 0.005;
        const reason = prompt('Internal refund reason (recommended):', 'Customer refund') ?? '';
        const note = prompt('Optional note visible to the payer through PayPal:', '') ?? '';

        let restock = false;
        if (fullRemaining) {
          restock = confirm(
            'This refunds the full remaining PayPal balance.\n\nReturn ALL quantities from this order back to UAEGamer stock?\n\nChoose OK only if the sold items/content should become available for resale.'
          );
        }

        const paypalEnvironment = String(Store.state.settings?.paypal_environment || 'sandbox');
        const paypalLabel = paypalEnvironment === 'live' ? 'PayPal' : 'PayPal Sandbox';
        const warning = fullRemaining
          ? `Refund the full remaining ${remaining.toFixed(2)} USD through ${paypalLabel}?`
          : `Issue a PARTIAL refund of ${amount.toFixed(2)} USD through ${paypalLabel}?`;

        if (!confirm(`${warning}\n\nRefunds cannot normally be cancelled after PayPal processes them.`)) return;

        Store.setBusy(btn, true, 'Refunding…');

        try {
          const requestId = crypto.randomUUID();
          const { data, error } = await db.functions.invoke('paypal-refund', {
            body: {
              order_id:order.id,
              request_id:requestId,
              refund_mode:fullRemaining ? 'remaining' : 'partial',
              amount:fullRemaining ? null : amount,
              reason,
              note_to_payer:note,
              restock
            }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          Store.alert(
            `PayPal refund ${data?.refund_status || 'processed'}: ${data?.amount || amount.toFixed(2)} ${data?.currency || 'USD'}`
            + (data?.full_refund ? ' • Payment fully refunded' : ' • Payment partially refunded')
            + (data?.stock_restored ? ' • Stock restored' : '')
          );

          await this.orders(false,page);
        } catch (error) {
          let message = error?.message || String(error);
          try {
            if (error?.context?.json) {
              const body = await error.context.json();
              if (body?.error) message = body.error;
            }
          } catch (_) {}
          this.err(new Error(message));
          Store.setBusy(btn, false);
        }
      };
    });

    document.querySelectorAll('.reconcile-paypal-order').forEach(btn => {
      btn.onclick = async () => {
        Store.setBusy(btn, true, 'Checking…');
        try {
          const { data, error } = await db.functions.invoke('paypal-reconcile', {
            body: { order_id:btn.dataset.id }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const result = data?.results?.[0];
          Store.alert(
            result
              ? `PayPal reconciliation: ${result.status}${result.paypal_status ? ` • ${result.paypal_status}` : ''}`
              : 'PayPal reconciliation completed.'
          );
          await this.orders(false,page);
        } catch (error) {
          let message = error?.message || String(error);
          try {
            if (error?.context?.json) {
              const body = await error.context.json();
              if (body?.error) message = body.error;
            }
          } catch (_) {}
          this.err(new Error(message));
          Store.setBusy(btn, false);
        }
      };
    });

    document.querySelectorAll('.soft-delete-order').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this order from customer history, revenue, statistics and reports? The order will remain recoverable under Deleted Orders.')) return;

        const reason = prompt('Optional deletion reason:', 'Test or dummy order') || 'Deleted by administrator';
        const result = await db.from('orders').update({
          deleted_at: new Date().toISOString(),
          deleted_by: Store.state.user.id,
          deletion_reason: reason
        }).eq('id',btn.dataset.id).is('deleted_at',null);

        if (result.error) return this.err(result.error);
        Store.alert('Order moved to Deleted Orders and excluded from reports.');
        await this.orders(false,page);
      };
    });

    document.querySelectorAll('.restore-order').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Restore this order to customer history and reports?')) return;

        const result = await db.from('orders').update({
          deleted_at: null,
          deleted_by: null,
          deletion_reason: null
        }).eq('id',btn.dataset.id);

        if (result.error) return this.err(result.error);
        Store.alert('Order restored.');
        await this.orders(true,page);
      };
    });
  },

  async report() {
    const { data: orders, error } = await db.from('orders').select('*,order_items(*)').order('created_at',{ascending:false});
    if (error) return this.err(error);
    const included=(orders||[]).filter(o=>!o.deleted_at && !['cancelled','rejected'].includes(o.status));
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
    document.getElementById('admin-body').innerHTML=`<h2>Revenue Report</h2><p class="muted">Income is calculated from item selling prices only. Delivery charges, VAT and payment-gateway fees are excluded. Cancelled, rejected and deleted orders are excluded.</p><div class="stat-grid report-summary"><div class="stat"><span>Total Orders</span><strong>${rows.length.toLocaleString()}</strong></div><div class="stat"><span>Units Sold</span><strong>${units.toLocaleString()}</strong></div><div class="stat"><span>Item Income</span><strong>${income.toFixed(2)}</strong><small>USD</small></div><div class="stat"><span>Expenses</span><strong>${expenses.toFixed(2)}</strong><small>USD</small></div><div class="stat"><span>Net Revenue</span><strong>${(income-expenses).toFixed(2)}</strong><small>USD</small></div></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Income USD</th><th>Expenses USD</th><th>Net Revenue USD</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>#${Store.esc(r.number)}</strong></td><td>${r.date?new Date(r.date).toLocaleString():''}</td><td>${Store.esc(r.customer)}</td><td>${Store.statusBadge?Store.statusBadge(r.status):Store.esc(r.status)}</td><td>${r.income.toFixed(2)}</td><td>${r.expense.toFixed(2)}</td><td><strong>${r.profit.toFixed(2)}</strong></td></tr>`).join('')}</tbody></table></div>`;
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
      db.from('orders').select('id,status,created_at,deleted_at,order_items(quantity,unit_price_usd)').is('deleted_at',null),
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
    body.innerHTML=`<h2>Website Statistics and Reports</h2><p class="muted">Page views and anonymous unique visitors are tracked by date. Online Now uses visitor activity within the last five minutes. Cancelled, rejected and deleted orders are excluded from order/income totals.</p><div class="period-buttons"><button class="btn ${period==='daily'?'success':''}" data-period="daily">Daily</button><button class="btn ${period==='monthly'?'success':''}" data-period="monthly">Monthly</button><button class="btn ${period==='all'?'success':''}" data-period="all">All Time</button></div><div class="stat-grid stats-summary"><div class="stat"><span>Page Views</span><strong>${latest.page_views.toLocaleString()}</strong></div><div class="stat"><span>Unique Visitors</span><strong>${latest.unique_visitors.toLocaleString()}</strong></div><div class="stat"><span>Registered Users</span><strong>${latest.registered.toLocaleString()}</strong></div><div class="stat"><span>Online Now</span><strong>${online.toLocaleString()}</strong></div><div class="stat"><span>Peak Online</span><strong>${latest.peak_online.toLocaleString()}</strong></div><div class="stat"><span>Orders</span><strong>${latest.orders.toLocaleString()}</strong></div><div class="stat"><span>Income USD</span><strong>${latest.income.toFixed(2)}</strong></div><div class="stat"><span>Messages</span><strong>${latest.messages.toLocaleString()}</strong></div></div>${period!=='all'&&rows.length?'<div class="chart-grid"><div class="chart-card"><canvas id="traffic-chart" height="250"></canvas></div><div class="chart-card"><canvas id="business-chart" height="250"></canvas></div></div>':''}<div class="table-wrap"><table><thead><tr><th>Period</th><th>Page Views</th><th>Unique Visitors</th><th>Registered Users</th><th>Peak Online</th><th>Orders</th><th>Income</th><th>Messages</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${Store.esc(r.period)}</td><td>${r.page_views}</td><td>${r.unique_visitors}</td><td>${r.registered}</td><td>${r.peak_online}</td><td>${r.orders}</td><td>${r.income.toFixed(2)}</td><td>${r.messages}</td></tr>`).join('')}</tbody></table></div>`;
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

  async messages(page=1) {
    const perPage = this.pageSizes.messages;
    const offset = (page - 1) * perPage;

    const {data,error,count} = await db.from('messages')
      .select('*', { count:'exact' })
      .order('created_at',{ascending:false})
      .range(offset, offset + perPage - 1);

    if (error) return this.err(error);

    const rows = data || [];
    const total = Number(count || 0);
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) return this.messages(pages);

    document.getElementById('admin-body').innerHTML = `
      <h2>Contact Messages (${total.toLocaleString()})</h2>
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

      ${this.pager(page, pages, total, 'messages')}
    `;

    document.querySelector('.page-prev')?.addEventListener('click', () => this.messages(page-1));
    document.querySelector('.page-next')?.addEventListener('click', () => this.messages(page+1));

    document.querySelectorAll('.delete-message').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this message?')) return;
        const result = await db.from('messages').delete().eq('id',btn.dataset.id);
        if (result.error) return this.err(result.error);
        Store.alert('Message deleted.');
        await this.messages(page);
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

  async users(page=1) {
    const perPage = this.pageSizes.users;
    const body = document.getElementById('admin-body');
    body.innerHTML = '<div class="card">Loading registered users…</div>';

    let authResult;
    try {
      authResult = await this.callAdminUserFunction({ action:'list', page, per_page:perPage });
    } catch (error) {
      return this.err(error);
    }

    const authUsers = authResult.users || [];
    const ids = authUsers.map(u => u.id);
    const total = Number(authResult.total || authUsers.length || 0);
    const pages = Math.max(1, Math.ceil(total / perPage));

    if (page > pages) return this.users(pages);

    let profiles = [];
    if (ids.length) {
      const profileResponse = await db.from('profiles').select('*').in('id',ids);
      if (profileResponse.error) return this.err(profileResponse.error);

      const profileById = new Map((profileResponse.data || []).map(profile => [profile.id,profile]));
      profiles = ids.map(id => profileById.get(id)).filter(Boolean);
    }

    const authById = new Map(authUsers.map(u => [u.id,u]));

    body.innerHTML = `
      <h2>Manage Registered Users (${total.toLocaleString()})</h2>

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
            }).join('') || '<tr><td colspan="8">No registered users found on this page.</td></tr>'}
          </tbody>
        </table>
      </div>

      ${this.pager(page, pages, total, 'users')}

      <div id="user-editor"></div>
    `;

    body.querySelector('.page-prev')?.addEventListener('click', () => this.users(page-1));
    body.querySelector('.page-next')?.addEventListener('click', () => this.users(page+1));

    document.querySelectorAll('.edit-user').forEach(btn => {
      const profile = profiles.find(x => x.id === btn.dataset.id);
      const auth = authById.get(btn.dataset.id) || null;
      btn.onclick = () => this.editUserProfile(profile, auth, page);
    });
  },

  editUserProfile(user, authUser = null, page=1) {
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
      await this.users(page);
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
          await this.users(page);
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
          await this.users(page);
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

  async security() {
    const host = document.getElementById('admin-body');
    host.innerHTML = `
      <h2>Security Audit</h2>
      <p class="muted">
        Live checks against the deployed Supabase database. This supplements—not replaces—
        the Supabase Dashboard security advisors and RLS policy review.
      </p>
      <button id="run-security-audit" class="btn primary">Run Security Audit</button>
      <div id="security-audit-results" style="margin-top:12px"></div>
    `;

    const resultHost = document.getElementById('security-audit-results');

    document.getElementById('run-security-audit').onclick = async () => {
      resultHost.innerHTML = '<div class="card">Running security checks…</div>';

      const { data, error } = await db.rpc('storefront_security_audit');
      if (error) {
        resultHost.innerHTML = `<div class="alert err">${Store.esc(error.message)}</div>`;
        return;
      }

      const checks = data?.checks || [];
      const rank = { critical:0, warning:1, info:2, ok:3 };
      checks.sort((a,b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));

      resultHost.innerHTML = `
        <div class="security-checks">
          ${checks.map(check => `
            <section class="security-check security-${Store.escAttr(check.severity || 'info')}">
              <div class="security-check-head">
                <strong>${Store.esc(check.name || '')}</strong>
                <span>${Store.esc(String(check.severity || 'info').toUpperCase())}</span>
              </div>
              <div>${Store.esc(check.message || '')}</div>
              ${check.details !== null && check.details !== undefined
                ? `<details><summary>Details</summary><pre>${Store.esc(JSON.stringify(check.details, null, 2))}</pre></details>`
                : ''}
            </section>
          `).join('')}
        </div>
        <p class="muted">Checked: ${data?.checked_at ? new Date(data.checked_at).toLocaleString() : 'now'}</p>
      `;
    };
  },

  async callAdminBackup(payload) {
    const { data, error } = await db.functions.invoke('admin-backup', { body: payload });

    if (error) {
      let message = error.message || 'Backup/health function failed.';
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

  downloadJson(filename, payload) {
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async backup() {
    document.getElementById('admin-body').innerHTML = `
      <h2>Backup and System Health</h2>

      <div class="admin-grid backup-grid">
        <section class="panel">
          <h3>System Health</h3>
          <p class="muted">
            Checks common configuration and operational problems without changing data.
          </p>
          <button id="run-health" class="btn primary">Run Health Check</button>
          <div id="health-results" style="margin-top:12px"></div>
        </section>

        <section class="panel">
          <h3>Configuration Backup</h3>
          <p class="muted">
            Products, categories, images metadata, Included Content, expenses, pages,
            site settings and email templates. Recommended before major website changes.
          </p>
          <button id="backup-config" class="btn secondary">Export Configuration Backup</button>
        </section>

        <section class="panel">
          <h3>Full Logical Backup</h3>
          <p class="muted">
            Configuration plus customers, orders, messages, notifications, logs and analytics.
            Auth account metadata is included, but passwords and Supabase secrets are never exported.
          </p>
          <button id="backup-full" class="btn secondary">Export Full Data Backup</button>
        </section>
      </div>

      <div class="card backup-warning">
        <strong>Recovery safety</strong>
        <p>
          These JSON downloads are emergency/logical exports. Automatic browser-side restore is
          intentionally disabled because restoring the wrong file could overwrite orders or customer
          relationships. Use the documented Supabase recovery process for restoration.
        </p>
      </div>
    `;

    const healthHost = document.getElementById('health-results');

    document.getElementById('run-health').onclick = async () => {
      healthHost.innerHTML = '<div class="card">Running checks…</div>';

      try {
        const result = await this.callAdminBackup({ action:'health' });
        const h = result.health;

        healthHost.innerHTML = `
          <div class="health-summary health-${Store.escAttr(h.status)}">
            <strong>${Store.esc(String(h.status).toUpperCase())}</strong>
            — ${h.summary.critical} critical, ${h.summary.warnings} warnings
          </div>

          <div class="health-checks">
            ${(h.checks || []).map(c => `
              <div class="health-check health-${Store.escAttr(c.severity)}">
                <div>
                  <strong>${Store.esc(c.name)}</strong>
                  <div class="muted">${Store.esc(c.message || '')}</div>
                </div>
                <span>${c.count === null || c.count === undefined ? 'N/A' : Store.esc(c.count)}</span>
              </div>
            `).join('')}
          </div>

          <p class="muted">Checked: ${new Date(h.checked_at).toLocaleString()}</p>
        `;
      } catch (e) {
        healthHost.innerHTML = `<div class="alert err">${Store.esc(e.message || e)}</div>`;
      }
    };

    const exportBackup = async scope => {
      const button = scope === 'full'
        ? document.getElementById('backup-full')
        : document.getElementById('backup-config');

      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Preparing backup…';

      try {
        const result = await this.callAdminBackup({ action:'export', scope });
        const backup = result.backup;
        const stamp = String(backup.generated_at || new Date().toISOString())
          .replace(/[:.]/g,'-');

        this.downloadJson(
          `storefront-${scope}-backup-${stamp}.json`,
          backup
        );

        Store.alert(`${scope === 'full' ? 'Full data' : 'Configuration'} backup downloaded.`);
      } catch (e) {
        this.err(e);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };

    document.getElementById('backup-config').onclick = () => exportBackup('configuration');
    document.getElementById('backup-full').onclick = () => exportBackup('full');
  },

  async email_templates() {
    const { data, error } = await db
      .from('email_templates')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) return this.err(error);

    const rows = data || [];

    document.getElementById('admin-body').innerHTML = `
      <h2>Email Templates (${rows.length})</h2>
      <p class="muted">
        Edit the subject, HTML body and plain-text body used by transactional emails.
        Changes take effect on the next email; the Edge Function does not need to be redeployed.
      </p>

      <div class="card">
        <strong>Available placeholders</strong>
        <div class="template-placeholders">
          <code>{{site_name}}</code>
          <code>{{first_name}}</code>
          <code>{{last_name}}</code>
          <code>{{customer_name}}</code>
          <code>{{email}}</code>
          <code>{{order_number}}</code>
          <code>{{order_status}}</code>
          <code>{{order_total}}</code>
          <code>{{order_items_html}}</code>
          <code>{{order_items_text}}</code>
        </div>
        <p class="muted">
          Use <code>{{order_items_html}}</code> only in the HTML body and
          <code>{{order_items_text}}</code> in the plain-text body.
        </p>
      </div>

      ${rows.map(row => `
        <form class="panel email-template-form" data-key="${Store.escAttr(row.template_key)}">
          <div class="email-template-heading">
            <div>
              <h3>${Store.esc(row.display_name)}</h3>
              <code>${Store.esc(row.template_key)}</code>
            </div>
            <label class="check-line">
              <input type="checkbox" name="enabled" style="width:auto" ${row.enabled?'checked':''}>
              Enabled
            </label>
          </div>

          <div class="form-group">
            <label>Subject</label>
            <input name="subject_template" value="${Store.escAttr(row.subject_template||'')}" required>
          </div>

          <div class="form-group">
            <label>HTML Body</label>
            <textarea name="html_template" rows="10" class="code-editor" required>${Store.esc(row.html_template||'')}</textarea>
          </div>

          <div class="form-group">
            <label>Plain-Text Body</label>
            <textarea name="text_template" rows="10" class="code-editor" required>${Store.esc(row.text_template||'')}</textarea>
          </div>

          <div class="template-preview-actions">
            <button class="btn success">Save Email Template</button>
            <button type="button" class="btn secondary preview-template">Preview Email</button>
          </div>
        </form>
      `).join('')}
    `;

    const sample = {
      site_name: Store.state.settings?.site_name || 'UAEGamer',
      first_name: 'Ahmed',
      last_name: 'Customer',
      customer_name: 'Ahmed Customer',
      email: 'customer@example.com',
      order_number: '12345',
      order_status: 'Verified / Confirmed',
      order_total: '129.00',
      order_items_html: `
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px">Example Product</td><td style="padding:6px">1</td><td style="padding:6px">129.00 USD</td></tr>
        </table>`,
      order_items_text: 'Example Product x1 — 129.00 USD'
    };

    const replaceTokens = (template, values) =>
      String(template || '').replace(/{{\\s*([a-z0-9_]+)\\s*}}/gi, (_, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{{${key}}}`
      );

    document.querySelectorAll('.email-template-form').forEach(form => {
      form.onsubmit = async event => {
        event.preventDefault();
        const f = event.currentTarget;
        const submitButton = f.querySelector('button[type="submit"]');
        if (submitButton?.disabled) return;
        Store.setBusy(submitButton, true, 'Saving…');
        const fd = new FormData(f);

        const payload = {
          subject_template: String(fd.get('subject_template')||''),
          html_template: String(fd.get('html_template')||''),
          text_template: String(fd.get('text_template')||''),
          enabled: fd.has('enabled')
        };

        const result = await db
          .from('email_templates')
          .update(payload)
          .eq('template_key', f.dataset.key);

        if (result.error) {
          Store.setBusy(submitButton, false);
          return this.err(result.error);
        }

        Store.setBusy(submitButton, false);
        Store.alert('Email template saved.');
      };

      form.querySelector('.preview-template').onclick = () => {
        const fd = new FormData(form);
        const subject = replaceTokens(fd.get('subject_template'), sample);
        const htmlBody = replaceTokens(fd.get('html_template'), sample);
        const textBody = replaceTokens(fd.get('text_template'), sample);

        Store.modal(`
          <h2>${Store.esc(subject)}</h2>
          <h3>HTML Preview</h3>
          <div class="email-template-preview">${Store.sanitizeHtml(htmlBody)}</div>
          <h3>Plain-Text Preview</h3>
          <pre class="plain-email-preview">${Store.esc(textBody)}</pre>
        `);
      };
    });
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
        const submitButton = f.querySelector('button[type="submit"]');
        if (submitButton?.disabled) return;
        Store.setBusy(submitButton, true, 'Saving…');
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

    const englishFonts = [
      ["'Inter', sans-serif",'Inter'],
      ["'Roboto', sans-serif",'Roboto'],
      ["'Open Sans', sans-serif",'Open Sans'],
      ["'Lato', sans-serif",'Lato'],
      ["'Montserrat', sans-serif",'Montserrat'],
      ["'Poppins', sans-serif",'Poppins'],
      ["'Nunito', sans-serif",'Nunito'],
      ["'Raleway', sans-serif",'Raleway'],
      ["'Ubuntu', sans-serif",'Ubuntu'],
      ["'Noto Sans', sans-serif",'Noto Sans'],
      ["Tahoma, sans-serif",'Tahoma'],
      ["Arial, sans-serif",'Arial']
    ];

    const arabicFonts = [
      ["'Noto Sans Arabic', sans-serif",'Noto Sans Arabic'],
      ["'Cairo', sans-serif",'Cairo'],
      ["'Tajawal', sans-serif",'Tajawal'],
      ["'Almarai', sans-serif",'Almarai'],
      ["'IBM Plex Sans Arabic', sans-serif",'IBM Plex Sans Arabic'],
      ["'Noto Kufi Arabic', sans-serif",'Noto Kufi Arabic'],
      ["Tahoma, sans-serif",'Tahoma']
    ];

    const fontSelect = (name, value, options) => `
      <select name="${name}">
        ${options.map(([css,label]) =>
          `<option value="${Store.escAttr(css)}" ${String(value||'')===css?'selected':''}>${Store.esc(label)}</option>`
        ).join('')}
      </select>`;

    document.getElementById('admin-body').innerHTML = `
      <h2>Site Configuration and Customization</h2>

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

        <div class="form-group">
          <label>Default Language for First-Time Visitors</label>
          <select name="default_language">
            <option value="en" ${(data.default_language||'en')==='en'?'selected':''}>English</option>
            <option value="ar" ${data.default_language==='ar'?'selected':''}>Arabic</option>
          </select>
          <small class="muted">
            Applied only when a visitor has never selected a language before. Returning visitors keep their own saved language preference.
          </small>
        </div>

        <h3>Fonts</h3>
        <div class="bilingual">
          <div class="form-group"><label>Base Font - English</label>
            ${fontSelect('font_family', data.font_family||"'Noto Sans', sans-serif", englishFonts)}</div>
          <div class="form-group"><label>Base Font - Arabic</label>
            ${fontSelect('font_family_ar', data.font_family_ar||"'Noto Sans Arabic', sans-serif", arabicFonts)}</div>
        </div>

        <div class="form-group"><label>Base Font Size</label>
          <input name="font_size" value="${Store.escAttr(data.font_size||'14px')}"></div>

        <div class="bilingual">
          <div class="form-group"><label>Header Title Font - English</label>
            ${fontSelect('header_title_font_family', data.header_title_font_family||"'Montserrat', sans-serif", englishFonts)}</div>
          <div class="form-group"><label>Header Title Font - Arabic</label>
            ${fontSelect('header_title_font_family_ar', data.header_title_font_family_ar||"'Noto Sans Arabic', sans-serif", arabicFonts)}</div>
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

        <h3>Social Media and Footer Features</h3>
        <label class="check-line">
          <input type="checkbox" name="show_social_icons" style="width:auto" ${data.show_social_icons?'checked':''}>
          Show social media links
        </label>

        <div class="social-settings-grid">
          <div class="social-setting-card">
            <h4>Instagram</h4>
            <div class="bilingual">
              <div class="form-group"><label>Button Name - English</label>
                <input name="instagram_name" value="${Store.escAttr(data.instagram_name||'Instagram')}"></div>
              <div class="form-group"><label>Button Name - Arabic</label>
                <input name="instagram_name_ar" dir="rtl" value="${Store.escAttr(data.instagram_name_ar||'إنستغرام')}"></div>
            </div>
            <div class="bilingual">
              <div class="form-group"><label>URL</label>
                <input type="url" name="instagram_url" value="${Store.escAttr(data.instagram_url||'')}"></div>
              <div class="form-group"><label>Button Color</label>
                <input type="color" name="instagram_color" value="${Store.escAttr(data.instagram_color||'#E1306C')}"></div>
            </div>
          </div>

          <div class="social-setting-card">
            <h4>WhatsApp</h4>
            <div class="bilingual">
              <div class="form-group"><label>Button Name - English</label>
                <input name="whatsapp_name" value="${Store.escAttr(data.whatsapp_name||'WhatsApp')}"></div>
              <div class="form-group"><label>Button Name - Arabic</label>
                <input name="whatsapp_name_ar" dir="rtl" value="${Store.escAttr(data.whatsapp_name_ar||'واتساب')}"></div>
            </div>
            <div class="bilingual">
              <div class="form-group"><label>URL</label>
                <input type="url" name="whatsapp_url" value="${Store.escAttr(data.whatsapp_url||'')}"></div>
              <div class="form-group"><label>Button Color</label>
                <input type="color" name="whatsapp_color" value="${Store.escAttr(data.whatsapp_color||'#25D366')}"></div>
            </div>
          </div>

          <div class="social-setting-card">
            <h4>Snapchat</h4>
            <div class="bilingual">
              <div class="form-group"><label>Button Name - English</label>
                <input name="snapchat_name" value="${Store.escAttr(data.snapchat_name||'Snapchat')}"></div>
              <div class="form-group"><label>Button Name - Arabic</label>
                <input name="snapchat_name_ar" dir="rtl" value="${Store.escAttr(data.snapchat_name_ar||'سناب شات')}"></div>
            </div>
            <div class="bilingual">
              <div class="form-group"><label>URL</label>
                <input type="url" name="snapchat_url" value="${Store.escAttr(data.snapchat_url||'')}"></div>
              <div class="form-group"><label>Button Color</label>
                <input type="color" name="snapchat_color" value="${Store.escAttr(data.snapchat_color||'#FFFC00')}"></div>
            </div>
          </div>

          <div class="social-setting-card">
            <h4>TikTok</h4>
            <div class="bilingual">
              <div class="form-group"><label>Button Name - English</label>
                <input name="tiktok_name" value="${Store.escAttr(data.tiktok_name||'TikTok')}"></div>
              <div class="form-group"><label>Button Name - Arabic</label>
                <input name="tiktok_name_ar" dir="rtl" value="${Store.escAttr(data.tiktok_name_ar||'تيك توك')}"></div>
            </div>
            <div class="bilingual">
              <div class="form-group"><label>URL</label>
                <input type="url" name="tiktok_url" value="${Store.escAttr(data.tiktok_url||'')}"></div>
              <div class="form-group"><label>Button Color</label>
                <input type="color" name="tiktok_color" value="${Store.escAttr(data.tiktok_color||'#000000')}"></div>
            </div>
          </div>
        </div>

        <label class="check-line">
          <input type="checkbox" name="show_stats" style="width:auto" ${data.show_stats?'checked':''}>
          Show Website Statistics Bar in Footer
        </label>

        <label class="check-line">
          <input type="checkbox" name="show_notification_button" style="width:auto" ${data.show_notification_button!==false?'checked':''}>
          Show Website Notification Button
        </label>


        <h3>Payment Configuration</h3>
        <p class="muted">
          PayPal automation is being introduced gradually. Manual verification remains the safe default.
          PayPal Client Secret and webhook verification secrets must stay in Supabase Edge Function Secrets,
          never in this form or the public website code.
        </p>

        <div class="bilingual">
          <div class="form-group">
            <label>Payment Mode</label>
            <select name="payment_mode">
              <option value="manual" ${(data.payment_mode||'manual')==='manual'?'selected':''}>Manual Verification</option>
              <option value="automatic_fallback" ${data.payment_mode==='automatic_fallback'?'selected':''}>Automatic + Manual Fallback</option>
              <option value="automatic" ${data.payment_mode==='automatic'?'selected':''}>Automatic PayPal Only</option>
            </select>
          </div>

          <div class="form-group">
            <label>PayPal Environment</label>
            <select name="paypal_environment" id="paypal-environment-select">
              <option value="sandbox" ${(data.paypal_environment||'sandbox')==='sandbox'?'selected':''}>Sandbox</option>
              <option value="live" ${data.paypal_environment==='live'?'selected':''} ${data.paypal_live_enabled===true?'':'disabled'}>
                Live${data.paypal_live_enabled===true?'':' — Run Step 36 SQL first'}
              </option>
            </select>
            <small class="muted">Use Live only after the Live Preflight below passes with zero critical failures.</small>
          </div>

          <div class="form-group">
            <label>Automatic Checkout Stock Reservation (minutes)</label>
            <input
              name="paypal_reservation_minutes"
              type="number"
              min="5"
              max="60"
              step="1"
              value="${Store.escAttr(data.paypal_reservation_minutes || 20)}">
            <small class="muted">Recommended: 20 minutes. Applies only to automatic PayPal/card checkout.</small>
          </div>
        </div>

        <label class="check-line">
          <input type="checkbox" name="paypal_card_payments_enabled" style="width:auto" ${data.paypal_card_payments_enabled===true?'checked':''}>
          Enable Direct Credit/Debit Card Checkout
        </label>
        <p class="muted">
          Uses PayPal-hosted Card Fields. The option is shown to customers only when PayPal reports
          Advanced Credit and Debit Card Payments as eligible for the current merchant, buyer and transaction.
          UAEGamer never receives or stores the full card number or CVV.
        </p>

        <div class="card">
          <h4>Card Eligibility Diagnostic</h4>
          <p class="muted">
            Admin-only. Tests the currently active PayPal environment with a sample USD 10.00 checkout context.
            It shows PayPal's eligibility result for PayPal, basic card, and Advanced Card Fields.
            No payment/order is created and no secret value is displayed.
          </p>
          <button type="button" id="paypal-card-eligibility-check" class="btn secondary">
            Check Card Eligibility
          </button>
          <div id="paypal-card-eligibility-result" style="margin-top:10px"></div>
        </div>

        <div class="alert">
          Step 36 supports both Sandbox and Live with separate server-side credentials.
          Keep Automatic + Manual Fallback during initial Live validation so you can immediately revert customer checkout if needed.
        </div>

        <div class="paypal-sandbox-test">
          <h4>PayPal Sandbox Tests</h4>
          <p class="muted">
            Admin-only. These tests use PayPal Sandbox and never charge real money.
            They do not modify UAEGamer customer orders or product stock.
          </p>

          <div class="inline-actions">
            <button type="button" id="paypal-sandbox-test" class="btn secondary">
              Test API Connection
            </button>
            <button type="button" id="paypal-sandbox-full-test" class="btn primary">
              Test Approval + Capture
            </button>
          </div>

          <p class="muted">
            For the full test, PayPal will open its Sandbox approval page. Sign in using a
            <strong>PayPal Sandbox Personal/Buyer test account</strong>, not your real PayPal account.
            After approval, PayPal returns you to UAEGamer and the website securely captures the $1.00 Sandbox order.
          </p>

          <div id="paypal-sandbox-test-result" style="margin-top:8px"></div>
        </div>

        <div class="alert">
          <strong>PayPal operations:</strong>
          automatic PayPal orders can be reconciled or refunded from Admin → Orders.
          Partial refunds never restore stock automatically; a full refund offers an explicit stock-restoration choice.
        </div>

        <div class="paypal-readiness-panel card">
          <h4>Step 36 — PayPal Live Cutover</h4>
          <p class="muted">
            Keep the site on Sandbox until Live credentials and a separate Live webhook are configured.
            The Live Preflight validates them without exposing secret values or changing customer traffic.
          </p>
          <div class="inline-actions">
            <button type="button" id="paypal-readiness-check" class="btn secondary">
              Check Active Environment
            </button>
            <button type="button" id="paypal-live-preflight" class="btn primary">
              Run Live Preflight
            </button>
          </div>
          <div id="paypal-readiness-result" style="margin-top:10px"></div>
        </div>

        <h3>Animated Background</h3>
        <p class="muted">
          Optional Vanta.js WebGL background. Vanta and Three.js are loaded only when this feature is enabled.
          Devices requesting reduced motion will not run the animation.
        </p>

        <label class="check-line">
          <input type="checkbox" name="vanta_enabled" style="width:auto" ${data.vanta_enabled?'checked':''}>
          Enable Animated Vanta Background
        </label>

        <label class="check-line">
          <input type="checkbox" name="vanta_mobile_enabled" style="width:auto" ${data.vanta_mobile_enabled?'checked':''}>
          Enable Animated Background on Mobile
        </label>

        <div class="bilingual">
          <div class="form-group"><label>Vanta Effect</label>
            <select name="vanta_effect">
              ${[
                ['waves','Waves'],['birds','Birds'],['clouds','Clouds'],['fog','Fog'],
                ['net','Net'],['cells','Cells'],['dots','Dots']
              ].map(([value,label]) =>
                `<option value="${value}" ${(data.vanta_effect||'waves')===value?'selected':''}>${label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group"><label>Animation Primary Color</label>
            <input type="color" name="vanta_primary_color" value="${Store.escAttr(data.vanta_primary_color||data.theme_color||'#0066cc')}">
          </div>
          <div class="form-group"><label>Animation Background Color</label>
            <input type="color" name="vanta_background_color" value="${Store.escAttr(data.vanta_background_color||'#101827')}">
          </div>
        </div>

        <label class="check-line">
          <input type="checkbox" name="vanta_mouse_controls" style="width:auto" ${data.vanta_mouse_controls!==false?'checked':''}>
          Enable Mouse Interaction
        </label>
        <label class="check-line">
          <input type="checkbox" name="vanta_touch_controls" style="width:auto" ${data.vanta_touch_controls!==false?'checked':''}>
          Enable Touch Interaction
        </label>

        <h3>Website Favicon</h3>
        <p class="muted">
          PNG or ICO is recommended. JPG and WEBP are also accepted. Maximum file size: 2 MB.
        </p>
        ${data.favicon_url ? `
          <div class="favicon-preview-row">
            <img src="${Store.escAttr(data.favicon_url)}" alt="Current favicon" class="favicon-preview">
            <a class="btn secondary" href="${Store.escAttr(data.favicon_url)}" target="_blank" rel="noopener noreferrer">Open Current Favicon</a>
          </div>` : ''}
        <div class="form-group">
          <label>Upload New Favicon</label>
          <input type="file" name="favicon_upload" accept=".png,.ico,.jpg,.jpeg,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp">
        </div>
        <label class="check-line">
          <input type="checkbox" name="remove_favicon" style="width:auto">
          Remove Current Favicon
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
          <button class="btn success">Save Site Settings</button>
        </div>
      </form>
    `;

    document.getElementById('paypal-sandbox-test')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const resultHost = document.getElementById('paypal-sandbox-test-result');

      if (!resultHost) return;

      Store.setBusy(button, true, 'Testing…');
      resultHost.innerHTML = '<div class="alert">Connecting to PayPal Sandbox…</div>';

      try {
        const { data: result, error } = await db.functions.invoke('paypal-create-order', {
          body: { action:'test' }
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        resultHost.innerHTML = `
          <div class="alert ok">
            PayPal Sandbox connection successful.<br>
            Order ID: <strong>${Store.esc(result?.paypal_order_id || '')}</strong><br>
            Status: ${Store.esc(result?.paypal_status || '')}
            • Test amount: ${Store.esc(result?.amount || '1.00')} ${Store.esc(result?.currency || 'USD')}
          </div>
        `;
      } catch (error) {
        let message = error?.message || String(error);

        try {
          const context = error?.context;
          if (context?.json) {
            const body = await context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}

        resultHost.innerHTML = `<div class="alert err">${Store.esc(message)}</div>`;
      } finally {
        Store.setBusy(button, false);
      }
    });

    document.getElementById('paypal-sandbox-full-test')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const resultHost = document.getElementById('paypal-sandbox-test-result');

      if (!resultHost) return;

      Store.setBusy(button, true, 'Creating…');
      resultHost.innerHTML = '<div class="alert">Creating PayPal Sandbox approval order…</div>';

      try {
        const { data: result, error } = await db.functions.invoke('paypal-create-order', {
          body: { action:'test_approval' }
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        if (!result?.approve_url) throw new Error('PayPal did not return an approval URL.');

        try {
          sessionStorage.setItem('paypal_sandbox_test_order', String(result.paypal_order_id || ''));
        } catch (_) {}

        location.href = result.approve_url;
      } catch (error) {
        let message = error?.message || String(error);

        try {
          const context = error?.context;
          if (context?.json) {
            const body = await context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}

        resultHost.innerHTML = `<div class="alert err">${Store.esc(message)}</div>`;
        Store.setBusy(button, false);
      }
    });

    document.getElementById('paypal-card-eligibility-check')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const host = document.getElementById('paypal-card-eligibility-result');
      if (!host) return;

      Store.setBusy(button, true, 'Checking…');
      host.innerHTML = '<div class="alert">Checking PayPal card eligibility…</div>';

      let diagnosticScript = null;

      try {
        const { data:tokenData, error:tokenError } = await db.functions.invoke('paypal-card-client-token', {
          body:{ diagnostic:true }
        });

        if (tokenError) throw tokenError;
        if (tokenData?.error || !tokenData?.accessToken) {
          throw new Error(tokenData?.error || 'Unable to generate the PayPal client token.');
        }

        const environment = tokenData.environment === 'live' ? 'live' : 'sandbox';
        const scriptSrc = environment === 'live'
          ? 'https://www.paypal.com/web-sdk/v6/core'
          : 'https://www.sandbox.paypal.com/web-sdk/v6/core';

        if (!window.paypal?.createInstance) {
          diagnosticScript = document.createElement('script');
          diagnosticScript.id = 'paypal-admin-web-sdk-v6';
          diagnosticScript.async = true;
          diagnosticScript.src = scriptSrc;

          await new Promise((resolve,reject) => {
            diagnosticScript.onload = resolve;
            diagnosticScript.onerror = () => reject(new Error('Unable to load PayPal Web SDK v6.'));
            document.head.appendChild(diagnosticScript);
          });
        }

        if (!window.paypal?.createInstance) {
          throw new Error('PayPal Web SDK v6 did not initialize.');
        }

        const sdk = await window.paypal.createInstance({
          clientToken: tokenData.accessToken,
          components:['card-fields'],
          pageType:'checkout',
        });

        const methods = await sdk.findEligibleMethods({
          currencyCode:'USD',
          amount:'10.00',
        });

        const paypalEligible = methods.isEligible('paypal');
        const cardEligible = methods.isEligible('card');
        const advancedEligible = methods.isEligible('advanced_cards');

        host.innerHTML = `
          <div class="alert ${advancedEligible ? 'ok' : ''}">
            <strong>${advancedEligible ? 'Advanced Card Fields Eligible' : 'Advanced Card Fields Not Eligible'}</strong><br>
            Environment: ${Store.esc(environment.toUpperCase())} • Sample transaction: 10.00 USD
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Eligible</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr>
                  <td>PayPal</td>
                  <td><strong>${paypalEligible ? 'YES' : 'NO'}</strong></td>
                  <td>Standard PayPal checkout</td>
                </tr>
                <tr>
                  <td>Basic Card</td>
                  <td><strong>${cardEligible ? 'YES' : 'NO'}</strong></td>
                  <td>General card eligibility reported by PayPal</td>
                </tr>
                <tr>
                  <td>Advanced Cards</td>
                  <td><strong>${advancedEligible ? 'YES' : 'NO'}</strong></td>
                  <td>Required for UAEGamer embedded Card Fields</td>
                </tr>
              </tbody>
            </table>
          </div>
          ${advancedEligible ? `
            <p class="muted">PayPal currently reports this merchant/browser context as eligible for embedded Card Fields.</p>
          ` : `
            <p class="muted">
              UAEGamer is working correctly by hiding Card Fields. PayPal currently reports
              <code>advanced_cards = false</code> for this context. Check PayPal production onboarding/merchant approval.
            </p>
          `}
        `;
      } catch (error) {
        let message = error?.message || String(error);
        try {
          if (error?.context?.json) {
            const body = await error.context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}

        console.error('Card eligibility diagnostic failed:', error);
        host.innerHTML = `<div class="alert err">${Store.esc(message)}</div>`;
      } finally {
        Store.setBusy(button, false);
      }
    });

    const runPayPalReadiness = async (button, action) => {
      const host = document.getElementById('paypal-readiness-result');
      if (!host) return;

      Store.setBusy(button, true, action === 'live_preflight' ? 'Testing Live…' : 'Checking…');
      host.innerHTML = `<div class="alert">${action === 'live_preflight'
        ? 'Testing Live credentials and Live webhook while customer traffic remains unchanged…'
        : 'Checking the currently active PayPal environment…'}</div>`;

      try {
        const { data:result, error } = await db.functions.invoke('paypal-readiness', {
          body:{ action }
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        const icon = status => status === 'pass' ? '✓' : status === 'warn' ? '!' : '✕';

        host.innerHTML = `
          <div class="alert ${result?.ready ? 'ok' : 'err'}">
            <strong>${result?.ready ? 'READINESS CHECK PASSED' : 'READINESS CHECK FAILED'}</strong><br>
            Target: ${Store.esc(String(result?.target_environment || '').toUpperCase())}
            • Critical failures: ${Number(result?.critical_failures || 0)}
            • Warnings: ${Number(result?.warnings || 0)}
            <br><small>${action === 'live_preflight' && result?.ready
              ? 'Live credentials/webhook passed preflight. You may switch Payment Environment to Live when ready for the controlled real transaction.'
              : 'Review every warning/failure before proceeding.'}</small>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead>
              <tbody>
                ${(result?.checks || []).map(check => `
                  <tr>
                    <td><strong>${icon(check.status)} ${Store.esc(String(check.status || '').toUpperCase())}</strong></td>
                    <td>${Store.esc(check.label || check.key || '')}</td>
                    <td>${Store.esc(check.detail || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (error) {
        let message = error?.message || String(error);
        try {
          if (error?.context?.json) {
            const body = await error.context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}
        host.innerHTML = `<div class="alert err">${Store.esc(message)}</div>`;
      } finally {
        Store.setBusy(button, false);
      }
    };

    document.getElementById('paypal-readiness-check')?.addEventListener('click', event => {
      runPayPalReadiness(event.currentTarget, 'audit');
    });

    document.getElementById('paypal-live-preflight')?.addEventListener('click', event => {
      runPayPalReadiness(event.currentTarget, 'live_preflight');
    });

    document.getElementById('settings-form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton?.disabled) return;
      Store.setBusy(submitButton, true, 'Saving…');
      const fd = new FormData(form);

      const requestedPayPalEnvironment = String(fd.get('paypal_environment') || 'sandbox');
      if (requestedPayPalEnvironment === 'live' && String(data.paypal_environment || 'sandbox') !== 'live') {
        const confirmed = confirm(
          'LIVE PAYPAL ACTIVATION\n\nThis will make automatic checkout use real PayPal credentials and real money.\n\nOnly continue if the Live Preflight passed and you are ready to perform the controlled real transaction.'
        );
        if (!confirmed) {
          Store.setBusy(submitButton, false);
          return;
        }
      }

      const payload = {};
      for (const [key,value] of fd.entries()) {
        if (value instanceof File) continue;
        if (key === 'remove_favicon') continue;
        payload[key] = value;
      }

      payload.show_social_icons = fd.has('show_social_icons');
      payload.show_stats = fd.has('show_stats');
      payload.show_notification_button = fd.has('show_notification_button');
      payload.vanta_enabled = fd.has('vanta_enabled');
      payload.vanta_mobile_enabled = fd.has('vanta_mobile_enabled');
      payload.vanta_mouse_controls = fd.has('vanta_mouse_controls');
      payload.vanta_touch_controls = fd.has('vanta_touch_controls');
      payload.send_welcome_email = fd.has('send_welcome_email');
      payload.send_order_customer_emails = fd.has('send_order_customer_emails');
      payload.send_admin_new_order_email = fd.has('send_admin_new_order_email');
      payload.paypal_card_payments_enabled = fd.has('paypal_card_payments_enabled');

      const faviconFile = fd.get('favicon_upload');
      const removeFavicon = fd.has('remove_favicon');
      const oldFaviconUrl = String(data.favicon_url || '');

      if (removeFavicon) {
        payload.favicon_url = null;
      }

      if (faviconFile instanceof File && faviconFile.size > 0) {
        const fileExt = String(faviconFile.name || '').split('.').pop().toLowerCase();
        const typeByExt = {
          png:'image/png',
          ico:'image/x-icon',
          jpg:'image/jpeg',
          jpeg:'image/jpeg',
          webp:'image/webp'
        };
        const normalizedType = faviconFile.type || typeByExt[fileExt] || '';
        const allowed = new Set([
          'image/png','image/x-icon','image/vnd.microsoft.icon','image/jpeg','image/webp'
        ]);

        if (!allowed.has(normalizedType) || !['png','ico','jpg','jpeg','webp'].includes(fileExt)) {
          Store.setBusy(submitButton, false);
          return this.err(new Error('Unsupported favicon file type.'));
        }

        if (faviconFile.size > 2 * 1024 * 1024) {
          Store.setBusy(submitButton, false);
          return this.err(new Error('Favicon must be 2 MB or smaller.'));
        }

        const storedExt = fileExt === 'jpeg' ? 'jpg' : fileExt;
        const path = `favicons/favicon-${Date.now()}-${crypto.randomUUID()}.${storedExt}`;

        const upload = await db.storage.from('site-assets').upload(path, faviconFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: normalizedType
        });

        if (upload.error) {
          Store.setBusy(submitButton, false);
          return this.err(upload.error);
        }

        const publicUrl = db.storage.from('site-assets').getPublicUrl(path)?.data?.publicUrl;
        if (!publicUrl) {
          Store.setBusy(submitButton, false);
          return this.err(new Error('Unable to obtain public favicon URL.'));
        }

        payload.favicon_url = publicUrl;
      }

      const result = await db.from('site_settings').update(payload).eq('id',1);
      if (result.error) {
        Store.setBusy(submitButton, false);
        return this.err(result.error);
      }

      if ((removeFavicon || payload.favicon_url) && oldFaviconUrl && oldFaviconUrl !== payload.favicon_url) {
        try {
          const marker = '/storage/v1/object/public/site-assets/';
          const pos = oldFaviconUrl.indexOf(marker);
          if (pos >= 0) {
            const oldPath = decodeURIComponent(oldFaviconUrl.slice(pos + marker.length).split('?')[0]);
            await db.storage.from('site-assets').remove([oldPath]);
          }
        } catch (cleanupError) {
          console.warn('Old favicon cleanup failed:', cleanupError);
        }
      }

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
      <h2>CSV Data Import and Export</h2>
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