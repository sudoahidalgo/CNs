import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' }
  }
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('ENV CHECK', { hasUrl: !!url, hasServiceRole: !!key })
    if (!url || !key) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'misconfigured env' }) }
    }
    const supabase = createClient(url, key)

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) }
    }
    let payload
    try {
      payload = event.body ? JSON.parse(event.body) : null
    } catch {
      return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }
    const { week_id, fields } = payload || {}
    if (!week_id || typeof fields !== 'object') {
      return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: 'Missing week_id or fields' }) }
    }
    const { data, error } = await supabase
      .from('attendance')
      .update(fields)
      .eq('id', week_id)
      .select()

    if (error) {
      const msg = String(error.message || error)
      const status = /RLS|policy|permission/i.test(msg) ? 403
                   : /invalid|constraint|null value|violates/i.test(msg) ? 422
                   : 500
      console.error('UPDATE ERROR', msg)
      return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) }
    }
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, data }) }
  } catch (e) {
    console.error('HANDLER ERROR', e?.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e?.message || 'server error' }) }
  }
}
