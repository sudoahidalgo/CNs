const { createClient } = require('@supabase/supabase-js')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const buildErrorResponse = (error) => {
  const message = String(error?.message || error || 'unknown error')
  const normalized = message.toLowerCase()

  const statusCode = /rls|policy|permission/.test(normalized)
    ? 403
    : /invalid|constraint|null value|violat/.test(normalized) || error?.status === 422 || error?.status === 400
      ? 422
      : error?.status && Number.isInteger(error.status)
        ? error.status
        : 500

  if (statusCode === 500) {
    console.error('UPDATE asistencias ERROR', { message })
  } else {
    console.warn('UPDATE asistencias WARNING', { statusCode, message })
  }

  return jsonResponse(statusCode, { error: message })
}

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: '' }
  }

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('Supabase env vars missing', { hasUrl: !!url, hasServiceRole: !!serviceRoleKey })
    return jsonResponse(500, { error: 'misconfigured env' })
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  let payload
  try {
    payload = event.body ? JSON.parse(event.body) : null
  } catch (err) {
    console.warn('Invalid JSON payload received')
    return jsonResponse(422, { error: 'Invalid JSON' })
  }

  const week_id = payload?.week_id ?? payload?.weekId ?? payload?.id ?? payload?.asistencia_id
  const fields = payload?.fields ?? payload?.update ?? payload?.data

  console.log('PAYLOAD', { hasWeekId: !!week_id, fieldKeys: Object.keys(fields || {}) })
  console.log('TARGET', { table: 'asistencias', pk: 'id', week_id })

  if (!week_id || typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    console.warn('Invalid payload', { hasWeek: !!week_id, fieldsType: typeof fields })
    return jsonResponse(422, { error: 'Missing week_id or fields' })
  }

  try {
    const supabase = createClient(url, serviceRoleKey)

    const { data, error } = await supabase
      .from('asistencias')
      .update(fields)
      .eq('id', week_id)
      .select()

    if (error) {
      return buildErrorResponse(error)
    }

    return jsonResponse(200, { ok: true, data })
  } catch (err) {
    console.error('Unexpected handler failure', { message: err?.message })
    return jsonResponse(500, { error: err?.message || 'server error' })
  }
}

module.exports = { handler }
