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
      rpc: jest.fn(() => Promise.resolve({ error: null }))
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
    expect(supabaseMock.rpc).toHaveBeenCalledWith('update_week_and_visits', {
      week_id: 1,
      bar: 'Bar',
      attendees: ['u1', 'u2']
    });
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
