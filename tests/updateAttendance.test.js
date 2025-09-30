/** @jest-environment node */

jest.mock('../netlify/lib/supabaseAdminClient', () => ({
  getSupabaseAdminClient: jest.fn(),
}));

process.env.ALLOWED_ORIGINS = 'https://corkys.netlify.app, http://localhost:8888';

const { getSupabaseAdminClient } = require('../netlify/lib/supabaseAdminClient');
const { handler } = require('../netlify/functions/updateAttendance');

const buildSupabaseMock = ({ semanasCn = {}, asistencias = {}, visitasBares = {} } = {}) => ({
  from: jest.fn((table) => {
    if (table === 'semanas_cn') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve(
                semanasCn.maybeSingle ? semanasCn.maybeSingle() : { data: { id: 1 }, error: null },
              ),
            ),
          })),
        })),
        update: jest.fn((values) => {
          if (semanasCn.updateSpy) semanasCn.updateSpy(values);
          const resultFactory = semanasCn.updateResult || (() => ({ data: null, error: null }));
          return {
            eq: jest.fn(() => Promise.resolve(resultFactory())),
          };
        }),
      };
    }

    if (table === 'asistencias') {
      return {
        delete: jest.fn(() => {
          if (asistencias.deleteSpy) asistencias.deleteSpy();
          const resultFactory = asistencias.deleteResult || (() => ({ data: null, error: null }));
          return {
            eq: jest.fn(() => Promise.resolve(resultFactory())),
          };
        }),
        insert: jest.fn((values) => {
          if (asistencias.insertSpy) asistencias.insertSpy(values);
          const resultFactory = asistencias.insertResult || (() => ({ data: null, error: null }));
          return Promise.resolve(resultFactory());
        }),
      };
    }

    if (table === 'visitas_bares') {
      return {
        upsert: jest.fn((values, options) => {
          if (visitasBares.upsertSpy) visitasBares.upsertSpy(values, options);
          const resultFactory = visitasBares.upsertResult || (() => ({ data: null, error: null }));
          return Promise.resolve(resultFactory());
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
});

describe('updateAttendance handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('successful update with valid data', async () => {
    const updateSpy = jest.fn(() => ({ data: null, error: null }));
    const deleteSpy = jest.fn(() => ({ data: null, error: null }));
    const insertSpy = jest.fn(() => ({ data: null, error: null }));
    const upsertSpy = jest.fn(() => ({ data: null, error: null }));

    const supabaseMock = buildSupabaseMock({
      semanasCn: {
        maybeSingle: () => ({ data: { id: 1 }, error: null }),
        updateSpy,
      },
      asistencias: {
        deleteSpy,
        insertSpy,
      },
      visitasBares: {
        upsertSpy,
      },
    });

    getSupabaseAdminClient.mockReturnValue(supabaseMock);

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 12, bar: 'Bar Azul', attendees: ['u1', 'u2'] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
    const payload = JSON.parse(response.body);
    expect(payload.data).toEqual({
      weekId: 12,
      bar: 'Bar Azul',
      attendees: ['u1', 'u2'],
      totalAttendees: 2,
    });

    expect(updateSpy).toHaveBeenCalledWith({
      bar_ganador: 'Bar Azul',
      total_asistentes: 2,
      hubo_quorum: false,
    });
    expect(deleteSpy).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith([
      { user_id: 'u1', semana_id: 12, confirmado: true },
      { user_id: 'u2', semana_id: 12, confirmado: true },
    ]);
    expect(upsertSpy).toHaveBeenCalledWith([{ bar: 'Bar Azul', semana_id: 12 }], { onConflict: 'bar' });
  });

  test('returns 422 on invalid JSON', async () => {
    const response = await handler({
      httpMethod: 'POST',
      body: '{ invalid',
      headers: { origin: 'https://corkys.netlify.app' },
    });
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('Invalid JSON payload');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
  });

  test('returns 422 when weekId is missing', async () => {
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ attendees: [] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('Invalid payload: weekId is required');
  });

  test('returns 422 when attendees is not an array', async () => {
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 1, attendees: 'nope' }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('Invalid payload: attendees must be an array of user IDs');
  });

  test('returns 404 when week does not exist', async () => {
    const supabaseMock = buildSupabaseMock({
      semanasCn: {
        maybeSingle: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdminClient.mockReturnValue(supabaseMock);

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 33, attendees: [] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe('Week 33 not found');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
  });

  test('propagates Supabase errors with status code', async () => {
    const supabaseError = Object.assign(new Error('boom'), { status: 409 });
    const supabaseMock = buildSupabaseMock({
      semanasCn: {
        maybeSingle: () => ({ data: { id: 5 }, error: null }),
        updateResult: () => ({ data: null, error: supabaseError }),
      },
      asistencias: {
        deleteResult: () => ({ data: null, error: null }),
      },
    });

    getSupabaseAdminClient.mockReturnValue(supabaseMock);

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 5, attendees: [] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe('boom');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
  });

  test('responds to OPTIONS preflight with CORS headers', async () => {
    const response = await handler({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://corkys.netlify.app');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.headers['Access-Control-Allow-Headers']).toContain('authorization');
  });

  test('maps supabase bad request errors to 422', async () => {
    const supabaseError = Object.assign(new Error('invalid input'), { status: 400 });

    const supabaseMock = buildSupabaseMock({
      semanasCn: {
        maybeSingle: () => ({ data: { id: 2 }, error: null }),
        updateResult: () => ({ data: null, error: supabaseError }),
      },
      asistencias: {
        deleteResult: () => ({ data: null, error: null }),
      },
    });

    getSupabaseAdminClient.mockReturnValue(supabaseMock);

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 2, attendees: [] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error).toBe('invalid input');
  });

  test('bubbles up authorization errors as 403', async () => {
    const supabaseError = Object.assign(new Error('permission denied'), { status: 403 });

    const supabaseMock = buildSupabaseMock({
      semanasCn: {
        maybeSingle: () => ({ data: { id: 3 }, error: null }),
        updateResult: () => ({ data: null, error: supabaseError }),
      },
      asistencias: {
        deleteResult: () => ({ data: null, error: null }),
      },
    });

    getSupabaseAdminClient.mockReturnValue(supabaseMock);

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 3, attendees: [] }),
      headers: { origin: 'https://corkys.netlify.app' },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toBe('permission denied');
  });
});
