# CNs — Guía Técnica

📖 **Estructura del proyecto**

## Arquitectura
- **Frontend:** App estática desplegada en Netlify → [https://corkys.netlify.app](https://corkys.netlify.app).
- **Backend:** Netlify Functions privadas que orquestan operaciones sobre Supabase vía PostgREST.
- **Base de datos:** Supabase (PostgreSQL) usando exclusivamente el esquema `public`.

## Variables de entorno en Netlify
Configurar en *Site settings → Environment variables* para production, deploy previews y branch deploys. **Verifica que no tengan espacios en blanco antes/después y que `SUPABASE_URL` incluya el prefijo `https://`.**

| Variable | Uso sugerido | Nota |
|----------|--------------|------|
| `SUPABASE_URL` | URL base del proyecto Supabase (sin `/` final). | Ejemplo válido: `https://xxx.supabase.co`. |
| `SUPABASE_ANON_KEY` | Clave pública expuesta en el frontend. | Disponible para llamadas desde el navegador. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave con permisos elevados usada **solo** en Functions. | No exponer jamás en el frontend. |

> Tras modificar variables se recomienda **Clear cache and deploy site** para que Netlify vuelva a construir Functions con los valores actualizados.

### Checklist rápido de validación
- Ejecuta `https://<tu-sitio>.netlify.app/.netlify/functions/updateAttendance?health=1` para confirmar que las credenciales de Supabase están bien configuradas (`env.url`, `env.srk`, `rest.ok` y `auth.ok` deben ser `true`).
- Si el `health` responde con `503` revisa que las variables estén definidas y sin errores tipográficos.
- Un error `{"error":"upstream fetch failed","code":"ENOTFOUND"}` suele indicar problemas de resolución DNS del lado de Netlify o una URL mal escrita. Desde marzo 2024 la Function fuerza IPv4, por lo que si persiste revisa que el dominio de Supabase sea correcto y accesible.

## Tablas principales (resumen funcional)
- **`semanas_cn`**: Define cada semana (fecha, bar ganador, estado, totales). Columna clave: `bar_ganador` (texto del bar ganador).
- **`asistencias`**: Registro de cada usuario confirmado por semana (`user_id`, `semana_id`).
- **`visitas_bares`**: Histórico de bares visitados en cada semana (`semana_id`, `bar`).
- **`votos`**: Votos individuales por bar/semana (`user_id`, `bar`, `semana_id`).
- **`bares`**: Catálogo de bares (`id`, `nombre`, `activo`).
- **`usuarios`**: Catálogo de usuarios (con `uuid`).

🔑 La UI de “Última vez que ganó” se alimenta de `semanas_cn.bar_ganador` y/o de `visitas_bares`. El error 500 se producía porque la Function intentaba actualizar columnas inexistentes en otras tablas.

## API interna — Function `updateAttendance`
- **Endpoint:** `POST /.netlify/functions/updateAttendance`
- **Payload JSON esperado:**
  ```json
  {
    "week_id": 1366,
    "bar_id": 32,
    "add_user_ids": ["uuid1", "uuid2"],
    "recompute_total": true
  }
  ```
- **Alias aceptados:** `weekId`, `id`, `bar`, `bar_nombre`, `user_ids`.

### Efectos
1. Actualiza `semanas_cn.bar_ganador`.
2. Sincroniza `visitas_bares.bar` para esa semana.
3. Inserta asistencias para los `user_id` recibidos (`confirmado=true`).
4. Opcionalmente recalcula `semanas_cn.total_asistentes`.

### Respuestas posibles
- `200 { ok: true }`
- `422 { error: "Missing week_id" | "Invalid JSON" | ... }`
- `403 { error: "permission denied" }`
- `500 { error: "..." }`

## 🔍 Diccionario de datos (anexo técnico)
Salida basada en `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;`

#### Tabla: asistencias
| Columna    | Tipo        | Nullable | Default                                    |
|------------|-------------|----------|--------------------------------------------|
| id         | bigint      | NO       | nextval('asistencias_id_seq'::regclass)     |
| user_id    | uuid        | YES      |                                            |
| semana_id  | bigint      | YES      |                                            |
| confirmado | boolean     | YES      |                                            |
| created_at | timestamptz | YES      | now()                                      |

#### Tabla: bares
| Columna        | Tipo        | Nullable | Default                                 |
|----------------|-------------|----------|-----------------------------------------|
| id             | bigint      | NO       | nextval('bares_id_seq'::regclass)       |
| nombre         | text        | NO       |                                         |
| instagram_url  | text        | YES      |                                         |
| facebook_url   | text        | YES      |                                         |
| activo         | boolean     | YES      | true                                    |
| created_at     | timestamptz | YES      | now()                                   |
| updated_at     | timestamptz | YES      | now()                                   |

#### Tabla: semanas_cn
| Columna          | Tipo        | Nullable | Default                                       |
|------------------|-------------|----------|-----------------------------------------------|
| id               | bigint      | NO       | nextval('semanas_cn_id_seq'::regclass)        |
| fecha_martes     | date        | YES      |                                               |
| bar_ganador      | text        | YES      |                                               |
| total_votos      | integer     | YES      |                                               |
| total_asistentes | integer     | YES      |                                               |
| hubo_quorum      | boolean     | YES      | false                                         |
| estado           | text        | YES      |                                               |
| created_at       | timestamptz | YES      | now()                                         |
| updated_at       | timestamptz | YES      | now()                                         |

#### Tabla: usuarios
| Columna    | Tipo        | Nullable | Default                               |
|------------|-------------|----------|---------------------------------------|
| id         | uuid        | NO       | uuid_generate_v4()                    |
| nombre     | text        | YES      |                                       |
| avatar_url | text        | YES      |                                       |
| created_at | timestamptz | YES      | now()                                 |

#### Tabla: visitas_bares
| Columna      | Tipo        | Nullable | Default                                       |
|--------------|-------------|----------|-----------------------------------------------|
| id           | bigint      | NO       | nextval('visitas_bares_id_seq'::regclass)     |
| semana_id    | bigint      | YES      |                                               |
| bar          | text        | YES      |                                               |
| asistentes   | integer     | YES      |                                               |
| fecha_visita | timestamptz | YES      |                                               |
| created_at   | timestamptz | YES      | now()                                         |

#### Tabla: votos
| Columna    | Tipo        | Nullable | Default                                 |
|------------|-------------|----------|-----------------------------------------|
| id         | bigint      | NO       | nextval('votos_id_seq'::regclass)       |
| user_id    | uuid        | YES      |                                         |
| bar        | text        | YES      |                                         |
| semana_id  | bigint      | YES      |                                         |
| created_at | timestamptz | YES      | now()                                   |
| origen     | text        | YES      |                                         |

#### Tabla: ganadores
| Columna    | Tipo        | Nullable | Default |
|------------|-------------|----------|---------|
| semana_id  | bigint      | NO       |         |
| bar        | text        | YES      |         |
| created_at | timestamptz | YES      | now()   |

