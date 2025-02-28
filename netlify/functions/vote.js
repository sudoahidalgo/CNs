// netlify/functions/vote.js
const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({
    secret: process.env.FAUNA_SECRET
});

exports.handler = async (event) => {
    const ip = event.headers["client-ip"] || "unknown";
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 5) % 7)); // Martes como inicio
    weekStart.setHours(0, 0, 0, 0);

    console.log("Request received:", { method: event.httpMethod, ip });

    if (event.httpMethod === "GET") {
        try {
            const result = await client.query(
                q.Map(
                    q.Paginate(q.Documents(q.Collection("votes"))),
                    q.Lambda("ref", q.Get(q.Var("ref")))
                )
            );
            const votesThisWeek = result.data
                .filter(doc => new Date(doc.data.timestamp) >= weekStart)
                .reduce((acc, doc) => {
                    acc[doc.data.place] = (acc[doc.data.place] || 0) + 1;
                    return acc;
                }, {});
            console.log("Votes this week:", votesThisWeek);
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
            console.log("Checking if IP has voted:", ip);
            const hasVoted = await client.query(
                q.Exists(q.Match(q.Index("votes_by_ip"), ip))
            );
            console.log("Has voted:", hasVoted);

            if (hasVoted) {
                console.log("IP already voted this week:", ip);
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Already voted this week" }),
                };
            }

            const { place } = JSON.parse(event.body);
            console.log("Recording vote for:", place);
            await client.query(
                q.Create(q.Collection("votes"), {
                    data: {
                        ip,
                        place,
                        timestamp: today.toISOString()
                    }
                })
            );

            const result = await client.query(
                q.Map(
                    q.Paginate(q.Documents(q.Collection("votes"))),
                    q.Lambda("ref", q.Get(q.Var("ref")))
                )
            );
            const votesThisWeek = result.data
                .filter(doc => new Date(doc.data.timestamp) >= weekStart)
                .reduce((acc, doc) => {
                    acc[doc.data.place] = (acc[doc.data.place] || 0) + 1;
                    return acc;
                }, {});

            console.log("Vote recorded:", { place, ip, votes: votesThisWeek });
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
