/** @jest-environment node */

let supabaseMock;

const path = require('path');
const fs = require('fs');

const loadHandler = () => {
  jest.resetModules();
  process.env.SUPABASE_URL = 'url';
  process.env.SUPABASE_SERVICE_KEY = 'key';
  const code = fs.readFileSync(path.join(__dirname, '../netlify/functions/vote.js'), 'utf8');
  const module = { exports: {} };
  const customRequire = (p) => {
    if (p === '../../src/lib/supabaseClient') {
      return { supabase: supabaseMock };
    }
    return require(p);
  };
  const wrapper = new Function('exports','require','module','__filename','__dirname',code);
  wrapper(module.exports, customRequire, module, path.join(__dirname,'../netlify/functions/vote.js'), path.join(__dirname,'../netlify/functions'));
  return module.exports.handler;
};

describe('vote ip detection', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-10T12:00:00Z'));
    supabaseMock = {
      from: jest.fn(() => supabaseMock),
      select: jest.fn(() => supabaseMock),
      eq: jest.fn(() => supabaseMock),
      gte: jest.fn(() => Promise.resolve({ data: [], error: null })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => Promise.resolve({ error: null })),
      delete: jest.fn(() => Promise.resolve({ error: null })),
      single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('uses client-ip header when present', async () => {
    const handler = loadHandler();
    await handler({
      httpMethod: 'POST',
      headers: { 'client-ip': '1.1.1.1' },
      body: JSON.stringify({ place: 'a' })
    });
    expect(supabaseMock.eq).toHaveBeenCalledWith('ip', '1.1.1.1');
  });

  test('falls back to x-nf-client-connection-ip', async () => {
    const handler = loadHandler();
    await handler({
      httpMethod: 'POST',
      headers: { 'x-nf-client-connection-ip': '2.2.2.2' },
      body: JSON.stringify({ place: 'a' })
    });
    expect(supabaseMock.eq).toHaveBeenCalledWith('ip', '2.2.2.2');
  });

  test('falls back to x-forwarded-for', async () => {
    const handler = loadHandler();
    await handler({
      httpMethod: 'POST',
      headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
      body: JSON.stringify({ place: 'a' })
    });
    expect(supabaseMock.eq).toHaveBeenCalledWith('ip', '3.3.3.3');
  });
});
