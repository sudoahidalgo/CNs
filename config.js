const supabaseUrl = 'https://wjwsdyrkqvxszlclitru.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqd3NkeXJrcXZ4c3psY2xpdHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTA1NzgsImV4cCI6MjA2Mjk4NjU3OH0.YmNDUjkQJrlk91O-Avv7G2QJzQ0R6u9xkR-eIwoAJLo';
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const supabase = window.supabaseClient;
