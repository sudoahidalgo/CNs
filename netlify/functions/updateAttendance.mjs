import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function handler(event) {
  const json = (code, payload) => ({
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(payload),
  });

  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
    if (!event.body) return json(400, { error: 'Missing body' });

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return json(400, { error: 'Invalid JSON body' }); }

    const { event_id, updates } = payload;
    if (!event_id || !updates || typeof updates !== 'object') {
      return json(400, { error: 'Invalid payload: require event_id and updates object' });
    }

    const { data, error } = await supabase
      .rpc('update_week_and_visits', {
        week_id: event_id,
        bar: updates.bar,
        attendees: updates.attendees,
      });

    if (error) {
      console.error('Supabase error', { event_id, updates, error });
      return json(500, { error: error.message });
    }

    return json(200, { ok: true, data });
  } catch (err) {
    console.error('updateAttendance crash', { err: String(err), stack: err?.stack });
    return json(500, { error: 'Internal error' });
  }
}
