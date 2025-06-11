// Global configuration shared between the client pages
export const supabaseUrl = 'https://wjwsdyrkqvxszlclitru.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqd3NkeXJrcXZ4c3psY2xpdHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTA1NzgsImV4cCI6MjA2Mjk4NjU3OH0.YmNDUjkQJrlk91O-Avv7G2QJzQ0R6u9xkR-eIwoAJLo';

export const ADMIN_EMAILS = [
  'ahidalgod@gmail.com',
  'admin2@example.com'
];

// Also expose them on window for non-module scripts if running in browser
if (typeof window !== 'undefined') {
  window.supabaseUrl = supabaseUrl;
  window.supabaseKey = supabaseKey;
  window.ADMIN_EMAILS = ADMIN_EMAILS;
}
