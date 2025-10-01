/** @jest-environment node */

describe('updateAttendance handler', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let handler;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    global.fetch = jest.fn();
    ({ handler } = require('../netlify/functions/updateAttendance.js'));
  });

  afterEach(() => {
    delete global.fetch;
  });

  afterAll(() => {
    if (originalUrl) process.env.SUPABASE_URL = originalUrl; else delete process.env.SUPABASE_URL;
    if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test('responds to OPTIONS with CORS headers', async () => {
    const response = await handler({ httpMethod: 'OPTIONS' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
    expect(response.body).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns 500 when env vars are invalid', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    jest.resetModules();
    ({ handler } = require('../netlify/functions/updateAttendance.js'));

    const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ week_id: 1 }) });
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe('misconfigured env');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns 422 for invalid JSON or missing week_id', async () => {
    let response = await handler({ httpMethod: 'POST', body: '{' });
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('Invalid JSON');

    response = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('Missing week_id');
  });

  test('updates bar, inserts attendees and recomputes totals', async () => {
    const baresResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ nombre: 'Bar Demo' }]),
      text: () => Promise.resolve(JSON.stringify([{ nombre: 'Bar Demo' }])),
    };
    const patchBarResponse = { ok: true, status: 200, text: () => Promise.resolve('[]') };
    const insertResponse = { ok: true, status: 204, text: () => Promise.resolve('') };
    const countResponse = {
      ok: true,
      status: 200,
      headers: { get: () => '0-1/2' },
      text: () => Promise.resolve('[]'),
    };
    const patchTotalResponse = { ok: true, status: 200, text: () => Promise.resolve('[]') };

    global.fetch
      .mockResolvedValueOnce(baresResponse)
      .mockResolvedValueOnce(patchBarResponse)
      .mockResolvedValueOnce(insertResponse)
      .mockResolvedValueOnce(countResponse)
      .mockResolvedValueOnce(patchTotalResponse);

    const body = {
      week_id: 10,
      bar_id: 5,
      add_user_ids: ['u1', 'u2'],
      recompute_total: true,
    };

    const response = await handler({ httpMethod: 'POST', body: JSON.stringify(body) });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://test.supabase.co/rest/v1/bares?id=eq.5&select=nombre&limit=1',
      expect.objectContaining({ method: 'GET' })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://test.supabase.co/rest/v1/semanas_cn?id=eq.10',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ bar_ganador: 'Bar Demo' }),
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://test.supabase.co/rest/v1/asistencias',
      expect.objectContaining({ method: 'POST' })
    );

    const insertCall = global.fetch.mock.calls[2][1];
    expect(insertCall.headers.Prefer).toContain('resolution=ignore-duplicates');

    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      'https://test.supabase.co/rest/v1/asistencias?semana_id=eq.10&select=id',
      expect.objectContaining({ method: 'GET' })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      5,
      'https://test.supabase.co/rest/v1/semanas_cn?id=eq.10',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  test('bubbles up PostgREST error payloads', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'boom', text: () => Promise.resolve('fail') });

    const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ week_id: 99, bar_nombre: 'Bar X' }) });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe('fail');
  });
});
