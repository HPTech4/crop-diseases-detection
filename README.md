Crop Disease Detection — Local dev with secure proxy

This repository contains a small static client (index.html, style.css, script.js) and an Express proxy (`server.js`) to forward image analysis requests to the Plant.id API without exposing your API key in client-side code.

Quick start (Windows PowerShell)

1. Copy `.env.example` to `.env` and set your Plant.id API key:

   Copy-Item .env.example .env; notepad .env

   Then edit `.env` and replace `your_plant_id_api_key_here` with your actual key.

2. Install dependencies:

   npm install

3. Run the server:

   npm start

4. Open the app in your browser:

   http://localhost:3000

What changed

- `server.js`: Express server that serves static files and provides POST `/api/health` which accepts a single `images` file field and forwards the request to Plant.id with the API key stored on the server.
- `package.json`: dependencies and start script.
- `.env.example`: shows env vars to set.

Security note

Keep your API key in `.env` and never commit it to source control. The proxy keeps the key server-side so browser users cannot see it.

If you want, I can also:

- Add a `npm run dev` script with `nodemon` for development.
- Add CORS restrictions so only your domain can call the proxy.
- Serve the client prebuilt assets from a separate static host and only allow server-to-server calls to Plant.id.
