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
            console.log("Request body:", event.body);
            const { place } = JSON.parse(event.body);
            console.log("Checking database connection and setup...");
            
            // Test basic database access
            try {
                const collections = await client.query(
                    q.Paginate(q.Collections())
                );
                console.log("Database connection successful. Collections:", collections);
            } catch (dbErr) {
                console.error("Database connection error:", dbErr);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Database connection failed", details: dbErr.message }),
                };
            }
            
            // Test if the votes collection exists
            try {
                await client.query(
                    q.Get(q.Collection("votes"))
                );
                console.log("Votes collection exists");
            } catch (collErr) {
                console.error("Collection error:", collErr);
                
                // Try to create the collection if it doesn't exist
                try {
                    await client.query(
                        q.CreateCollection({ name: "votes" })
                    );
                    console.log("Created votes collection");
                } catch (createErr) {
                    console.error("Failed to create collection:", createErr);
                }
            }
            
            // Test if the index exists
            try {
                await client.query(
                    q.Get(q.Index("votes_by_ip"))
                );
                console.log("votes_by_ip index exists");
            } catch (indexErr) {
                console.error("Index error:", indexErr);
                
                // Try to create the index if it doesn't exist
                try {
                    await client.query(
                        q.CreateIndex({
                            name: "votes_by_ip",
                            source: q.Collection("votes"),
                            terms: [{ field: ["data", "ip"] }],
                            unique: true
                        })
                    );
                    console.log("Created votes_by_ip index");
                } catch (createIndexErr) {
                    console.error("Failed to create index:", createIndexErr);
                }
            }

            console.log("Checking if IP has voted:", ip);
            let hasVoted = false;
            try {
                hasVoted = await client.query(
                    q.Exists(q.Match(q.Index("votes_by_ip"), ip))
                );
                console.log("Has voted check successful. Result:", hasVoted);
            } catch (existsErr) {
                console.error("Error checking if voted:", existsErr);
                // Continue anyway
            }

            if (hasVoted) {
                console.log("IP already voted this week:", ip);
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Already voted this week" }),
                };
            }

            console.log("Recording vote for:", place);
            try {
                await client.query(
                    q.Create(q.Collection("votes"), {
                        data: {
                            ip,
                            place,
                            timestamp: today.toISOString()
                        }
                    })
                );
                console.log("Vote successfully recorded");
            } catch (createErr) {
                console.error("Error creating vote:", createErr);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Failed to create vote document", details: createErr.message }),
                };
            }

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
