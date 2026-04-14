const { getStore } = require("@netlify/blobs");

const ADMIN_TOKENS = ["Bearer admin123", "Bearer Northgate"];

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Content-Type": "application/json"
};

exports.handler = async (event) => {

    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    let store;
    try {
        store = getStore("ledger");
    } catch (e) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Blobs store unavailable: " + e.message })
        };
    }

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET") {
        const params = event.queryStringParameters || {};

        // Route 1: Load all (requires auth)
        if (params.load_all === "true") {
            const auth = event.headers.authorization || event.headers.Authorization || "";
            if (!ADMIN_TOKENS.includes(auth)) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
                const data = await store.get("redirects", { type: "json" }) || [];
                return { statusCode: 200, headers, body: JSON.stringify({ redirects: data }) };
            } catch (e) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 2: Public lookup by card ID
        if (params.id) {
            try {
                const data = await store.get("redirects", { type: "json" }) || [];
                const entry = data.find(e => e.cardId === params.id);
                return { statusCode: 200, headers, body: JSON.stringify({ url: entry ? entry.nfcLink : null }) };
            } catch (e) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
            }
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad Request" }) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
        const auth = event.headers.authorization || event.headers.Authorization || "";
        if (!ADMIN_TOKENS.includes(auth)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
        }
        try {
            const payload = JSON.parse(event.body);
            if (!payload.redirects) throw new Error("Invalid payload: missing 'redirects' field");
            await store.setJSON("redirects", payload.redirects);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (e) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
