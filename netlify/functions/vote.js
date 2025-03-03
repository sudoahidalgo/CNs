const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const ip = event.headers["client-ip"] || "unknown";
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  console.log(`Received ${event.httpMethod} request from IP: ${ip}`);

  if (event.httpMethod === "GET") {
    try {
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('place')
        .gte('timestamp', weekStart.toISOString());

      if (votesError) throw votesError;

      const votesThisWeek = votes.reduce((acc, vote) => {
        acc[vote.place] = (acc[vote.place] || 0) + 1;
        return acc;
      }, {});

      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      const { data: winnersData, error: winnersError } = await supabase
        .from('winners')
        .select('place, date');

      if (winnersError) throw winnersError;

      console.log("GET response:", { votes: votesThisWeek, places: placesData, winners: winnersData });
      return {
        statusCode: 200,
        body: JSON.stringify({
          votes: votesThisWeek,
          places: placesData.map(p => p.name),
          winners: winnersData
        }),
      };
    } catch (error) {
      console.error("GET error:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch data", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const { place } = JSON.parse(event.body);

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

      const existingVoteForPlace = existingVotes.find(vote => vote.place === place);

      if (existingVoteForPlace) {
        const { error: updateError } = await supabase
          .from('votes')
          .update({ timestamp: today.toISOString() })
          .eq('id', existingVoteForPlace.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('votes')
          .insert([{ ip, place, timestamp: today.toISOString() }]);

        if (insertError) throw insertError;
      }

      const { data: updatedVotes, error: fetchError } = await supabase
        .from('votes')
        .select('place')
        .gte('timestamp', weekStart.toISOString());

      if (fetchError) throw fetchError;

      const votesThisWeek = updatedVotes.reduce((acc, vote) => {
        acc[vote.place] = (acc[vote.place] || 0) + 1;
        return acc;
      }, {});

      const sortedVotes = Object.entries(votesThisWeek).sort((a, b) => b[1] - a[1]);
      const winner = sortedVotes.length > 0 ? sortedVotes[0][0] : null;

      if (winner) {
        const { data: lastWinner, error: lastWinnerError } = await supabase
          .from('winners')
          .select('place, date')
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (lastWinnerError && lastWinnerError.code !== 'PGRST116') throw lastWinnerError;

        const todayFormatted = today.toISOString().split('T')[0];
        if (!lastWinner || lastWinner.place !== winner || lastWinner.date.split('T')[0] !== todayFormatted) {
          const { error: winnerError } = await supabase
            .from('winners')
            .insert([{ place: winner, date: today.toISOString() }]);

          if (winnerError) throw winnerError;
        }
      }

      console.log("POST response:", votesThisWeek);
      return {
        statusCode: 200,
        body: JSON.stringify(votesThisWeek),
      };
    } catch (error) {
      console.error("POST error:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to record vote", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "PUT") {
    try {
      const { place } = JSON.parse(event.body);

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

      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      console.log("PUT response:", placesData.map(p => p.name));
      return {
        statusCode: 200,
        body: JSON.stringify(placesData.map(p => p.name)),
      };
    } catch (error) {
      console.error("PUT error:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to add place", details: error.message }),
      };
    }
  }

  if (event.httpMethod === "DELETE") {
    try {
      const { place } = JSON.parse(event.body);

      const { error: deleteError } = await supabase
        .from('places')
        .delete()
        .eq('name', place);

      if (deleteError) throw deleteError;

      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('name');

      if (placesError) throw placesError;

      console.log("DELETE response:", placesData.map(p => p.name));
      return {
        statusCode: 200,
        body: JSON.stringify(placesData.map(p => p.name)),
      };
    } catch (error) {
      console.error("DELETE error:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to delete place", details: error.message }),
      };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
