// netlify/functions/vote.js
let votes = {};
let votedIPs = new Set();

exports.handler = async (event) => {
    const ip = event.headers["client-ip"] || "unknown";

    if (event.httpMethod === "GET") {
        return {
            statusCode: 200,
            body: JSON.stringify(votes),
        };
    }

    if (event.httpMethod === "POST") {
        if (votedIPs.has(ip)) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Already voted" }),
            };
        }

        const { place } = JSON.parse(event.body);
        votes[place] = (votes[place] || 0) + 1;
        votedIPs.add(ip);

        return {
            statusCode: 200,
            body: JSON.stringify(votes),
        };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
};
