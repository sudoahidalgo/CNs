# CNs
¿Dónde vamos a la CN hoy?

* Los eventos de CN siempre se realizan los **martes**.
* La votación queda abierta cada semana hasta el **martes a las 23:00**.
* Los votos emitidos después de esa hora son ignorados por `vote.js`.

## Variables de Entorno

Para ejecutar las funciones de Netlify se necesitan dos variables de entorno:

- `SUPABASE_URL` – la URL de tu proyecto de Supabase.
- `SUPABASE_SERVICE_KEY` – la clave de servicio para las funciones backend.

Estas variables deben estar disponibles en el entorno donde se despliega `netlify/functions/vote.js`.

La función `netlify/functions/updateAttendance.js` también usa estas variables para modificar las asistencias y el bar ganador desde el panel de administración.

Si alguna de estas variables falta, `updateAttendance.js` registrará un error y responderá con un estado 500. Asegúrate de configurarlas en las variables de entorno de tu sitio en Netlify.

## Proceso Semanal

Cada martes se actualizan las estadísticas y se registra el bar ganador en la tabla `semanas_cn`. Esto se realiza mediante la función almacenada `process_weekly_reset`, la cual finaliza la semana vigente, crea una nueva y reinicia los votos.

## Panel de Administración

Abre `admin.html` y accede con un correo autorizado para ver el panel. Desde allí puedes finalizar la semana actual, ejecutar el proceso semanal o borrar todos los votos con los botones **Finalizar Semana** y **Resetear Votos**. También puedes corregir semanas anteriores utilizando el botón **Editar**, que abre un formulario para actualizar el bar visitado y los asistentes confirmados.
