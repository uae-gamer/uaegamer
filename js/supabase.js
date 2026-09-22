(() => {
  const c = window.STOREFRONT_CONFIG || {};
  if (!c.SUPABASE_URL || !c.SUPABASE_KEY || c.SUPABASE_URL.includes('YOUR_')) {
    throw new Error('Copy your working Supabase URL and publishable key into js/config.js');
  }
  window.db = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
})();