const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    // Initialize Netlify Blobs store named "ledger"
    const store = getStore("ledger");
    
    // Process GET Requests
    if (event.httpMethod === "GET") {
        try {
            // Read data from Blobs DB, default to empty array if it doesn't exist
            const data = await store.get("redirects", { type: "json" }) || [];
            
            // Route 1: Ledger UI Loading All Data (Requires Auth)
            if (event.queryStringParameters && event.queryStringParameters.load_all === "true") {
                const authCode = event.headers.authorization;
                if (authCode !== "Bearer admin123" && authCode !== "Bearer Northgate") {
                    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
                }
                return { 
                    statusCode: 200, 
                    body: JSON.stringify({ redirects: data }) 
                };
            }
            
            // Route 2: Public Tap Scan Fetching specific ID
            const id = event.queryStringParameters.id;
            if (id) {
                const entry = data.find(e => e.cardId === id);
                return { 
                    statusCode: 200, 
                    body: JSON.stringify({ url: entry ? entry.nfcLink : null }) 
                };
            }
            
            return { statusCode: 400, body: JSON.stringify({ error: "Bad Request" }) };

        } catch (e) {
            return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
        }
    } 
    
    // Process POST Requests (Saving Data from Ledger UI)
    else if (event.httpMethod === "POST") {
        const authCode = event.headers.authorization;
        if (authCode !== "Bearer admin123" && authCode !== "Bearer Northgate") {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }
        
        try {
            const payload = JSON.parse(event.body);
            if (!payload.redirects) throw new Error("Invalid payload");
            
            // Write data globally to Blobs
            await store.setJSON("redirects", payload.redirects);
            
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true })
            };
        } catch (e) {
            return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
        }
    }
    
    return { statusCode: 405, body: "Method Not Allowed" };
}
