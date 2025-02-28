// netlify/functions/vote.js
let votes = {};
let votedIPs = new Set();

exports.handler = async (event) => {
    const ip = event.headers["client-ip"] || "unknown";

    if (event.httpMethod === "GET") {
        console.log("GET votes:", votes, "IPs:", Array.from(votedIPs)); // Debug log
        return {
            statusCode: 200,
            body: JSON.stringify(votes),
        };
    }

    if (event.httpMethod === "POST") {
        if (votedIPs.has(ip)) {
            console.log("IP already voted:", ip); // Debug log
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Already voted" }),
            };
        }

        const { place } = JSON.parse(event.body);
        votes[place] = (votes[place] || 0) + 1;
        votedIPs.add(ip);
        console.log("Vote recorded:", { place, count: votes[place], ip }); // Debug log

        return {
            statusCode: 200,
            body: JSON.stringify(votes),
        };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
