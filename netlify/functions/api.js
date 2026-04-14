const BLOB_ID = "019d8b62-e8ca-7d21-804b-285580ba2f6d";
const BLOB_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`;
const ADMIN_TOKENS = ["Bearer admin123", "Bearer Northgate"];

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Content-Type": "application/json"
};

exports.handler = async (event) => {

    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET") {
        const params = event.queryStringParameters || {};

        // Route 1: Load all (auth required)
        if (params.load_all === "true") {
            const auth = (event.headers.authorization || event.headers.Authorization || "").trim();
            if (!ADMIN_TOKENS.includes(auth)) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
                const res = await fetch(BLOB_URL, { headers: { "Accept": "application/json" } });
                const data = await res.json();
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ redirects: data.redirects || [] }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 2: Public lookup by card ID
        if (params.id) {
            try {
                const res = await fetch(BLOB_URL, { headers: { "Accept": "application/json" } });
                const data = await res.json();
                const entry = (data.redirects || []).find(e => e.cardId === params.id);
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: entry ? entry.nfcLink : null }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Bad Request" }) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
        const auth = (event.headers.authorization || event.headers.Authorization || "").trim();
        if (!ADMIN_TOKENS.includes(auth)) {
            return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
        }
        try {
            const payload = JSON.parse(event.body);
            if (!payload.redirects) throw new Error("Invalid payload: missing 'redirects' field");

            const res = await fetch(BLOB_URL, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ redirects: payload.redirects })
            });

            if (!res.ok) throw new Error(`Storage error: ${res.status}`);
            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
        } catch (e) {
            return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
        }
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
