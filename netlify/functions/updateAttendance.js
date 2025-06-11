const { createClient } = require('@supabase/supabase-js');

let handler;

const missingVars = [];
if (!process.env.SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_KEY) missingVars.push('SUPABASE_SERVICE_KEY');

if (missingVars.length) {
  const msg = `Missing ${missingVars.join(', ')}`;
  console.error(msg);
  handler = async () => ({
    statusCode: 500,
    body: JSON.stringify({ error: msg })
  });
} else {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  handler = async (event) => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
      const { weekId, bar, attendees } = JSON.parse(event.body || '{}');

      if (!weekId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing weekId' })
        };
      }

      const attendeeIds = (attendees || []).map((id) =>
        /^\d+$/.test(id) ? parseInt(id, 10) : id
      );

      const { error: rpcErr } = await supabase.rpc('update_week_and_visits', {
        week_id: weekId,
        bar,
        attendees: attendeeIds
      });
      if (rpcErr) throw rpcErr;

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  };
}

module.exports.handler = handler;
