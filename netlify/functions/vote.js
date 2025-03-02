const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Usa la Service Role Key para funciones backend
);

exports.handler = async (event) => {
  const ip = event.headers["client-ip"] || "unknown";
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 5) % 7)); // Martes como inicio
  weekStart.setHours(0, 0, 0, 0);

  if (event.httpMethod === "GET") {
    try {
      const { data: votes, error } = await supabase
        .from('votes')
        .select('place')
        .gte('timestamp', weekStart.toISOString());

      if (error) throw error;

      const votesThisWeek = votes.reduce((acc, vote) => {
        acc[vote.place] = (acc[vote.place] || 0) + 1;
        return acc;
      }, {});

      return {
        statusCode: 200,
        body: JSON.stringify(votesThisWeek),
      };
    } catch (error) {
      console.error("GET error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch votes", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const { place } = JSON.parse(event.body);

      // Verificar si la IP ya votó esta semana
      const { data: existingVotes, error: checkError } = await supabase
        .from('votes')
        .select('id, place')
        .eq('ip', ip)
        .gte('timestamp', weekStart.toISOString())
        .single(); // Obtiene un solo registro (el más reciente)

      if (checkError && checkError.code !== 'PGRST116') throw checkError; // PGRST116 es "no rows found", lo manejamos a continuación

      if (existingVotes) {
        // Si la IP ya votó, actualiza el voto existente
        const { error: updateError } = await supabase
          .from('votes')
          .update({ place, timestamp: today.toISOString() })
          .eq('id', existingVotes.id);

        if (updateError) throw updateError;
      } else {
        // Si no ha votado, crea un nuevo voto
        const { error: insertError } = await supabase
          .from('votes')
          .insert([{ ip, place, timestamp: today.toISOString() }]);

        if (insertError) throw insertError;
      }

      // Obtener votos actualizados
      const { data: updatedVotes, error: fetchError } = await supabase
        .from('votes')
        .select('place')
        .gte('timestamp', weekStart.toISOString());

      if (fetchError) throw fetchError;

      const votesThisWeek = updatedVotes.reduce((acc, vote) => {
        acc[vote.place] = (acc[vote.place] || 0) + 1;
        return acc;
      }, {});

      return {
        statusCode: 200,
        body: JSON.stringify(votesThisWeek),
      };
    } catch (error) {
      console.error("POST error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to record vote", details: error.message }),
      };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
