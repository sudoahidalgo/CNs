const CORS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Vary': 'Origin',
};

const urlBase = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Health check para diagnosticar variables y conectividad
  if (event.queryStringParameters && event.queryStringParameters.health === '1') {
    return await health();
  }

  try {
    if (!/^https:\/\//.test(urlBase) || !serviceKey) {
      return resp(500, { error: 'misconfigured env' });
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return resp(422, { error: 'Invalid JSON' });
    }

    const week_id = payload.week_id ?? payload.weekId ?? payload.id;
    const bar_id = payload.bar_id ?? payload.barId;
    let bar_nombre = payload.bar_nombre ?? payload.barNombre ?? payload.bar;

    const replaceSource = payload.set_user_ids ?? payload.replace_user_ids ?? payload.attendees;
    const hasReplaceArray = Array.isArray(replaceSource);
    const replace_user_ids = hasReplaceArray
      ? replaceSource.map((uid) => {
          if (uid === null || uid === undefined) return null;
          const str = String(uid).trim();
          return str || null;
        }).filter(Boolean)
      : null;

    const add_user_ids = hasReplaceArray
      ? []
      : (payload.add_user_ids ?? payload.user_ids ?? []);

    const barIdNum =
      bar_id === undefined || bar_id === null || bar_id === '' ? null : Number(bar_id);
    if (barIdNum !== null && !Number.isFinite(barIdNum)) {
      return resp(422, { error: 'Invalid bar_id' });
    }

    const recompute_total = !!payload.recompute_total;

    if (!week_id) return resp(422, { error: 'Missing week_id' });
    const weekNum = Number(week_id);
    if (!Number.isInteger(weekNum) || weekNum <= 0) {
      return resp(422, { error: 'Invalid week_id' });
    }

    // Resolver bar_nombre si viene sólo bar_id
    if (!bar_nombre && barIdNum != null) {
      const r = await safeFetch(() => pgGetOne('bares', `id=eq.${barIdNum}`, 'nombre'));
      if (!r.ok) return proxy(r);
      bar_nombre = (await r.json())[0]?.nombre;
      if (!bar_nombre) return resp(422, { error: 'bar_id not found' });
    }

    // 1) Actualizar semanas_cn (bar_ganador y/o bar_id si existe esa columna)
    if (bar_nombre || barIdNum != null) {
      const updatePayload = {};
      if (bar_nombre) updatePayload.bar_ganador = bar_nombre;
      if (barIdNum != null) updatePayload.bar_id = barIdNum;

      const up = await safeFetch(() => pgPatch('semanas_cn', `id=eq.${weekNum}`, updatePayload));
      if (!up.ok) {
        // Retry legacy schema: sin bar_id
        if (barIdNum != null) {
          const retry = await safeFetch(() => pgPatch('semanas_cn', `id=eq.${weekNum}`, { bar_ganador: bar_nombre }));
          if (!retry.ok) return proxy(retry);
        } else {
          return proxy(up);
        }
      }

      // 1b) Reflejar en visitas_bares (si hay filas para esa semana)
      if (bar_nombre) {
        const visitas = await safeFetch(() =>
          pgPatch('visitas_bares', `semana_id=eq.${weekNum}`, { bar: bar_nombre })
        );
        // Ignoramos 404/406 si no existe fila
        if (!visitas.ok && ![404, 406].includes(visitas.status)) {
          return proxy(visitas);
        }
      }
    }

    // 2) Asistencias: modo replace o add
    if (hasReplaceArray) {
      const del = await safeFetch(() => pgDelete('asistencias', `semana_id=eq.${weekNum}`));
      if (!del.ok) return proxy(del);

      if (Array.isArray(replace_user_ids) && replace_user_ids.length > 0) {
        const rows = replace_user_ids.map((uid) => ({
          user_id: uid,
          semana_id: weekNum,
          confirmado: true,
          created_at: new Date().toISOString(),
        }));
        const ins = await safeFetch(() => pgInsert('asistencias', rows, 'ignore'));
        if (!ins.ok) return proxy(ins);
      }
    } else if (Array.isArray(add_user_ids) && add_user_ids.length > 0) {
      const rows = add_user_ids.map((uid) => ({
        user_id: uid,
        semana_id: weekNum,
        confirmado: true,
        created_at: new Date().toISOString(),
      }));
      const ins = await safeFetch(() => pgInsert('asistencias', rows, 'ignore'));
      if (!ins.ok) return proxy(ins);
    }

    // 3) Recalcular total_asistentes (si aplica)
    if (recompute_total) {
      const c = await safeFetch(() => pgGet('asistencias', `semana_id=eq.${weekNum}`, 'select=id'));
      if (!c.ok) return proxy(c);
      const total = Number(c.headers.get('content-range')?.split('/')?.[1] || 0);

      const tryCols = ['total_asistentes', 'total_asistertes', 'total_asist', 'total_asistentes_cn'];
      for (const col of tryCols) {
        const upd = await safeFetch(() => pgPatch('semanas_cn', `id=eq.${weekNum}`, { [col]: total }));
        if (upd.ok) break;
      }
    }

    return resp(200, { ok: true });
  } catch (e) {
    console.error('HANDLER ERROR', e?.message);
    return resp(500, { error: e?.message || 'server error' });
  }
};

function resp(status, body) {
  return {
    statusCode: status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function proxy(r) {
  let text;
  try { text = await r.text(); } catch (err) { text = err?.message; }

  let body = undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { error: text }; }
  }
  if (!body || typeof body !== 'object') body = { error: r.statusText || 'request failed' };
  else if (!body.error && text) body.error = text;

  return resp(r.status || 500, body);
}

// —— wrappers PostgREST ——
async function pgPatch(table, filter, data) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}
async function pgInsert(table, rows, onConflict = 'error') {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  if (onConflict === 'ignore') headers.Prefer += ',resolution=ignore-duplicates';
  return fetch(`${urlBase}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(rows) });
}
async function pgDelete(table, filter) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=minimal' },
  });
}
async function pgGetOne(table, filter, select) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}&select=${encodeURIComponent(select)}&limit=1`, {
    method: 'GET',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}
async function pgGet(table, filter, extraQuery = '') {
  const qs = `${filter}${extraQuery ? `&${extraQuery}` : ''}`;
  return fetch(`${urlBase}/rest/v1/${table}?${qs}`, {
    method: 'GET',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'count=exact' },
  });
}

// —— convierte "TypeError: fetch failed" en 503 JSON —— 
async function safeFetch(call) {
  try {
    return await call();
  } catch (e) {
    console.error('NETWORK/FETCH ERROR', e?.message || e);
    return new Response(JSON.stringify({ error: 'upstream fetch failed', detail: String(e?.message || e) }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// —— health endpoint —— 
async function health() {
  const envOK = { url: !!urlBase, srk: !!serviceKey };
  let rest = {}, auth = {};
  try { const r1 = await fetch(`${urlBase}/rest/v1/`, { method: 'HEAD' }); rest = { ok: r1.ok, status: r1.status }; }
  catch (e) { rest = { ok:false, error: String(e) }; }
  try { const r2 = await fetch(`${urlBase}/auth/v1/`, { method: 'HEAD' }); auth = { ok: r2.ok, status: r2.status }; }
  catch (e) { auth = { ok:false, error: String(e) }; }
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ envOK, rest, auth }) };
}

module.exports = { handler };
