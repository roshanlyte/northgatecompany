const FIREBASE_URL = "https://northgatecompany-e693b-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SECRET = process.env.FIREBASE_SECRET;

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

    if (!FIREBASE_SECRET) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server misconfigured: FIREBASE_SECRET env var not set." }) };
    }

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET") {
        const params = event.queryStringParameters || {};

        // Route 1: Load all redirects (for ledger admin)
        if (params.load_all === "true") {
            try {
                const res = await fetch(`${FIREBASE_URL}/redirects.json?auth=${FIREBASE_SECRET}`);
                const data = await res.json();
                const redirects = Array.isArray(data) ? data : [];
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ redirects }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 2: Public lookup by card ID (for NFC tap pages)
        if (params.id) {
            try {
                const res = await fetch(`${FIREBASE_URL}/redirects.json?auth=${FIREBASE_SECRET}`);
                const data = await res.json();
                const redirects = Array.isArray(data) ? data : [];
                const entry = redirects.find(e => e.cardId === params.id);
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: entry ? entry.nfcLink : null }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Bad Request" }) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
        try {
            const payload = JSON.parse(event.body);
            if (!payload.redirects) throw new Error("Invalid payload: missing 'redirects' field");

            const res = await fetch(`${FIREBASE_URL}/redirects.json?auth=${FIREBASE_SECRET}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload.redirects)
            });

            if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
        } catch (e) {
            return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
        }
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
