// netlify/functions/updateAttendance.js
// Actualiza el bar ganador y los asistentes usando la funcion SQL
import { supabase } from '../../src/lib/supabaseClient'

export const handler = async (event) => {
  try {
    const { weekId, bar, attendees } = JSON.parse(event.body)
    if (!weekId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing weekId' })
      }
    }

    const attendeeIds = (attendees || []).map(id =>
      /^\d+$/.test(id) ? parseInt(id, 10) : id
    )

    const { error } = await supabase.rpc('update_week_and_visits', {
      week_id: weekId,
      bar,
      attendees: attendeeIds
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
      body: JSON.stringify({ error: err.message || 'Invalid payload' })
    }
  }
}
