const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

const resolveServiceKey = () =>
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET ||
  process.env.SUPABASE_KEY;

function getSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = resolveServiceKey();

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client misconfigured: SUPABASE_URL or service key missing');
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
