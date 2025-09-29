const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!url || !serviceKey) {
  console.warn(
    'Supabase client missing configuration variables (SUPABASE_URL, SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY).'
  );
}

// Export a preconfigured Supabase client using env variables
const supabase = createClient(url, serviceKey);

module.exports = { supabase };
