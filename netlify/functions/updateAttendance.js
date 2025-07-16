// netlify/functions/updateAttendance.js
// Variables de entorno (SUPABASE_URL, SUPABASE_KEY) ya estan configuradas en Netlify
import { supabase } from '../../src/lib/supabaseClient'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    let body
    try {
      body = JSON.parse(event.body)
    } catch (err) {
      console.error('JSON parse error:', err)
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' })
      }
    }

    const { id, asistentes } = body
    const { data, error } = await supabase
      .from('attendance')
      .update({ asistentes })
      .eq('id', id)

    if (error) {
      console.error('Supabase update error:', error)
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    }
  } catch (err) {
    console.error('updateAttendance failed:', err)
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    }
  }
}
