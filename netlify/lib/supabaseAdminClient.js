const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

function getSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }

  cachedClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'cn-admin/updateAttendance',
      },
    },
  });

  return cachedClient;
}

module.exports = { getSupabaseAdminClient };
