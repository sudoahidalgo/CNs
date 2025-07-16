/**
 * Las claves ya están configuradas en el cliente importado y
 * aquí solo se realiza la actualización.
 */
// Requiere en Netlify:
//   SUPABASE_URL = https://<tu-proyecto>.supabase.co
//   SUPABASE_KEY = <service_role o anon key con permiso de escritura>
const { supabase } = require('../../src/lib/supabaseClient');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { id, asistentes } = JSON.parse(event.body);

    const { data, error } = await supabase
      .from('attendance')
      .update({ asistentes })
      .eq('id', id);

    if (error) {
      console.error('Supabase update error:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ data })
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      err = new Error('Invalid JSON body');
    }
    console.error('Request failed in updateAttendance:', err);
    return {
      statusCode: err.statusCode || 502,
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    };
  }
};
