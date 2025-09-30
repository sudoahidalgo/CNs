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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

const jsonResponse = (statusCode, body, origin) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...getCorsHeaders(origin),
  },
  body: JSON.stringify(body),
});

const sanitizeAttendees = (attendees) => {
  if (!Array.isArray(attendees)) return [];

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

exports.handler = async (event = {}) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: '',
    };
  }

  if (event.httpMethod && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    console.error('Invalid JSON payload:', error);
    return jsonResponse(400, { error: 'Invalid JSON payload' }, origin);
  }

  const { weekId: rawWeekId, bar: rawBar = null } = payload;
  if (rawWeekId === undefined || rawWeekId === null || rawWeekId === '') {
    return jsonResponse(400, { error: 'Invalid payload: weekId is required' }, origin);
  }

  const weekId = Number(rawWeekId);
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return jsonResponse(400, { error: 'Invalid payload: weekId must be a positive integer' }, origin);
  }

  const attendees = sanitizeAttendees(payload.attendees);
  const bar = rawBar ? String(rawBar).trim() || null : null;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: week, error: fetchWeekError } = await supabase
      .from('semanas_cn')
      .select('id')
      .eq('id', weekId)
      .maybeSingle();

    if (fetchWeekError) {
      throw fetchWeekError;
    }

    if (!week) {
      return jsonResponse(404, { error: `Week ${weekId} not found` }, origin);
    }

    const totalAttendees = attendees.length;
    const [{ error: updateError }, { error: deleteError }] = await Promise.all([
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

    if (updateError) throw updateError;
    if (deleteError) throw deleteError;

    if (attendees.length > 0) {
      const attendanceRows = attendees.map((userId) => ({
        user_id: userId,
        semana_id: weekId,
        confirmado: true,
      }));

      const { error: insertError } = await supabase
        .from('asistencias')
        .insert(attendanceRows);

      if (insertError) throw insertError;
    }

    if (bar) {
      const { error: upsertError } = await supabase
        .from('visitas_bares')
        .upsert(
          [{ bar, semana_id: weekId }],
          { onConflict: 'bar' },
        );

      if (upsertError) throw upsertError;
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
    console.error('updateAttendance failed:', error);
    const statusCode = error.status || error.statusCode || 500;
    return jsonResponse(statusCode, {
      error: error.message || 'Unknown error',
    }, origin);
  }
};
