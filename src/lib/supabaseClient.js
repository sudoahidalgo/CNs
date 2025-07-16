const { createClient } = require('@supabase/supabase-js');

// Export a preconfigured Supabase client using env variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = { supabase };
