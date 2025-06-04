# CNs
¿Dónde vamos a la CN hoy?

* Los eventos de CN siempre se realizan los **martes**.
* La votación queda abierta cada semana hasta el **martes a las 23:59**.
* Los votos emitidos después de esa hora son ignorados por `vote.js`.

## Variables de Entorno

Para ejecutar las funciones de Netlify se necesitan dos variables de entorno:

- `SUPABASE_URL` – la URL de tu proyecto de Supabase.
- `SUPABASE_SERVICE_KEY` – la clave de servicio para las funciones backend.

Estas variables deben estar disponibles en el entorno donde se despliega `netlify/functions/vote.js`.

## Proceso Semanal

Cada martes se actualizan las estadísticas y se registra el bar ganador en la tabla `semanas_cn`. Esto se realiza mediante la función almacenada `process_weekly_reset`, la cual finaliza la semana vigente, crea una nueva y reinicia los votos.

## Panel de Administración

Abre `admin.html` y accede con un correo autorizado para ver el panel. Desde allí puedes finalizar la semana actual, ejecutar el proceso semanal o borrar todos los votos con los botones **Finalizar Semana** y **Resetear Votos**.
