// Configuration for the frontend
const Config = {
    // AUTOMATIC DETECTION:
    // If running locally, use localhost:5000.
    // If deployed (hostname is not localhost), use the Render URL.
    // YOU MUST REPLACE THE URL BELOW WITH YOUR ACTUAL RENDER BACKEND URL AFTER DEPLOYING.
    API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000'
        : 'https://pharmacy-backend-dkjv.onrender.com'
};

// Log for debugging
console.log('App Config:', Config);
