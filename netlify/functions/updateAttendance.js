/**
 * Las claves ya están configuradas en el cliente importado y
 * aquí solo se realiza la actualización.
 */
const path = require('path');
const { supabase } = require(path.resolve(__dirname, '../../src/lib/supabaseClient'));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let id, asistentes;
  try {
    const body = JSON.parse(event.body);
    id = body.id;
    asistentes = body.asistentes;
  } catch (err) {
    console.error('JSON parse error:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  try {
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
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || err })
    };
  }
};
