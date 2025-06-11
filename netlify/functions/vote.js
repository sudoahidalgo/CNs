const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE configuration');
  exports.handler = async () => ({
    statusCode: 500,
    body: JSON.stringify({ error: 'Missing SUPABASE configuration' })
  });
  return;
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Usa la Service Role Key para funciones backend
);

exports.handler = async (event) => {
  const ip = event.headers["client-ip"] || "unknown";
  const today = new Date();
  const weekStart = new Date(today);
  // Calcular el martes anterior a las 00:00 como inicio de la semana
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

      // También devolver los lugares
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      return {
        statusCode: 200,
        body: JSON.stringify({
          votes: votesThisWeek,
          places: placesData.map(p => p.name)
        }),
      };
    } catch (error) {
      console.error("GET error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch votes or places", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const { place } = JSON.parse(event.body);

      // Calcular la fecha límite de votación: martes a las 23:00 UTC
      const votingDeadline = new Date(weekStart);
      votingDeadline.setUTCHours(23, 0, 0, 0);

      // Si ya pasó la fecha límite, rechazar el voto
      if (today > votingDeadline) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Voting closed" }),
        };
      }

      // Contar cuántos votos ha hecho esta IP esta semana
      const { data: existingVotes, error: checkError } = await supabase
        .from('votes')
        .select('id, place')
        .eq('ip', ip)
        .gte('timestamp', weekStart.toISOString());

      if (checkError) throw checkError;

      const voteCount = existingVotes.length;

      if (voteCount >= 3) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Maximum 3 votes per IP per week reached" }),
        };
      }

      // Verificar si la IP ya votó por este lugar esta semana
      const existingVoteForPlace = existingVotes.find(vote => vote.place === place);

      if (existingVoteForPlace) {
        // Si ya votó por este lugar, actualiza el timestamp (opcional, para mantenerlo actualizado)
        const { error: updateError } = await supabase
          .from('votes')
          .update({ timestamp: today.toISOString() })
          .eq('id', existingVoteForPlace.id);

        if (updateError) throw updateError;
      } else {
        // Si no ha votado por este lugar, crea un nuevo voto
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

  if (event.httpMethod === "PUT") { // Agregar un nuevo lugar
    try {
      const { place } = JSON.parse(event.body);

      // Verificar si el lugar ya existe
      const { data: existingPlace, error: checkError } = await supabase
        .from('places')
        .select('name')
        .eq('name', place)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (!existingPlace) {
        const { error: insertError } = await supabase
          .from('places')
          .insert([{ name: place }]);

        if (insertError) throw insertError;
      }

      // Devolver todos los lugares actualizados
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      return {
        statusCode: 200,
        body: JSON.stringify(placesData.map(p => p.name)),
      };
    } catch (error) {
      console.error("PUT error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to add place", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "DELETE") { // Eliminar un lugar
    try {
      const { place } = JSON.parse(event.body);

      const { error: deleteError } = await supabase
        .from('places')
        .delete()
        .eq('name', place);

      if (deleteError) throw deleteError;

      // Devolver todos los lugares actualizados
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      return {
        statusCode: 200,
        body: JSON.stringify(placesData.map(p => p.name)),
      };
    } catch (error) {
      console.error("DELETE error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to delete place", details: error.message }),
      };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
