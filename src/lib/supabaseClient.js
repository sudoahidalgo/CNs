const { createClient } = require('@supabase/supabase-js');

// Prefer the service role key when available (for server-side usage)
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// Only create the client if configuration is present
const supabase = url && key ? createClient(url, key) : null;

module.exports = { supabase };
