# CNs

## 1) Resumen del proyecto
- **¿Dónde vamos a la CN hoy?**: proyecto que organiza y publica la votación semanal para elegir el bar de la Comunidad de Ñoños.
- **Frontend**: sitio estático en Netlify – https://corkys.netlify.app (HTML/JS plano con Supabase JS en el navegador).
- **Backend**: Supabase proporciona autenticación, PostgREST y funciones RPC/Edge para operaciones críticas.
- **Funciones serverless**: Netlify Functions (por ejemplo `/.netlify/functions/updateAttendance`) encapsulan la lógica administrativa.
- **Base de datos (esquema `public`)**: tablas `asistencias`, `bares`, `estadisticas_bares`, `ganadores`, `semana_actual`, `semanas`, `semanas_cn`, `usuarios`, `visitas_bares`, `votos`.
- **Flujo semanal**: cada martes se registran votos y asistencias; el proceso `process_weekly_reset` (RPC) cierra la semana, genera la siguiente y reinicia las métricas.
- **Panel administrativo**: `admin.html` permite finalizar la semana, resetear votos y editar asistencias confirmadas consumiendo la función `updateAttendance`.
- **Script auxiliar**: `scripts/updateWeekBar.js` sincroniza manualmente un bar ganador usando la RPC `update_week_and_visits`.

## 2) Variables de entorno (obligatorias)
Definir en Netlify → **Settings → Environment variables** (scopes: Builds, Functions, Runtime; context: Production) y repetir para todos los contextos de deploy:

- `SUPABASE_URL = https://<PROJECT>.supabase.co`
- `SUPABASE_ANON_KEY = <anon key>` (solo frontend: usarlo en `config.js`, nunca en Functions ni prefijos `VITE_*`).
- `SUPABASE_SERVICE_ROLE_KEY = <service_role key>` (solo Functions). **Nunca** exponer el `SERVICE_ROLE_KEY` en el frontend ni en variables `VITE_*`.

> 🚿 Sanitizar antes de guardar: copiar/pegar sin espacios al inicio/fin y sin `/` final en la URL. La service_role key válida suele tener >150 caracteres.

> 💡 Tras modificar variables, volver a desplegar (`Clear cache and deploy site`).

## 3) Contratos de API (payloads)
### 3.1 `POST /.netlify/functions/updateAttendance`
**Request (JSON)**
```json
{
  "week_id": 123,
  "fields": {
    "bar_id": 5,
    "asistentes": 42
    // ...otras columnas válidas de 'asistencias'
  }
}
```
Alias aceptados por compatibilidad:

| parámetro | alias |
|-----------|-------|
| `week_id` | `weekId` · `id` · `asistencia_id` |
| `fields`  | `update` · `data` |

**Responses**
- `200` → `{ "ok": true, "data": [...] }`
- `422` → `{ "error": "Missing week_id or fields" | "Invalid JSON" | "violates ..." }`
- `403` → `{ "error": "permission denied (RLS/Policy)" }`
- `500` → `{ "error": "server error" | "misconfigured env" }`

### 3.2 CORS
Todas las respuestas deben incluir:

```
Access-Control-Allow-Origin: https://corkys.netlify.app
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

La función debe responder `OPTIONS 200` con los mismos encabezados.

## 4) Esquema de BD relevante
### 4.1 Tabla correcta para actualizar: `asistencias`
> Antes se usaba `attendance` (inexistente). Debe consultarse/actualizarse `public.asistencias`.

| columna       | tipo                          | nullable | default                                   |
|---------------|-------------------------------|----------|-------------------------------------------|
| `id`          | `bigint` (PK, identity)       | ❌       | `generated always as identity`            |
| `created_at`  | `timestamp with time zone`    | ❌       | `now()`                                    |
| `semana_id`   | `bigint`                      | ❌       | — (FK a `semanas_cn.id`)                   |
| `user_id`     | `uuid`                        | ❌       | — (FK a `auth.users.id`)                   |
| `bar_id`      | `bigint`                      | ✅       | `null` (FK opcional a `bares.id`)          |
| `asistentes`  | `integer`                     | ✅       | `null`                                     |
| `confirmado`  | `boolean`                     | ✅       | `false`                                    |
| `updated_at`  | `timestamp with time zone`    | ✅       | `null` (trigger de actualización opcional) |

- **PK real (`<pk_real>`):** `id`.
- Índice compuesto recomendado: `unique(user_id, semana_id)` para evitar duplicados por usuario-semana.

### 4.2 Otras tablas usadas por el frontend
- `bares`: columnas clave `id`, `nombre`, `instagram_url`, `facebook_url`, `activo boolean default true`, `created_at`.
- `semanas_cn`: gestiona el histórico de semanas (`id`, `fecha_martes`, `estado`, `bar_id`, `bar_ganador`, `total_asistentes`, `hubo_quorum`, `created_at`).
- `semana_actual`: vista materializada/señalador de la semana abierta.
- `usuarios`: datos de perfiles (`id`, `nombre`, `avatar_url`, `created_at`, etc.).
- `votos`, `visitas_bares`, `estadisticas_bares`, `ganadores`, `semanas`: proveen métricas complementarias para dashboards y gráficos.

## 5) Políticas de seguridad (RLS)
Activar y documentar las policies en `asistencias`:

```sql
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(auth.email() in ('ahidalgod@gmail.com'), false);
$$;

alter table public.asistencias enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='asistencias' and policyname='asistencias update own') then
    create policy "asistencias update own"
    on public.asistencias for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='asistencias' and policyname='asistencias admin can update all') then
    create policy "asistencias admin can update all"
    on public.asistencias for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;
```

Para `bares` (lectura):

```sql
alter table public.bares enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bares' and policyname='bares read') then
    create policy "bares read" on public.bares for select to authenticated using (true);
  end if;
end $$;
```

## 6) Notas de implementación (Functions)
- Crear el cliente admin **solo** con claves de servidor:
  ```js
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
- Manejar `OPTIONS`, parseo JSON y mapear errores (`422`/`403`/`500`) siempre con `Content-Type: application/json` y encabezados CORS en todas las ramas.
- Query de actualización (usar la PK real `id`):
  ```js
  const { data, error } = await supabase
    .from('asistencias')
    .update(fields)
    .eq('id', week_id)
    .select();
  ```
- Validar alias (`weekId`, `id`, `asistencia_id`, `update`, `data`) antes de ejecutar la query.
- Netlify CLI para entorno local:
  ```bash
  npm install
  netlify dev
  ```
  Asegúrate de exportar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` antes de iniciar. Las funciones deben ejecutarse bajo Netlify para respetar rutas `/.netlify/functions/*`.
- Panel `admin.html` requiere inicio de sesión con correo autorizado; el modal **Editar** reutiliza la función `updateAttendance`.
- Para correcciones complejas usar `scripts/updateWeekBar.js` (requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).

## 7) Deploy y configuración
- En Netlify, tras cambiar variables o el código de Functions, ejecutar **Clear cache and deploy site**.
- Ubicación de variables: Netlify → **Settings → Environment variables → All scopes → Same value for all deploy contexts**.
- Netlify Functions deben correr con **Node 18** y `node_bundler = "esbuild"` (ver `netlify.toml`). Versiones previas pueden romper `fetch` o el cliente de Supabase.
- No usar prefijo `VITE_` para claves de servidor ni exponer el `service_role` al cliente.
- Confirmar que el frontend lee `SUPABASE_URL`/`SUPABASE_ANON_KEY` desde `config.js` (no inyectar claves sensibles en HTML).

## 8) Diagnóstico y logs
- **Frontend**: DevTools → pestaña *Network*. Deben verse `OPTIONS 200` y `POST 200/403/422` con JSON. Si aparece `TypeError: fetch failed`, revisar CORS/URL.
- **Netlify**: Dashboard → *Functions* → `updateAttendance` → *Logs* (errores en tiempo real y `console.log`).
- **Supabase**: Panel → *Logs → API* (PostgREST) y *Logs → Database* (errores SQL/RLS). Útil para validar policies y queries.

> 🧪 Logs clave durante incidentes:
> - `ENV SANITY` → muestra un extracto de la URL (sin protocolo), si existe la service role y la longitud de la clave. `hasSrv: false` o `lenSrv: 0` indican variables mal configuradas.
> - `PING REST` → `ok: true` o `status` diferentes de `undefined` confirman salida a Internet y DNS correcto. Errores tipo `getaddrinfo ENOTFOUND` apuntan a URL inválida o sin protocolo `https://`.
> - `POSTGREST ERROR/FETCH ERROR` → solo aparecen si el cliente de Supabase falla. Permiten distinguir entre error de red (`egress error`) y respuestas reales de PostgREST (`status 40x/422`).

## 9) Pruebas rápidas
### 9.1 cURL (sin frontend)
```bash
curl -i -X POST "https://corkys.netlify.app/.netlify/functions/updateAttendance" \
  -H "Content-Type: application/json" \
  -d '{"week_id": <ID>, "fields": {"bar_id": 5, "asistentes": 42}}'
```

### 9.2 Ver columnas (SQL)
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'asistencias'
ORDER BY ordinal_position;
```

## 10) Cambios históricos que rompieron producción (lecciones)
- Tabla mal nombrada: el backend apuntaba a `attendance` (inexistente) → se cambió a `asistencias`.
- Columna faltante: el frontend pedía `bares.activo` que no existía → se creó `activo boolean default true`.
- Variables de entorno ausentes: faltaba `SUPABASE_SERVICE_ROLE_KEY` → agregada en Netlify.
- CORS incompleto: la Function no respondía `OPTIONS` ni enviaba CORS en errores → ahora responde siempre con CORS + JSON.

## 11) Checklist de salud (pre-deploy)
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` configuradas en Netlify.
- [ ] Tabla destino correcta: `asistencias` (no `attendance`).
- [ ] Policies RLS (`update own` y `admin can update all`) creadas y probadas.
- [ ] Function responde `OPTIONS 200` y errores con JSON + CORS.
- [ ] `curl` de prueba devuelve `200/403/422` (no “fetch failed”).
- [ ] Front envía `{ week_id, fields }` con nombres de columna válidos y valores sanitizados.
- [ ] Después de cambios críticos, ejecutar `Clear cache and deploy site` en Netlify.
