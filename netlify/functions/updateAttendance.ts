const CORS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const urlBase = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    if (!/^https:\/\//.test(urlBase) || !serviceKey) {
      return json(500, { error: 'misconfigured env' });
    }

    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(422, { error: 'Invalid JSON' });
    }

    const week_id = payload.week_id ?? payload.weekId ?? payload.id;
    const bar_id = payload.bar_id ?? payload.barId ?? null;
    let bar_nombre = payload.bar_nombre ?? payload.barNombre ?? payload.bar ?? null;
    const add_user_ids: string[] = payload.add_user_ids ?? payload.user_ids ?? [];
    const recompute_total = !!payload.recompute_total;

    if (!week_id) return json(422, { error: 'Missing week_id' });

    const weekIdNum = Number(week_id);
    if (!Number.isFinite(weekIdNum)) return json(422, { error: 'Invalid week_id' });

    const barIdNum = bar_id != null ? Number(bar_id) : null;
    if (barIdNum != null && !Number.isFinite(barIdNum)) return json(422, { error: 'Invalid bar_id' });

    // Resolver bar_nombre si sólo viene bar_id
    if (!bar_nombre && barIdNum != null) {
      const r = await pgGet(`bares?id=eq.${barIdNum}&select=nombre&limit=1`);
      if (!r.ok) return proxy(r);
      const data = await r.json();
      bar_nombre = data?.[0]?.nombre || null;
      if (!bar_nombre) return json(422, { error: 'bar_id not found' });
    }

    // 1) Actualizar bar_ganador en semanas_cn
    if (bar_nombre) {
      const up1 = await pgPatch('semanas_cn', `id=eq.${weekIdNum}`, { bar_ganador: bar_nombre });
      if (!up1.ok) return proxy(up1);

      // 1b) Reflejar en visitas_bares
      const up2 = await pgPatch('visitas_bares', `semana_id=eq.${weekIdNum}`, { bar: bar_nombre });
      if (!up2.ok && ![404, 406].includes(up2.status)) return proxy(up2);
    }

    // 2) Insertar asistencias
    if (Array.isArray(add_user_ids) && add_user_ids.length > 0) {
      const rows = add_user_ids.map((uid: string) => ({
        user_id: uid,
        semana_id: weekIdNum,
        confirmado: true,
        created_at: new Date().toISOString(),
      }));
      const ins = await pgInsert('asistencias', rows, true);
      if (!ins.ok) return proxy(ins);
    }

    // 3) Recalcular total de asistentes (si aplica)
    if (recompute_total) {
      const cntRes = await pgGet(`asistencias?semana_id=eq.${weekIdNum}`, 'count=exact');
      if (!cntRes.ok) return proxy(cntRes);
      const range = cntRes.headers.get('content-range') || '';
      const total = Number(range.split('/')?.[1] || 0);
      const candidates = ['total_asistentes', 'total_asist', 'total_asistertes'];
      for (const col of candidates) {
        const upd = await pgPatch('semanas_cn', `id=eq.${weekIdNum}`, { [col]: total });
        if (upd.ok) break;
      }
    }

    return json(200, { ok: true });
  } catch (e: any) {
    console.error('HANDLER ERROR', e?.message);
    return json(500, { error: e?.message || 'server error' });
  }
};

function json(status: number, body: any) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function proxy(r: any) {
  let text = '';
  try {
    text = await r.text();
  } catch (err: any) {
    text = err?.message || '';
  }

  let body: any;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }
  const message = body?.message || body?.error || text || r.statusText || 'request failed';
  if (r.status === 401 || r.status === 403) {
    return json(403, { error: message });
  }
  if ([400, 404, 406, 409, 422].includes(r.status)) {
    return json(422, { error: message });
  }
  return json(500, { error: message });
}

async function pgGet(pathQS: string, extraPrefer: string = '') {
  const headers: Record<string, string> = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  if (extraPrefer) headers.Prefer = extraPrefer;
  return fetch(`${urlBase}/rest/v1/${pathQS}`, { method: 'GET', headers });
}

async function pgPatch(table: string, filter: string, body: any) {
  return fetch(`${urlBase}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

async function pgInsert(table: string, rows: any[], ignoreDuplicates = false) {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  if (ignoreDuplicates) headers.Prefer += ',resolution=ignore-duplicates';
  return fetch(`${urlBase}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(rows) });
}
