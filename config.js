// Global configuration shared between the client pages
export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseKey = process.env.SUPABASE_KEY || '';

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',')
  : [
      'ahidalgod@gmail.com',
      'admin2@example.com'
    ]);

// Also expose them on window for non-module scripts if running in browser
if (typeof window !== 'undefined') {
  window.supabaseUrl = supabaseUrl;
  window.supabaseKey = supabaseKey;
  window.ADMIN_EMAILS = ADMIN_EMAILS;
}
