/** @jest-environment node */

let supabaseMock;

const path = require('path');
const fs = require('fs');

const loadHandler = () => {
  jest.resetModules();
  const code = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/updateAttendance.js'),
    'utf8'
  );
  const module = { exports: {} };
  const customRequire = (p) => {
    if (p === '@supabase/supabase-js') {
      return { createClient: globalThis.createClientMock };
    }
    return require(p);
  };
  const wrapper = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    code
  );
  wrapper(
    module.exports,
    customRequire,
    module,
    path.join(__dirname, '../netlify/functions/updateAttendance.js'),
    path.join(__dirname, '../netlify/functions')
  );
  return module.exports.handler;
};

describe('updateAttendance handler', () => {
  beforeEach(() => {
    supabaseMock = {
      from: jest.fn(() => supabaseMock),
      update: jest.fn(() => supabaseMock),
      eq: jest.fn(() => Promise.resolve({ data: { ok: true }, error: null }))
    };
    globalThis.createClientMock = jest.fn(() => supabaseMock);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
  });

  test('successful update with valid data', async () => {
    process.env.SUPABASE_URL = 'url';
    process.env.SUPABASE_KEY = 'key';
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ id: 1, asistentes: ['u1'] })
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(supabaseMock.from).toHaveBeenCalledWith('attendance');
    expect(supabaseMock.update).toHaveBeenCalledWith({ asistentes: ['u1'] });
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 1);
  });

  test('returns 400 on invalid JSON', async () => {
    process.env.SUPABASE_URL = 'url';
    process.env.SUPABASE_KEY = 'key';
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: '{ invalid'
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Invalid JSON');
  });

  test('returns 500 when env vars missing', async () => {
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ id: 1, asistentes: [] })
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/Missing/);
  });
});
