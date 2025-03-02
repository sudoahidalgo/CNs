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
        .select('id')
        .eq('ip', ip)
        .gte('timestamp', weekStart.toISOString());

      if (checkError) throw checkError;

      if (existingVotes.length > 0) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Already voted this week" }),
        };
      }

      // Grabar el voto
      const { error: insertError } = await supabase
        .from('votes')
        .insert([{ ip, place, timestamp: today.toISOString() }]);

      if (insertError) throw insertError;

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
