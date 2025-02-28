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

    if (event.httpMethod === "GET") {
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
    }

    if (event.httpMethod === "POST") {
        const hasVoted = await client.query(
            q.Exists(q.Match(q.Index("votes_by_ip"), ip))
        );

        if (hasVoted) {
            console.log("IP already voted this week:", ip);
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Already voted this week" }),
            };
        }

        const { place } = JSON.parse(event.body);
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
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
