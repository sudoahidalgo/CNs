// netlify/functions/updateAttendance.js
// Usa el cliente Supabase de src/lib/supabaseClient.js
// Env vars en Netlify: SUPABASE_URL y SUPABASE_KEY ya configuradas
import { supabase } from '../../src/lib/supabaseClient'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { id, asistentes } = JSON.parse(event.body)
    const { data, error } = await supabase
      .from('attendance')
      .update({ asistentes })
      .eq('id', id)
    if (error) {
      console.error('Supabase update error:', error)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message })
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ data })
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      err = new Error('Invalid JSON')
    }
    console.error('Request failed in updateAttendance:', err)
    return {
      statusCode: err.statusCode || 502,
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    }
  }
};
