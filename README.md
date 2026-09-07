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
│   │   ├── episodes/route.ts      # GET /api/episodes?id=...
│   │   ├── resolve-link/route.ts  # GET /api/resolve-link?key=...
│   │   ├── download/route.ts      # GET /api/download?url=...&anime=...&episode=...
│   │   └── health/route.ts        # GET /api/health
│   ├── layout.tsx
│   ├── page.tsx                   # The full client UI
│   └── globals.css
└── lib/
    └── animeheaven.ts             # Shared fetch + cheerio helpers

# Deployment config
wrangler.toml                      # Cloudflare Workers config
open-next.config.ts                # OpenNext adapter config
next.config.ts                     # Calls initOpenNextCloudflareForDev()
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

## Deploying

This project supports two deployment targets out of the box:

| Target | Adapter | Build command | Notes |
|--------|---------|---------------|-------|
| **Cloudflare Workers** (recommended) | `@opennextjs/cloudflare` | `npm run deploy` | Cold start ~50ms, free tier generous, runs the Node.js runtime via `nodejs_compat` |
| Vercel | (built-in) | `npm run build` | Use `vercel.json` if you add one back |

### Deploying to Cloudflare Workers

> **Why Cloudflare?** Faster cold starts, more generous free tier, and
> Cloudflare's edge network often has different egress IP reputation than
> Vercel's AWS us-east-1 fleet, which can help when an upstream site
> rate-limits one provider.

#### One-time setup

1. Install dependencies (already done by `npm install`):
   ```bash
   npm install
   ```

2. Make sure you have a Cloudflare account. Log in to the Wrangler CLI:
   ```bash
   npx wrangler login
   ```

3. The included `wrangler.toml` and `open-next.config.ts` are already
   configured. They set:
   - `compatibility_flags = ["nodejs_compat"]` — required for `cheerio`
   - `compatibility_date = "2025-11-01"`
   - `wrapper: "cloudflare-node"` — so API routes run on the Node.js runtime
   - Static assets bound to `ASSETS`

#### Preview locally

```bash
npm run preview
```

This runs `next build`, then the OpenNext adapter, then starts
`wrangler dev` on `http://localhost:8788`. Test your routes there.

#### Deploy to production

```bash
npm run deploy
```

That runs `next build`, then `opennextjs-cloudflare deploy`, which
uploads the bundle to Cloudflare and gives you a `*.workers.dev` URL.

#### Custom domain

In `wrangler.toml`, uncomment the `routes` block and put your domain:

```toml
routes = [
  { pattern = "anime.example.com/*", zone_name = "example.com" }
]
```

Then run `npm run deploy` again.

#### Add R2-backed incremental cache (optional)

For caching show pages and episode lists across requests:

1. Create an R2 bucket in the Cloudflare dashboard (or
   `wrangler r2 bucket create anime-scraper-cache`).
2. In `wrangler.toml`, uncomment the `[[r2_buckets]]` block.
3. In `open-next.config.ts`, change `incrementalCache: "dummy"` to a
   function that returns the R2-backed cache. See
   <https://opennext.js.org/cloudflare/caching>.

### Deploying to Vercel

Vercel still works. Just push to GitHub and import. **Delete the
`wrangler.toml`, `open-next.config.ts`, and the `wrangler` /
`@opennextjs/cloudflare` packages from `package.json`** if you don't
need them, because Vercel will try to read `wrangler.toml` and complain
about the OpenNext build script.

If you do deploy to Vercel, the previous `vercel.json` config (with
`maxDuration: 30-60`) is no longer included; recreate it manually if
you hit function timeouts.

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
