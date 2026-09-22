const db = window.supabaseClient;


// ============================================================
// SITE SETTINGS
// ============================================================

async function loadSiteSettings() {

    const status = document.getElementById('connection-status');

    const { data, error } = await db
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error(error);

        status.textContent =
            'Supabase connection failed: ' + error.message;

        return;
    }

    document.getElementById('site-name').textContent =
        data.site_name || 'StoreFront';

    document.getElementById('site-description').textContent =
        data.site_description || '';

    document.title =
        data.site_name || 'StoreFront';

    status.textContent =
        'Supabase connection successful.';
}


// ============================================================
// PRODUCTS
// ============================================================

async function loadProducts() {

    const container = document.getElementById('products');

    const { data, error } = await db
        .from('products')
        .select(`
            id,
            title,
            title_ar,
            description,
            description_ar,
            price_usd,
            discounted_price_usd,
            stock_quantity,
            status,
            active,
            sort_order
        `)
        .eq('active', true)
        .order('sort_order', {
            ascending: true
        });

    if (error) {

        console.error(error);

        container.textContent =
            'Unable to load products: ' + error.message;

        return;
    }

    if (!data || data.length === 0) {

        container.textContent =
            'No items currently available for sale.';

        return;
    }

    container.innerHTML = '';

    for (const product of data) {

        const card = document.createElement('article');

        const title = document.createElement('h3');
        title.textContent = product.title;

        const price = document.createElement('p');

        if (
            product.discounted_price_usd !== null &&
            Number(product.discounted_price_usd) > 0 &&
            Number(product.discounted_price_usd) <
                Number(product.price_usd)
        ) {

            price.textContent =
                `${Number(product.discounted_price_usd).toFixed(2)} USD ` +
                `(was ${Number(product.price_usd).toFixed(2)} USD)`;

        } else {

            price.textContent =
                `${Number(product.price_usd).toFixed(2)} USD`;

        }

        card.appendChild(title);
        card.appendChild(price);

        container.appendChild(card);
    }
}


// ============================================================
// AUTHENTICATION UI
// ============================================================

async function refreshAuthUI() {

    const loggedOut =
        document.getElementById('logged-out-section');

    const loggedIn =
        document.getElementById('logged-in-section');

    const adminConfirmation =
        document.getElementById('admin-confirmation');


    const {
        data: { user }
    } = await db.auth.getUser();


    if (!user) {

        loggedOut.hidden = false;
        loggedIn.hidden = true;
        adminConfirmation.hidden = true;

        return;
    }


    loggedOut.hidden = true;
    loggedIn.hidden = false;

    document.getElementById('user-email').textContent =
        user.email || '';


    // Get the user's profile.

    const { data: profile, error } = await db
        .from('profiles')
        .select(`
            username,
            first_name,
            last_name,
            role
        `)
        .eq('id', user.id)
        .single();


    if (error) {

        console.error(error);

        document.getElementById('username').textContent =
            'Unable to load';

        document.getElementById('user-role').textContent =
            'Unknown';

        return;
    }


    document.getElementById('username').textContent =
        profile.username || '-';

    document.getElementById('user-role').textContent =
        profile.role || 'customer';


    adminConfirmation.hidden =
        profile.role !== 'admin';
}


// ============================================================
// LOGIN
// ============================================================

document
    .getElementById('login-form')
    .addEventListener('submit', async event => {

        event.preventDefault();

        const message =
            document.getElementById('login-message');

        message.textContent = 'Logging in...';


        const email =
            document.getElementById('login-email')
                .value
                .trim();

        const password =
            document.getElementById('login-password')
                .value;


        const { error } =
            await db.auth.signInWithPassword({
                email,
                password
            });


        if (error) {

            console.error(error);

            message.textContent =
                'Login failed: ' + error.message;

            return;
        }


        message.textContent =
            'Login successful.';

        document.getElementById('login-form').reset();

        await refreshAuthUI();
    });


// ============================================================
// LOGOUT
// ============================================================

document
    .getElementById('logout-button')
    .addEventListener('click', async () => {

        await db.auth.signOut();

        await refreshAuthUI();
    });


// ============================================================
// AUTH STATE CHANGES
// ============================================================

db.auth.onAuthStateChange(() => {

    setTimeout(() => {
        refreshAuthUI();
    }, 0);

});


// ============================================================
// START APPLICATION
// ============================================================

async function startStoreFront() {

    await loadSiteSettings();

    await loadProducts();

    await refreshAuthUI();
}


startStoreFront();
