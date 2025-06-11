CREATE OR REPLACE FUNCTION update_week_and_visits(
    week_id bigint,
    bar text,
    attendees text[]
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the week summary
    UPDATE semanas_cn
       SET bar_ganador = bar,
           total_asistentes = COALESCE(array_length(attendees, 1), 0),
           hubo_quorum = COALESCE(array_length(attendees, 1), 0) >= 3
     WHERE id = week_id;

    -- Replace attendance rows
    DELETE FROM asistencias WHERE semana_id = week_id;

    IF attendees IS NOT NULL AND array_length(attendees, 1) > 0 THEN
        INSERT INTO asistencias (user_id, semana_id, confirmado)
        SELECT a, week_id, TRUE FROM unnest(attendees) AS a;
    END IF;

    -- Record the latest visit for the bar
    IF bar IS NOT NULL THEN
        INSERT INTO visitas_bares (bar, semana_id)
        VALUES (bar, week_id)
        ON CONFLICT (bar) DO UPDATE
          SET semana_id = EXCLUDED.semana_id;
    END IF;
END;
$$;
