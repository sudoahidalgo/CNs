// netlify/functions/updateAttendance.js
// Usa el cliente Supabase definido en src/lib/supabaseClient.js
import { supabase } from '../../src/lib/supabaseClient'

export const handler = async (event, context) => {
  try {
    // 1. Parsear y validar JSON
    const { id, asistentes } = JSON.parse(event.body)
    if (!id || !Array.isArray(asistentes)) {
      throw new Error('Invalid payload: id and asistentes are required')
    }

    // 2. Ejecutar la actualización
    const { data, error } = await supabase
      .from('attendance')
      .update({ asistentes })
      .eq('id', id)

    // 3. Manejo de errores de Supabase
    if (error) {
      console.error('Supabase update error:', error)
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message })
      }
    }

    // 4. Respuesta exitosa
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    }
  } catch (err) {
    // 5. Manejo de excepciones generales (JSON.parse, red, etc.)
    console.error('updateAttendance failed:', err)
    return {
      statusCode: err.statusCode || 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    }
  }
}
