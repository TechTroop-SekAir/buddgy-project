// Shared constants between playwright.config.js (which spawns the server/
// client on these ports) and any spec/setup file that needs to talk to the
// API directly rather than through the browser (auth.setup.js's
// completeOnboarding). Single source of truth so the two never drift apart.
const SERVER_PORT = 4010;
const CLIENT_PORT = 5183;
const BASE_URL = `http://localhost:${CLIENT_PORT}`;
const API_BASE_URL = `http://localhost:${SERVER_PORT}/api`;

module.exports = { SERVER_PORT, CLIENT_PORT, BASE_URL, API_BASE_URL };
