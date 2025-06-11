/** @jest-environment node */

let supabaseMock;

const path = require('path');
const fs = require('fs');

const loadHandler = () => {
  jest.resetModules();
  process.env.SUPABASE_URL = 'url';
  process.env.SUPABASE_SERVICE_KEY = 'key';
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
      delete: jest.fn(() => supabaseMock),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      eq: jest.fn(() => Promise.resolve({ error: null }))
    };
    globalThis.createClientMock = jest.fn(() => supabaseMock);
  });

  test('successful update with valid data', async () => {
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ weekId: 1, bar: 'Bar', attendees: ['u1', 'u2'] })
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
    expect(supabaseMock.from).toHaveBeenCalledWith('semanas_cn');
    expect(supabaseMock.from).toHaveBeenCalledWith('asistencias');
    expect(supabaseMock.update).toHaveBeenCalled();
    expect(supabaseMock.delete).toHaveBeenCalled();
    expect(supabaseMock.insert).toHaveBeenCalled();
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 1);
    expect(supabaseMock.eq).toHaveBeenCalledWith('semana_id', 1);
  });

  test('returns 400 when weekId missing', async () => {
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ bar: 'Bar', attendees: [] })
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Missing weekId');
  });
});
