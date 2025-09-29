const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!url || !serviceKey) {
  console.warn('Supabase client missing configuration variables.');
}

// Export a preconfigured Supabase client using env variables
const supabase = createClient(url, serviceKey);

module.exports = { supabase };
