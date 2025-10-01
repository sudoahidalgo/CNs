# CNs — Guía Técnica

## Arquitectura
- **Frontend:** aplicación estática desplegada en Netlify (dominio público). Consume Supabase desde el navegador mediante la clave anónima.
- **Backend:**
  - **Netlify Functions** como capa serverless privada (`/.netlify/functions/*`).
  - **Supabase** provee autenticación, PostgREST y acceso directo al esquema `public` de PostgreSQL.
  - Las Functions utilizan la `SERVICE_ROLE_KEY` para ejecutar operaciones administrativas y coordinar PostgREST.
- **Infraestructura compartida:**
  - `netlify.toml` define builds y redirecciones.
  - `config.js` expone `SUPABASE_URL` y `SUPABASE_ANON_KEY` en el navegador.
  - `weekEdit.js`/`admin.html` orquestan la edición de semana consumiendo la función `updateAttendance`.

## Variables de entorno (Netlify → Environment variables)
Configurar en Netlify (Settings → Environment variables) para todos los contexts (Production, Deploy previews, Branch deploys):

| Variable | Scope | Uso |
|----------|-------|-----|
| `SUPABASE_URL` | Builds, Functions, Runtime | URL del proyecto Supabase **sin `/` final**. Ej: `https://<project>.supabase.co`. |
| `SUPABASE_ANON_KEY` | Builds, Runtime | Clave pública usada por el frontend (no exponer en Functions). |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions, Runtime | Clave con permisos elevados para Netlify Functions. **Nunca** exponer en frontend ni en variables `VITE_*`. |

> Tras editar variables, ejecutar **Clear cache and deploy site** en Netlify para que las Functions tomen el nuevo valor.

## Esquema de Base de Datos (schema `public`)
### Tablas clave
#### `semanas_cn`
| columna | tipo | descripción |
|---------|------|-------------|
| `id` | `integer` (PK) | Identificador de semana. |
| `fecha_martes` | `date` | Fecha del martes de esa semana de CN. |
| `bar_ganador` | `text` | Bar ganador (nombre texto). |
| `total_votos` | `integer` | Total de votos registrados. |
| `total_asistentes` | `integer` (nullable) | Total de asistentes confirmados (si la columna existe). |
| `estado` | `text` | Estado de la semana (abierta, cerrada, etc.). |
| `created_at`, `updated_at` | `timestamp` | Timestamps de auditoría. |

- Define el bar ganador por semana (`bar_ganador`).

#### `asistencias`
| columna | tipo | descripción |
|---------|------|-------------|
| `id` | `integer` (PK) | Identificador del registro de asistencia. |
| `user_id` | `uuid` | Usuario que confirma asistencia. |
| `semana_id` | `integer` | FK hacia `semanas_cn.id`. |
| `confirmado` | `boolean` | Marca asistencia confirmada (`true` cuando se agrega desde la función). |
| `created_at` | `timestamp` | Fecha de creación del registro. |

- Un registro por persona y semana.

#### `visitas_bares`
| columna | tipo | descripción |
|---------|------|-------------|
| `id` | `integer` (PK) | Identificador de la visita. |
| `bar` | `text` | Nombre del bar visitado. |
| `semana_id` | `integer` | Semana a la que corresponde la visita. |
| `asistentes` | `integer` (nullable) | Conteo manual de asistentes. |
| `fecha_visita` | `timestamp` | Fecha y hora de la visita. |
| `created_at` | `timestamp` | Registro de creación. |

- Histórico de bares (texto) por semana, usado para “⏰ Última vez que ganó”.

#### `votos`
| columna | tipo | descripción |
|---------|------|-------------|
| `id` | `integer` (PK) | Identificador del voto. |
| `bar` | `text` | Bar votado (nombre texto). |
| `user_id` | `uuid` | Usuario que votó. |
| `semana_id` | `integer` | Semana asociada al voto. |
| `created_at` | `timestamp` | Fecha del voto. |

- Votos por bar y semana.

#### `bares`
| columna | tipo | descripción |
|---------|------|-------------|
| `id` | `integer` (PK) | Identificador del bar. |
| `nombre` | `text` | Nombre canónico. |
| `activo` | `boolean` | Indica si se puede mostrar en la UI. |
| `created_at`, `updated_at` | `timestamp` | Auditoría. |

- Fuente de bares disponibles. La UI usa `semanas_cn.bar_ganador` y/o `visitas_bares` para “⏰ Última vez que ganó”.

### Relaciones destacadas
- `asistencias.semana_id` ↔ `semanas_cn.id` (1:N).
- `votos.semana_id` ↔ `semanas_cn.id` (1:N).
- `visitas_bares.semana_id` ↔ `semanas_cn.id` (1:1 opcional).
- `visitas_bares.bar` y `votos.bar` guardan texto, pero pueden mapearse con `bares.nombre` en la UI/Functions.

## API interna (Function) — `POST /.netlify/functions/updateAttendance`
### Request JSON
```json
{
  "week_id": 1366,
  "bar_id": 32,
  "bar_nombre": "Otro",
  "add_user_ids": ["uuid1", "uuid2"],
  "recompute_total": true
}
```

Alias aceptados: `weekId` — también `id`; `barId`; `bar` o `barNombre`; `user_ids` para `add_user_ids`.

### Efectos
- `semanas_cn.bar_ganador` se actualiza a `<bar_nombre>`.
- `visitas_bares.bar` se sincroniza con `<bar_nombre>` cuando existe fila para esa semana.
- Inserta filas en `asistencias` para cada `user_id` con `confirmado=true` (evitar duplicados via `ON CONFLICT DO NOTHING`).
- `semanas_cn.total_asistentes` se recalcula con el conteo de `asistencias` cuando `recompute_total` es `true` y la columna existe.

### Responses
- `200 { "ok": true }`
- `422 { "error": "Missing week_id" | "Invalid JSON" | "bar_id not found" }`
- `403 { "error": "permission denied" }` (si falla por políticas RLS).
- `500 { "error": "..." }` para errores inesperados.

### CORS
- Responder `OPTIONS 200`.
- Incluir en **todas** las respuestas:
  - `Access-Control-Allow-Origin: https://corkys.netlify.app`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
  - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`

## Troubleshooting
- `TypeError: fetch failed` → revisar `SUPABASE_URL` (https, sin espacios, sin slash final) y `SUPABASE_SERVICE_ROLE_KEY` válida.
- Respuesta `422` → payload incompleto o columnas inexistentes; revisar los campos enviados.
- Para validar despliegue/redeploy de Functions y pruebas manuales usar:
  ```bash
  curl -i -X POST "$SITE/.netlify/functions/updateAttendance" \
    -H "Content-Type: application/json" \
    -d '{"week_id":1366,"bar_id":32,"add_user_ids":["<uuid1>","<uuid2>"],"recompute_total":true}'
  ```

## Flujo de edición (UI)
1. Abrir modal de edición en la UI y definir `data-week-id` con `row.id` de `semanas_cn`.
2. Enviar payload `{ week_id, bar_id?, bar_nombre?, add_user_ids[], recompute_total: true }` a `/.netlify/functions/updateAttendance`.
3. Validar respuesta `200` y refrescar la vista (re-fetch de semana y tablas).

## SQL útiles (referencia)
```sql
-- Ver últimas semanas
SELECT id, fecha_martes, bar_ganador, total_votos, estado
FROM public.semanas_cn
ORDER BY id DESC
LIMIT 10;

-- Ver asistentes de una semana
SELECT u.nombre
FROM public.asistencias a
JOIN public.usuarios u ON u.id = a.user_id
WHERE a.semana_id = 1366
ORDER BY u.nombre;

-- Actualización manual de bar ganador
UPDATE public.semanas_cn
SET bar_ganador = 'Otro'
WHERE id = 1366;

UPDATE public.visitas_bares
SET bar = 'Otro'
WHERE semana_id = 1366;
```

## Criterio de aceptación
- README documentado con los contratos anteriores.
- Desplegar nuevamente las Functions tras cambios de variables.
- Pruebas manuales (curl) retornan `200 {"ok": true}`.
