// netlify/functions/updateAttendance.js
const { getSupabaseAdminClient } = require('../lib/supabaseAdminClient');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://corkys.netlify.app',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
];

const resolveAllowedOrigins = () => {
  const raw =
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ALLOWED_ORIGINS ||
    DEFAULT_ALLOWED_ORIGINS.join(',');

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const getCorsHeaders = (origin = '') => {
  const allowedOrigins = resolveAllowedOrigins();
  const hasWildcard = allowedOrigins.includes('*');
  const normalizedOrigin = origin.trim();

  let allowOrigin = hasWildcard ? '*' : allowedOrigins[0] || '*';
  if (!hasWildcard && normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
    allowOrigin = normalizedOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
};

const jsonResponse = (statusCode, body, origin) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    ...getCorsHeaders(origin),
  },
  body: JSON.stringify(body),
});

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseJsonBody = (rawBody) => {
  if (rawBody === undefined || rawBody === null || rawBody === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw createHttpError(422, 'Request body must be a JSON object');
    }

    return parsed;
  } catch (error) {
    if (error.statusCode === 422) throw error;
    throw createHttpError(422, 'Invalid JSON payload');
  }
};

const sanitizeAttendees = (attendees) => {
  if (!Array.isArray(attendees)) {
    throw createHttpError(422, 'Invalid payload: attendees must be an array of user IDs');
  }

  const normalized = [];
  const seen = new Set();

  for (const value of attendees) {
    if (value === null || value === undefined) continue;
    const trimmed = String(value).trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

const normalizeSupabaseError = (error) => {
  if (!error) {
    return createHttpError(500, 'Unexpected error communicating with Supabase');
  }

  const status = Number(error.status || error.statusCode || error.HTTPStatusCode);
  const message = error.message || 'Unexpected Supabase error';
  const code = error.code;

  if (code === '42501') {
    return createHttpError(403, message);
  }

  if (status === 401 || status === 403) {
    return createHttpError(status, message);
  }

  if (status === 404) {
    return createHttpError(404, message);
  }

  if (status === 400 || status === 422 || code === '22P02' || code === '23505' || code === '23503') {
    return createHttpError(422, message);
  }

  if (status && status >= 400 && status < 500) {
    return createHttpError(status, message);
  }

  const unexpected = createHttpError(500, message);
  unexpected.originalError = error;
  return unexpected;
};

exports.handler = async (event = {}) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: getCorsHeaders(origin),
      body: '',
    };
  }

  if (event.httpMethod && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...getCorsHeaders(origin),
        Allow: 'POST, OPTIONS',
        'Content-Type': 'application/json',
        Vary: 'Origin',
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const payload = parseJsonBody(event.body);
    const { weekId: rawWeekId, bar: rawBar = null, attendees: rawAttendees = [] } = payload;

    if (rawWeekId === undefined || rawWeekId === null || rawWeekId === '') {
      throw createHttpError(422, 'Invalid payload: weekId is required');
    }

    const weekId = Number(rawWeekId);
    if (!Number.isInteger(weekId) || weekId <= 0) {
      throw createHttpError(422, 'Invalid payload: weekId must be a positive integer');
    }

    const attendees = sanitizeAttendees(rawAttendees);
    const barCandidate = rawBar === undefined || rawBar === null ? null : String(rawBar).trim();
    const bar = barCandidate ? barCandidate : null;

    const supabase = getSupabaseAdminClient();

    const { data: week, error: fetchWeekError } = await supabase
      .from('semanas_cn')
      .select('id')
      .eq('id', weekId)
      .maybeSingle();

    if (fetchWeekError) {
      throw normalizeSupabaseError(fetchWeekError);
    }

    if (!week) {
      throw createHttpError(404, `Week ${weekId} not found`);
    }

    const totalAttendees = attendees.length;
    const [updateResult, deleteResult] = await Promise.all([
      supabase
        .from('semanas_cn')
        .update({
          bar_ganador: bar,
          total_asistentes: totalAttendees,
          hubo_quorum: totalAttendees >= 3,
        })
        .eq('id', weekId),
      supabase
        .from('asistencias')
        .delete()
        .eq('semana_id', weekId),
    ]);

    if (updateResult?.error) throw normalizeSupabaseError(updateResult.error);
    if (deleteResult?.error) throw normalizeSupabaseError(deleteResult.error);

    if (attendees.length > 0) {
      const attendanceRows = attendees.map((userId) => ({
        user_id: userId,
        semana_id: weekId,
        confirmado: true,
      }));

      const insertResult = await supabase
        .from('asistencias')
        .insert(attendanceRows);

      if (insertResult?.error) throw normalizeSupabaseError(insertResult.error);
    }

    if (bar) {
      const upsertResult = await supabase
        .from('visitas_bares')
        .upsert(
          [{ bar, semana_id: weekId }],
          { onConflict: 'bar' },
        );

      if (upsertResult?.error) throw normalizeSupabaseError(upsertResult.error);
    }

    return jsonResponse(200, {
      data: {
        weekId,
        bar,
        attendees,
        totalAttendees,
      },
    }, origin);
  } catch (error) {
    const normalizedError = error.statusCode ? error : normalizeSupabaseError(error);
    console.error('updateAttendance failed:', error);
    return jsonResponse(normalizedError.statusCode || 500, {
      error: normalizedError.message || 'Unknown error',
    }, origin);
  }
};
