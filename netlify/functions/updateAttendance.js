// netlify/functions/updateAttendance.js
// Usa el cliente Supabase definido en src/lib/supabaseClient.js
import { supabase } from '../../src/lib/supabaseClient'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { weekId, bar, attendees } = JSON.parse(event.body || '{}')

    if (!weekId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing weekId' })
      }
    }

    const { error } = await supabase.rpc('update_week_and_visits', {
      week_id: weekId,
      bar,
      attendees
    })

    if (error) {
      console.error('Supabase RPC error:', error)
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
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
