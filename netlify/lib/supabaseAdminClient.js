const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

const resolveServiceKey = () => {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { key: process.env.SUPABASE_SERVICE_ROLE_KEY, source: 'SUPABASE_SERVICE_ROLE_KEY' };
  }

  if (process.env.SUPABASE_SERVICE_KEY) {
    return { key: process.env.SUPABASE_SERVICE_KEY, source: 'SUPABASE_SERVICE_KEY' };
  }

  if (process.env.SUPABASE_SECRET) {
    return { key: process.env.SUPABASE_SECRET, source: 'SUPABASE_SECRET' };
  }

  if (process.env.SUPABASE_KEY) {
    return { key: process.env.SUPABASE_KEY, source: 'SUPABASE_KEY' };
  }

  return { key: null, source: null };
};

function getSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const { key: serviceKey, source } = resolveServiceKey();

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }

  if (source !== 'SUPABASE_SERVICE_ROLE_KEY') {
    console.warn(
      `Using Supabase admin key from ${source}. Please configure SUPABASE_SERVICE_ROLE_KEY for production deployments.`,
    );
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
