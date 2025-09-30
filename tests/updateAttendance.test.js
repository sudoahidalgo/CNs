/** @jest-environment node */

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const { createClient } = require('@supabase/supabase-js')
const { handler } = require('../netlify/functions/updateAttendance.js')

const buildSupabase = ({ selectResult, selectError } = {}) => {
  const selectMock = jest.fn()
  if (selectError) {
    selectMock.mockRejectedValue(selectError)
  } else {
    selectMock.mockResolvedValue(selectResult ?? { data: [{ id: 10 }], error: null })
  }

  const eqMock = jest.fn(() => ({ select: selectMock }))
  const updateMock = jest.fn(() => ({ eq: eqMock }))
  const fromMock = jest.fn((table) => {
    if (table !== 'asistencias') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { update: updateMock }
  })

  createClient.mockReturnValue({ from: fromMock })

  return { selectMock, eqMock, updateMock, fromMock }
}

describe('updateAttendance handler', () => {
  const ORIGINAL_URL = process.env.SUPABASE_URL
  const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  })

  afterAll(() => {
    if (ORIGINAL_URL) {
      process.env.SUPABASE_URL = ORIGINAL_URL
    } else {
      delete process.env.SUPABASE_URL
    }

    if (ORIGINAL_KEY) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })

  test('responds to OPTIONS with CORS headers', async () => {
    const response = await handler({ httpMethod: 'OPTIONS' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app')
    expect(response.headers['Content-Type']).toBe('application/json')
    expect(createClient).not.toHaveBeenCalled()
  })

  test('returns 405 for non-POST methods', async () => {
    const response = await handler({ httpMethod: 'GET' })
    expect(response.statusCode).toBe(405)
    expect(JSON.parse(response.body).error).toBe('Method Not Allowed')
    expect(createClient).not.toHaveBeenCalled()
  })

  test('returns 422 for invalid JSON payload', async () => {
    const response = await handler({ httpMethod: 'POST', body: '{ invalid' })
    expect(response.statusCode).toBe(422)
    expect(JSON.parse(response.body).error).toBe('Invalid JSON')
    expect(createClient).not.toHaveBeenCalled()
  })

  test('returns 422 when week_id or fields are missing', async () => {
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify({}) })
    expect(response.statusCode).toBe(422)
    expect(JSON.parse(response.body).error).toBe('Missing week_id or fields')
    expect(createClient).not.toHaveBeenCalled()
  })

  test('updates asistencias row using primary key', async () => {
    const { selectMock, eqMock, updateMock, fromMock } = buildSupabase()
    const payload = { week_id: 42, fields: { bar_id: 5, asistentes: 10 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(createClient).toHaveBeenCalled()
    expect(fromMock).toHaveBeenCalledWith('asistencias')
    expect(updateMock).toHaveBeenCalledWith({ bar_id: 5, asistentes: 10 })
    expect(eqMock).toHaveBeenCalledWith('id', 42)
    expect(selectMock).toHaveBeenCalled()

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.ok).toBe(true)
    expect(body.data).toEqual([{ id: 10 }])
  })

  test('accepts legacy aliases for payload keys', async () => {
    const { eqMock, updateMock } = buildSupabase()
    const payload = { weekId: 99, update: { asistentes: 3 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(updateMock).toHaveBeenCalledWith({ asistentes: 3 })
    expect(eqMock).toHaveBeenCalledWith('id', 99)
    expect(response.statusCode).toBe(200)
  })

  test('maps constraint errors to 422', async () => {
    buildSupabase({ selectResult: { data: null, error: { message: 'violates unique constraint', status: 400 } } })
    const payload = { week_id: 5, fields: { asistentes: 1 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(response.statusCode).toBe(422)
    expect(JSON.parse(response.body).error).toContain('violates unique constraint')
  })

  test('maps policy errors to 403', async () => {
    buildSupabase({ selectResult: { data: null, error: { message: 'permission denied for policy "asistencias"', status: 401 } } })
    const payload = { week_id: 7, fields: { asistentes: 1 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body).error).toContain('permission denied')
  })

  test('returns 500 on unexpected Supabase failure', async () => {
    buildSupabase({ selectError: new Error('network down') })
    const payload = { week_id: 8, fields: { asistentes: 4 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body).error).toBe('network down')
  })

  test('returns 500 when env vars are missing', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const payload = { week_id: 3, fields: { asistentes: 2 } }
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) })

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body).error).toBe('misconfigured env')
    expect(createClient).not.toHaveBeenCalled()
  })
})
