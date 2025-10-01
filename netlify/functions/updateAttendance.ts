const CORS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const urlBase = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  try {
    if (!/^https:\/\//.test(urlBase) || !serviceKey) {
      return resp(500, { error: 'misconfigured env' });
    }

    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return resp(422, { error: 'Invalid JSON' });
    }

    // Payload esperado (acepta alias por compat):
    // week_id (required), bar_id OR bar_nombre (opcional),
    // add_user_ids: string[] (optional), recompute_total: boolean (optional)
    const week_id = payload.week_id ?? payload.weekId ?? payload.id;
    const bar_id = payload.bar_id ?? payload.barId;
    let bar_nombre = payload.bar_nombre ?? payload.barNombre ?? payload.bar;
    const add_user_ids: string[] = payload.add_user_ids ?? payload.user_ids ?? [];
    const recompute_total = !!payload.recompute_total;

    if (!week_id) return resp(422, { error: 'Missing week_id' });

    // 1) Resolver bar_nombre si sólo vino bar_id
    if (!bar_nombre && bar_id) {
      const r = await pgGetOne('bares', `id=eq.${Number(bar_id)}`, 'nombre');
      if (!r.ok) return proxy(r);
      bar_nombre = (await r.json())[0]?.nombre;
      if (!bar_nombre) return resp(422, { error: 'bar_id not found' });
    }

    // 2) Actualizar bar_ganador si hay bar_nombre
    if (bar_nombre) {
      const up = await pgPatch('semanas_cn', `id=eq.${Number(week_id)}`, { bar_ganador: bar_nombre });
      if (!up.ok) return proxy(up);
    }

    // 3) Insertar asistentes si vienen user_ids
    if (Array.isArray(add_user_ids) && add_user_ids.length > 0) {
      const rows = add_user_ids.map((uid) => ({
        user_id: uid,
        semana_id: Number(week_id),
        confirmado: true,
        created_at: new Date().toISOString(),
      }));
      const ins = await pgInsert('asistencias', rows, 'ignore'); // usa ON CONFLICT DO NOTHING
      if (!ins.ok) return proxy(ins);
    }

    // 4) Recalcular total_asistentes (si la columna existe y flag on)
    if (recompute_total) {
      const c = await pgGet('asistencias', `semana_id=eq.${Number(week_id)}`, 'select=id');
      if (!c.ok) return proxy(c);
      const total = Number(c.headers.get('content-range')?.split('/')?.[1] || 0);

      // intenta varias columnas posibles; si ninguna existe, ignora
      const tryCols = ['total_asistentes', 'total_asistertes', 'total_asist', 'total_asistentes_cn'];
      for (const col of tryCols) {
        const upd = await pgPatch('semanas_cn', `id=eq.${Number(week_id)}`, { [col]: total });
        if (upd.ok) break;
      }
    }

    return resp(200, { ok: true });
  } catch (e: any) {
    console.error('HANDLER ERROR', e?.message);
    return resp(500, { error: e?.message || 'server error' });
  }
};

function resp(status: number, body: any) {
  return {
    statusCode: status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function proxy(r: any) {
  let text: string | undefined;
  try {
    text = await r.text();
  } catch (err: any) {
    text = err?.message;
  }

  let body: any = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (!body || typeof body !== 'object') {
    body = { error: r.statusText || 'request failed' };
  } else if (!body.error && text) {
    body.error = text;
  }

  return resp(r.status || 500, body);
}

// --- PostgREST helpers ---
async function pgPatch(table: string, filter: string, data: any) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
}

async function pgInsert(table: string, rows: any[], onConflict: 'ignore' | 'error' = 'error') {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  if (onConflict === 'ignore') headers.Prefer += ',resolution=ignore-duplicates';
  return fetch(`${urlBase}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
}

async function pgGetOne(table: string, filter: string, select: string) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}&select=${encodeURIComponent(select)}&limit=1`, {
    method: 'GET',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}

async function pgGet(table: string, filter: string, extraQuery: string = '') {
  const qs = `${filter}${extraQuery ? `&${extraQuery}` : ''}`;
  return fetch(`${urlBase}/rest/v1/${table}?${qs}`, {
    method: 'GET',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'count=exact' },
  });
}
