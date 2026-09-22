const { SUPABASE_URL, SUPABASE_KEY } = window.STOREFRONT_CONFIG;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase configuration is missing.');
}

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
