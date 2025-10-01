// netlify/functions/updateAttendance.ts
const CORS = {
  'Access-Control-Allow-Origin': 'https://corkys.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Vary': 'Origin',
};

const URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/,'');
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return ok('');

    // Health mode (diagnóstico sin escribir)
    if (event.queryStringParameters?.health === '1') {
      return await health();
    }

    if (!/^https:\/\//.test(URL) || !SRK) return err(500, 'misconfigured env');

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; }
    catch { return err(422, 'Invalid JSON'); }

    const week_id = body.week_id ?? body.weekId ?? body.id;
    const bar_id = body.bar_id ?? body.barId ?? null;
    let bar_nombre = body.bar_nombre ?? body.barNombre ?? body.bar ?? null;
    const add_user_ids: string[] = body.add_user_ids ?? body.user_ids ?? [];
    const recompute_total = !!body.recompute_total;

    if (!week_id) return err(422, 'Missing week_id');

    // Resolver bar_nombre desde bar_id si hace falta
    if (!bar_nombre && (bar_id ?? null) !== null) {
      const r = await pgGET(`bares?id=eq.${Number(bar_id)}&select=nombre&limit=1`);
      const js = await safeJSON(r);
      if (!r.ok || !Array.isArray(js) || !js[0]?.nombre) {
        return relay(r, js, 422, 'bar_id not found');
      }
      bar_nombre = js[0].nombre;
    }

    // 1) Actualizar bar_ganador en semanas_cn
    if (bar_nombre) {
      const r1 = await pgPATCH('semanas_cn', `id=eq.${Number(week_id)}`, { bar_ganador: bar_nombre });
      const j1 = await safeJSON(r1);
      if (!r1.ok) return relay(r1, j1);
      // 1b) Reflejar en visitas_bares si hay filas
      const r2 = await pgPATCH('visitas_bares', `semana_id=eq.${Number(week_id)}`, { bar: bar_nombre });
      // si no hay filas, PostgREST devuelve 204; si 404/400, lo ignoramos
    }

    // 2) Insertar asistentes (si vienen)
    if (Array.isArray(add_user_ids) && add_user_ids.length > 0) {
      const rows = add_user_ids.map((uid: string) => ({
        user_id: uid, semana_id: Number(week_id), confirmado: true, created_at: new Date().toISOString(),
      }));
      const r3 = await pgPOST('asistencias', rows, true);  // ignore duplicates
      const j3 = await safeJSON(r3);
      if (!r3.ok) return relay(r3, j3);
    }

    // 3) Recalcular total_asistentes (si aplica)
    if (recompute_total) {
      const rc = await pgGET(`asistencias?semana_id=eq.${Number(week_id)}`, 'count=exact');
      const total = Number(rc.headers.get('content-range')?.split('/')?.[1] || 0);
      // intenta variantes de nombre (columna puede variar entre envs)
      for (const col of ['total_asistentes','total_asist','total_asistertes']) {
        const r4 = await pgPATCH('semanas_cn', `id=eq.${Number(week_id)}`, { [col]: total });
        if (r4.ok) break;
      }
    }

    return ok({ ok: true });
  } catch (e: any) {
    console.error('UNCAUGHT', e?.message, e?.stack);
    return err(500, e?.message || 'server error');
  }
};

// ---------- helpers ----------
function ok(body: any) {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}
function err(code: number, message: string) {
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}
async function safeJSON(r: Response) {
  try { return await r.clone().json(); } catch { return await r.text().catch(()=>''); }
}
function relay(r: Response, payload: any, fallbackCode?: number, fallbackMsg?: string) {
  const code = r?.status || fallbackCode || 500;
  const body = typeof payload === 'string' ? { error: payload } : (payload || { error: fallbackMsg || 'upstream error' });
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
async function pgGET(pathQS: string, prefer?: string) {
  const h: any = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  if (prefer) h.Prefer = prefer;
  return fetch(`${URL}/rest/v1/${pathQS}`, { method: 'GET', headers: h });
}
async function pgPATCH(table: string, filter: string, data: any) {
  return fetch(`${URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}
async function pgPOST(table: string, rows: any[], ignoreDuplicates = false) {
  const h: any = {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  if (ignoreDuplicates) h.Prefer += ',resolution=ignore-duplicates';
  return fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: h, body: JSON.stringify(rows) });
}
async function health() {
  const envOK = { hasURL: !!URL, hasSRK: !!SRK, urlHost: URL.replace(/^https?:\/\//,'') };
  let rest:any={}, auth:any={};
  try {
    const r1 = await fetch(`${URL}/rest/v1/`, { method: 'HEAD' });
    rest = { ok: r1.ok, status: r1.status };
  } catch (e:any) { rest = { ok:false, error: e.message }; }
  try {
    const r2 = await fetch(`${URL}/auth/v1/`, { method: 'HEAD' });
    auth = { ok: r2.ok, status: r2.status };
  } catch (e:any) { auth = { ok:false, error: e.message }; }
  return ok({ envOK, rest, auth });
}
