// Vercel Serverless Function - Ollama API Proxy
// This proxies requests from the frontend to the Ollama API to avoid CORS and Mixed Content issues

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const OLLAMA_API_URL = 'http://129.10.112.25:11434';
    
    try {
        // Get the endpoint from query parameter (e.g., /api/ollama?endpoint=/api/tags)
        const endpoint = req.query.endpoint || '/api/tags';
        const url = `${OLLAMA_API_URL}${endpoint}`;
        
        // Forward the request to Ollama API
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });
        
        const data = await response.json();
        
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Failed to connect to Ollama API',
            message: error.message 
        });
    }
}

