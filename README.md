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
- `SUPABASE_SERVICE_ROLE_KEY` – la clave **service role** para las funciones backend.
- `ALLOWED_ORIGINS` – lista separada por comas de orígenes permitidos para CORS. Por defecto admite `https://corkys.netlify.app` y `http://localhost:8888`.

> ℹ️ A diferencia del `anon key`, la clave `service role` permite saltarse las políticas RLS para operaciones administrativas. Si sólo configuras el `anon key` la función `updateAttendance` devolverá un **403 Forbidden**.

### Configuración en Netlify

1. Entra al panel del sitio en [Netlify](https://app.netlify.com/) y abre **Site configuration → Environment variables**.
2. Añade las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` con los valores de tu proyecto de Supabase.
3. (Opcional) Añade `ALLOWED_ORIGINS` con la lista de orígenes permitidos separados por comas si necesitas aceptar dominios adicionales.
4. Guarda los cambios y vuelve a desplegar el sitio para que las funciones serverless reciban las nuevas variables.

Estas variables deben estar disponibles en el entorno donde se despliegan las funciones serverless `netlify/functions/vote.js` y `netlify/functions/updateAttendance.js`.

En el frontend, las credenciales de Supabase se definen en `config.js`. Los archivos `index.html`, `admin.html` y `votacion.html` importan estas constantes desde ese módulo en lugar de declararlas de forma individual.

## Local Development

Para que las rutas `/.netlify/functions/*` funcionen correctamente se deben servir los archivos HTML con Netlify.

```bash
npm install -g netlify-cli        # if not installed
netlify dev                        # runs functions locally
```

Antes de ejecutar `netlify dev` asegúrate de que las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén disponibles en el entorno. Si abres los archivos HTML directamente sin usar Netlify el `fetch` en `weekEdit.js` fallará.

### Pruebas manuales recomendadas

1. Exporta las variables necesarias y arranca el entorno local con Netlify:

   ```bash
   export SUPABASE_URL="https://<tu-proyecto>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<tu-service-role>"
   export ALLOWED_ORIGINS="http://localhost:8888,https://corkys.netlify.app" # opcional
   netlify dev
   ```

2. Abre `http://localhost:8888/admin.html`, inicia sesión con un correo autorizado y haz clic en **Editar** sobre la semana que quieres modificar.
3. Selecciona un bar y asistentes, guarda los cambios y confirma que el modal muestra el mensaje de éxito. En la pestaña **Network** deberías ver que `/.netlify/functions/updateAttendance` responde **200** y que el `preflight` (método OPTIONS) devuelve **204** con las cabeceras `Access-Control-Allow-*`.
4. Si quieres probar la validación de errores, envía un payload inválido desde la consola del navegador:

   ```js
   fetch('/.netlify/functions/updateAttendance', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: '{ invalid'
   }).then(r => r.json())
   ```

   El servicio debe responder **422** con el mensaje `Invalid JSON payload`.


## Proceso Semanal

Cada martes se actualizan las estadísticas y se registra el bar ganador en la tabla `semanas_cn`. Esto se realiza mediante la función almacenada `process_weekly_reset`, la cual finaliza la semana vigente, crea una nueva y reinicia los votos.

## Panel de Administración

Abre `admin.html` y accede con un correo autorizado para ver el panel. Desde allí puedes finalizar la semana actual, ejecutar el proceso semanal o borrar todos los votos con los botones **Finalizar Semana** y **Resetear Votos**. También puedes corregir semanas anteriores utilizando el botón **Editar**, que abre un formulario para actualizar el bar visitado y los asistentes confirmados.

## Script para corregir una semana

Para actualizar manualmente el bar visitado en una fecha específica puedes usar el script `scripts/updateWeekBar.js`.

```
SUPABASE_URL=<tu URL> \
SUPABASE_SERVICE_ROLE_KEY=<tu service role key> \
node scripts/updateWeekBar.js <YYYY-MM-DD> <texto a buscar del bar>
```

El script busca el bar que contenga el texto indicado, obtiene los asistentes confirmados de esa semana y ejecuta la función `update_week_and_visits` para mantener la asistencia.
