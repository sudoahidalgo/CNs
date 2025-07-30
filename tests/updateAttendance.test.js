/** @jest-environment node */

let supabaseMock;

const path = require('path');
const fs = require('fs');

const loadHandler = () => {
  jest.resetModules();
  let code = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/updateAttendance.mjs'),
    'utf8'
  );
  // Convert ESM import/export to CommonJS for the test runtime
  code = code
    .replace(
      /import\s+\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"];?/,
      "const { createClient } = require('@supabase/supabase-js');"
    )
    .replace(/export\s+async\s+function\s+handler/, 'async function handler')
    .concat('\nmodule.exports = { handler };');
  const module = { exports: {} };
  const supabaseClientPath = path.resolve(__dirname, '../src/lib/supabaseClient');
  const customRequire = (p) => {
    if (p === '@supabase/supabase-js') {
      return { createClient: globalThis.createClientMock };
    }
    if (p === supabaseClientPath || p === '../../src/lib/supabaseClient') {
      return { supabase: supabaseMock };
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
    path.join(__dirname, '../netlify/functions/updateAttendance.mjs'),
    path.join(__dirname, '../netlify/functions')
  );
  return module.exports.handler;
};

describe('updateAttendance handler', () => {
  beforeEach(() => {
    supabaseMock = {
      rpc: jest.fn(() => Promise.resolve({ data: { ok: true }, error: null }))
    };
    globalThis.createClientMock = jest.fn(() => supabaseMock);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test('successful update with valid data', async () => {
    process.env.SUPABASE_URL = 'url';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ event_id: 1, updates: { bar: 'Bar1', attendees: ['u1'] } })
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, data: { ok: true } });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('update_week_and_visits', {
      week_id: 1,
      bar: 'Bar1',
      attendees: ['u1']
    });
  });

  test('returns 400 on invalid JSON with detailed message', async () => {
    process.env.SUPABASE_URL = 'url';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
    const handler = loadHandler();
    const res = await handler({
      httpMethod: 'POST',
      body: '{ invalid'
    });

    expect(res.statusCode).toBe(400);
    const errorMsg = JSON.parse(res.body).error;
    expect(typeof errorMsg).toBe('string');
    expect(errorMsg.length).toBeGreaterThan(0);
  });

  test('throws when env vars missing', () => {
    expect(() => loadHandler()).toThrow('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  });
});
