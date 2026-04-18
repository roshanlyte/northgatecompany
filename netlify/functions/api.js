const FIREBASE_URL = "https://northgatecompany-e693b-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SECRET = process.env.FIREBASE_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

    // --- Authentication Helper ---
    const isAuthenticated = () => {
        const auth = (event.headers.authorization || event.headers.Authorization || "").trim();
        if (!ADMIN_PASSWORD) return false;
        return auth === `Bearer ${ADMIN_PASSWORD}`;
    };

    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET") {
        const params = event.queryStringParameters || {};

        // Route 1: Load all redirects (admin) - REQUIRES AUTH
        if (params.load_all === "true") {
            if (!isAuthenticated()) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
                const res = await fetch(`${FIREBASE_URL}/redirects.json?auth=${FIREBASE_SECRET}`);
                const data = await res.json();
                const redirects = Array.isArray(data) ? data : [];
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ redirects }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 2: Load all business accounts (admin) - REQUIRES AUTH
        if (params.load_accounts === "true") {
            if (!isAuthenticated()) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
                const res = await fetch(`${FIREBASE_URL}/business_accounts.json?auth=${FIREBASE_SECRET}`);
                const data = await res.json();
                const accounts = Array.isArray(data) ? data : [];
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ accounts }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 3: Business login + fetch their reviews - BUSINESS AUTH (username+password)
        if (params.business_login === "true") {
            const username = params.username || "";
            const password = params.password || "";
            try {
                // Fetch accounts
                const accRes = await fetch(`${FIREBASE_URL}/business_accounts.json?auth=${FIREBASE_SECRET}`);
                const accData = await accRes.json();
                const accounts = Array.isArray(accData) ? accData : [];
                const account = accounts.find(a => a.username === username && a.password === password);

                if (!account) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Invalid credentials" }) };
                }

                // Fetch reviews for this card
                const revRes = await fetch(`${FIREBASE_URL}/reviews.json?auth=${FIREBASE_SECRET}`);
                const revData = await revRes.json();
                const allReviews = Array.isArray(revData) ? revData : [];
                const reviews = allReviews.filter(r => r.cardId === account.cardId);

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        cardId: account.cardId,
                        businessName: account.businessName || "",
                        reviews
                    })
                };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route 4: Public lookup by card ID (for NFC tap pages) - NO AUTH
        if (params.id) {
            try {
                const res = await fetch(`${FIREBASE_URL}/redirects.json?auth=${FIREBASE_SECRET}`);
                const data = await res.json();
                const redirects = Array.isArray(data) ? data : [];
                const entry = redirects.find(e => e.cardId === params.id);
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: entry ? entry.nfcLink : null, profiles: entry ? entry.profiles : [] }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Bad Request" }) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
        let payload;
        try {
            payload = JSON.parse(event.body);
        } catch (e) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
        }

        // Route A: Save redirects (admin) - REQUIRES AUTH
        if (payload.redirects !== undefined) {
            if (!isAuthenticated()) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
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

        // Route B: Save business accounts (admin) - REQUIRES AUTH
        if (payload.accounts !== undefined) {
            if (!isAuthenticated()) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
            }
            try {
                const res = await fetch(`${FIREBASE_URL}/business_accounts.json?auth=${FIREBASE_SECRET}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload.accounts)
                });
                if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        // Route C: Log a review event (PUBLIC — no auth, written by customer tap pages)
        if (payload.review !== undefined) {
            try {
                const review = payload.review;
                if (!review.cardId || !review.profileId || !review.profileName) {
                    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing required review fields" }) };
                }

                // Extract client IP (Netlify sets x-nf-client-connection-ip reliably)
                const clientIp = event.headers['x-nf-client-connection-ip']
                    || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
                    || event.headers['client-ip']
                    || 'unknown';

                // Fetch existing reviews
                const fetchRes = await fetch(`${FIREBASE_URL}/reviews.json?auth=${FIREBASE_SECRET}`);
                const existing = await fetchRes.json();
                const reviews = Array.isArray(existing) ? existing : [];

                // IP rate limit: one review per IP per cardId per 24 hours
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                const recentFromIp = reviews.find(r =>
                    r.cardId === review.cardId &&
                    r.clientIp === clientIp &&
                    clientIp !== 'unknown' &&
                    r.timestamp && new Date(r.timestamp).getTime() > oneDayAgo
                );
                if (recentFromIp) {
                    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: "already_reviewed" }) };
                }

                review.id = Date.now().toString();
                review.timestamp = review.timestamp || new Date().toISOString();
                review.clientIp = clientIp;
                reviews.push(review);

                const putRes = await fetch(`${FIREBASE_URL}/reviews.json?auth=${FIREBASE_SECRET}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(reviews)
                });
                if (!putRes.ok) throw new Error(`Firebase error: ${putRes.status}`);
                return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
            } catch (e) {
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
            }
        }

        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid payload" }) };
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
