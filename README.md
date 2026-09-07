# Anime Scraper

A Next.js 14+ (App Router) fullstack web app that **searches, browses, and
downloads** anime episodes from `animeheaven.me` using TypeScript, Tailwind
CSS, Lucide icons, and `cheerio`.

> ⚠️ **Educational use only.** Respect the source site's Terms of Service
> and the laws in your jurisdiction.

---

## Tech Stack

| Layer       | Tech                                                         |
|-------------|--------------------------------------------------------------|
| Framework   | Next.js 16 (App Router, Route Handlers)                      |
| Language    | TypeScript (strict)                                          |
| UI          | React 19 + Tailwind CSS 4 + Lucide icons                     |
| Scraping    | `cheerio` + native `fetch` (Node.js runtime)                 |
| Database    | **None** — fully stateless                                   |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── search/route.ts        # GET /api/search?q=...
│   │   ├── episodes/route.ts      # GET /api/episodes?url=...
│   │   ├── resolve-link/route.ts  # GET /api/resolve-link?key=...
│   │   ├── download/route.ts      # GET /api/download?url=...&anime=...&episode=...
│   │   └── health/route.ts        # GET /api/health
│   ├── layout.tsx
│   ├── page.tsx                   # The full client UI
│   └── globals.css
└── lib/
    └── animeheaven.ts             # Shared fetch + cheerio helpers
vercel.json                        # Vercel deployment config (timeouts, region)
```

---

## Environment Setup

### 1. Install dependencies

```bash
npm install
```

The app depends on these three packages:

```bash
npm install cheerio lucide-react next react react-dom
```

### 2. Environment variables

**No environment variables are required.** The `.env` file is intentionally
empty — the app only does public HTTP fetching against `animeheaven.me`.

### 3. Run in development

```bash
npm run dev
```

App runs on <http://localhost:3000>.

### 4. Build for production

```bash
npm run build
npm run start
```

---

## Deploying to Vercel

The app is Vercel-ready out of the box. Just push the repo to GitHub
and import it on Vercel — no env vars needed.

### `vercel.json` settings

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/search/route.ts":       { "maxDuration": 30 },
    "src/app/api/episodes/route.ts":     { "maxDuration": 30 },
    "src/app/api/resolve-link/route.ts": { "maxDuration": 30 },
    "src/app/api/download/route.ts":     { "maxDuration": 60 }
  }
}
```

- **`maxDuration: 30`** — Vercel's free plan caps functions at 10s, Pro at
  60s, and Enterprise at 900s. If you're on the free plan, drop these to
  `10` and accept that some long episodes lists will time out.
- **`regions: ["iad1"]`** — pick the region closest to the upstream site.
  Change to `hnd1`, `fra1`, etc. as needed.
- The `download` route **streams** the upstream `.mp4` through the
  function, so it has to stay within the function timeout. For very long
  videos you may need to use a signed redirect instead of proxying.

### Common Vercel errors and fixes

| Symptom                                                                | Cause                                                                                          | Fix                                                                                          |
|------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `FUNCTION_INVOCATION_TIMEOUT` (status 504)                             | Function ran longer than the Vercel plan allows (free = 10s, pro = 60s).                       | Lower `maxDuration` in `vercel.json`, or upgrade the Vercel plan.                            |
| Search returns 0 results in the deployed app but works locally        | The upstream site may rate-limit Vercel's egress IPs.                                          | Retry, or deploy with a different region.                                                    |
| Download button does nothing (no file is saved)                       | The browser blocks the `Content-Disposition` header because of the Vercel CORS or x-frame settings. | Open `/api/health` to confirm the proxy is reachable, then test `/api/download?url=...` directly. |
| Build fails with `Error: Cannot find module 'cheerio'`                | `cheerio` wasn't installed before the deploy.                                                  | Ensure `cheerio` is in `dependencies` (not `devDependencies`) in `package.json` and re-push.  |
| `FUNCTION_PAYLOAD_TOO_LARGE` on `/api/download`                       | The streamed `.mp4` exceeded Vercel's per-function body limit (4.5 MB on free).                | Use a different download flow (e.g. a signed URL or chunked redirect).                         |

### Quick debugging checklist

1. Open `https://<your-app>.vercel.app/api/health` — you should get
   `{"ok":true,...}`.
2. Open `https://<your-app>.vercel.app/api/search?q=Naruto` — you should
   get a JSON list.
3. If step 2 fails, open **Vercel → Project → Logs → Functions** to see
   the actual error.
4. Test from your machine with `curl` (not the browser) to bypass any
   browser CORS issues:
   ```bash
   curl "https://<your-app>.vercel.app/api/search?q=Naruto"
   ```

---

## API Reference

All endpoints are GET and live under `/api/*`.

### `GET /api/search?q=Naruto`

Searches `https://animeheaven.me/search.php?s={q}` and returns:

```json
{
  "query": "Naruto",
  "count": 8,
  "results": [
    {
      "id": "anime.php?...",
      "title": "Naruto",
      "url": "https://animeheaven.me/anime.php?...",
      "image": "https://.../cover.jpg",
      "description": "...",
      "episodeCount": null
    }
  ]
}
```

### `GET /api/episodes?url=https%3A%2F%2Fanimeheaven.me%2Fanime.php%3F...`

Scrapes the show page for items inside `div.trackep.watchb.bc` and
returns a list of `{ number, title, gateUrl }`:

```json
{
  "showTitle": "Naruto",
  "count": 220,
  "episodes": [
    { "number": "1", "title": "1", "gateUrl": "https://animeheaven.me/gate.php?...", "showUrl": "..." }
  ]
}
```

### `GET /api/resolve-link?url=https%3A%2F%2Fanimeheaven.me%2Fgate.php%3F...`

Hits the gate page and pulls the direct `.mp4` URL out of the anchor
that wraps `div.boxitem.bc2.c1.mar0`:

```json
{
  "gateUrl": "https://animeheaven.me/gate.php?...",
  "mp4Url": "https://cz.animeheaven.me/video.mp4?..."
}
```

### `GET /api/download?url=...&anime=...&episode=...`

Streams the direct `.mp4` to the browser with hotlink-bypassing
headers and a `Content-Disposition: attachment; filename="..."` header.

---

## UI Features

1. **Search bar** with submit + clear.
2. **Results grid** with cover, title, and description preview.
3. **Episode dashboard** with:
   - Multi-select checkboxes
   - "Select All", "Deselect All"
   - Filter input
   - "Download Selected" (queues every checked episode)
4. **Active downloads queue** with:
   - Real-time status (queued / resolving / downloading / done / error)
   - Animated progress bar
   - Per-row start / remove controls
   - "Clear Finished" button

---

## How Scraping Works

> The site has been **redesigned** since the original spec. The current
> implementation uses the live selectors described below.

- The shared `fetchHtml` helper in `src/lib/animeheaven.ts` always sends
  a modern Chrome `User-Agent` and `Referer: https://animeheaven.me/`
  to avoid basic bot blocks.
- `cheerio` is loaded in Node.js — `runtime = "nodejs"` is set on every
  scraping route.

### Current Selectors (Live Site)

| Endpoint         | Selector                                                      | Notes                                        |
|------------------|---------------------------------------------------------------|----------------------------------------------|
| Search results   | `.similarimg` items, each with `a[href*='anime.php']`         | Title from `.similarname`, image from `img.coverimg` |
| Episodes         | `a[id][href*='gate.php']` on the show page                    | The `id` attribute is the per-episode hash.   |
| Episode number   | `.watch2` inside the gate anchor                              | e.g. "220"                                   |
| MP4 stream       | `source[src*='.mp4']` on the gate page (with `key` cookie)    | Mirrors at `co.`, `ct.`, `ck.` subdomains     |

### Cookie flow (important)

`gate.php` is cookie-gated. When you click an episode, the site sets
`document.cookie = "key=<hash>"` (via the `gatea()` JS function) and
then navigates to `/gate.php`. Our `/api/resolve-link` endpoint
replicates this by passing `Cookie: key=<hash>` to the upstream request,
where `<hash>` is the `key` field returned by `/api/episodes`.

---

## Legal

This project is for **educational purposes only**. Do not use it to
infringe copyright or violate the source site's terms.
