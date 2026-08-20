# CropCare

Instant crop disease detection from a single leaf photo. Upload an image, and CropCare
returns whether the plant is healthy, the most likely disease matches with confidence
scores, and a first treatment step — powered by the [Plant.id](https://plant.id) Health
Assessment API behind a small Express proxy.

**Live demo:** _add your deployed URL here_
**Screenshot / GIF:** _add one here — this matters more than any paragraph of description_

---

## Why this exists

Smallholder and hobby growers usually can't get a same-day answer on what's wrong with a
crop. CropCare is a small step toward that: point a phone camera at a leaf, get a
confidence-scored diagnosis and a treatment starting point in seconds, instead of waiting
on a lab or a forum thread.

## How it works

```
┌─────────────┐      multipart/form-data       ┌──────────────────┐      Api-Key header      ┌───────────────┐
│   Browser   │ ──────────────────────────────▶ │  Express proxy    │ ────────────────────────▶│  Plant.id API  │
│  (vanilla   │                                  │  (/api/health)    │                          │                │
│  HTML/CSS/JS)│ ◀────────────────────────────── │                    │◀──────────────────────── │                │
└─────────────┘         JSON diagnosis           └──────────────────┘        JSON diagnosis      └───────────────┘
```

The frontend never talks to Plant.id directly. It posts the image to a local Express
route, which attaches the API key server-side and forwards the request. This keeps the
key out of client-side code and out of the browser network tab.

## Tech stack

| Layer     | Choice                                   |
|-----------|-------------------------------------------|
| Frontend  | Vanilla HTML, CSS, JavaScript (no framework, no build step) |
| Backend   | Node.js, Express, Multer (file upload handling) |
| External API | [Plant.id](https://plant.id) Health Assessment v3 |
| Env config | `dotenv`                                 |

No framework was used deliberately — the goal was a small, dependency-light surface that's
easy to read end-to-end in one sitting.

## Getting started

### Prerequisites
- Node.js 18+
- A [Plant.id](https://plant.id) API key

### Setup

```bash
git clone https://github.com/<your-username>/cropcare.git
cd cropcare
npm install
```

Create a `.env` file in the project root:

```env
PLANT_ID_API_KEY=your_api_key_here
PORT=3000
```

Start the server:

```bash
node server.js
```

Then open `http://localhost:3000` in a browser.

## Project structure

```
cropcare/
├── server.js       # Express proxy — receives uploads, calls Plant.id, returns JSON
├── index.html       # Page structure
├── style.css         # Design system and layout
├── script.js         # Upload handling, drag & drop, results rendering
├── .env               # API key (not committed)
└── README.md
```

## Known limitations

Being upfront about these — they're the honest next steps, not blind spots:

- **No persistence.** Each scan is stateless; there's no history of past uploads. A
  database layer (scan log, per-user history) is the natural next step.
- **No authentication.** Anyone with the URL can use it. Fine for a demo, not for
  production use with real growers.
- **No automated tests.** The proxy route would benefit from a handful of integration
  tests (Jest + Supertest) covering missing files, missing keys, and upstream errors.
- **Single-image input only.** Plant.id supports multi-image submissions for higher
  accuracy; this project currently sends one.

## Roadmap

- [ ] Persist scan history (Postgres/MongoDB) with a simple "My Scans" view
- [ ] Basic auth so history is scoped per user
- [ ] Automated tests for the proxy route
- [ ] Multi-image upload for higher diagnostic confidence
- [ ] Deploy (Render/Railway) with the proxy and static files as one service

## License

MIT