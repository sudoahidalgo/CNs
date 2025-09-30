# CNs
¿Dónde vamos a la CN hoy?

* Los eventos de CN siempre se realizan los **martes**.
* La votación queda abierta cada semana hasta el **martes a las 23:00**.
* Los votos emitidos después de esa hora son ignorados por `vote.js`.

## Setup

Antes de ejecutar las pruebas o las funciones de Netlify de forma local, asegúrate de instalar las dependencias con:

```bash
npm install
```

## Variables de Entorno

Para ejecutar las funciones de Netlify se necesitan las siguientes variables de entorno:

- `SUPABASE_URL` – la URL de tu proyecto de Supabase.
- `SUPABASE_SERVICE_KEY` – la clave de servicio para las funciones backend.
- `ALLOWED_ORIGINS` – lista separada por comas de orígenes permitidos para CORS. Por defecto admite `https://corkys.netlify.app` y `http://localhost:8888`.

Estas variables deben estar disponibles en el entorno donde se despliegan las funciones serverless `netlify/functions/vote.js` y `netlify/functions/updateAttendance.js`.

En el frontend, las credenciales de Supabase se definen en `config.js`. Los archivos `index.html`, `admin.html` y `votacion.html` importan estas constantes desde ese módulo en lugar de declararlas de forma individual.

## Local Development

Para que las rutas `/.netlify/functions/*` funcionen correctamente se deben servir los archivos HTML con Netlify.

```bash
npm install -g netlify-cli        # if not installed
netlify dev                        # runs functions locally
```

Antes de ejecutar `netlify dev` asegúrate de que las variables `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` estén disponibles en el entorno. Si abres los archivos HTML directamente sin usar Netlify el `fetch` en `weekEdit.js` fallará.

### Pruebas manuales recomendadas

1. Inicia el entorno local con `netlify dev` exportando las variables de entorno indicadas y, opcionalmente, define `ALLOWED_ORIGINS="http://localhost:8888,https://corkys.netlify.app"` para habilitar CORS tanto local como en producción.
2. Desde el navegador abre `http://localhost:8888/admin.html`, inicia sesión y utiliza el formulario **Editar** para actualizar una semana.
3. En la pestaña **Network** verifica que el `fetch` a `/.netlify/functions/updateAttendance` responda `200` y que la cabecera `Access-Control-Allow-Origin` coincida con tu origen.
4. Para comprobar el preflight puedes ejecutar:

   ```bash
   curl -i \
     -H "Origin: https://corkys.netlify.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: authorization,content-type" \
     -X OPTIONS http://localhost:8888/.netlify/functions/updateAttendance
   ```

   Debe responder con `HTTP/1.1 200 OK` y las cabeceras `Access-Control-Allow-*` configuradas.


## Proceso Semanal

Cada martes se actualizan las estadísticas y se registra el bar ganador en la tabla `semanas_cn`. Esto se realiza mediante la función almacenada `process_weekly_reset`, la cual finaliza la semana vigente, crea una nueva y reinicia los votos.

## Panel de Administración

Abre `admin.html` y accede con un correo autorizado para ver el panel. Desde allí puedes finalizar la semana actual, ejecutar el proceso semanal o borrar todos los votos con los botones **Finalizar Semana** y **Resetear Votos**. También puedes corregir semanas anteriores utilizando el botón **Editar**, que abre un formulario para actualizar el bar visitado y los asistentes confirmados.

## Script para corregir una semana

Para actualizar manualmente el bar visitado en una fecha específica puedes usar el script `scripts/updateWeekBar.js`.

```
SUPABASE_URL=<tu URL> \
SUPABASE_SERVICE_KEY=<tu service key> \
node scripts/updateWeekBar.js <YYYY-MM-DD> <texto a buscar del bar>
```

El script busca el bar que contenga el texto indicado, obtiene los asistentes confirmados de esa semana y ejecuta la función `update_week_and_visits` para mantener la asistencia.
