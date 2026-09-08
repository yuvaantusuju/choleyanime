# AnimeHeaven Downloader

A single-page Next.js 14/15 (App Router) dashboard that scrapes anime
episode lists from **animeheaven.me** with **Cheerio**, resolves the direct
`.mp4` stream from each gate page, and proxies the bytes back to the browser
as an attachment so the upstream hotlink check is satisfied.

## Tech stack

| Concern        | Choice                                          |
| -------------- | ----------------------------------------------- |
| Framework      | Next.js 14/15 (App Router, Route Handlers)      |
| Language       | TypeScript                                      |
| Styling        | Tailwind CSS v4                                 |
| Icons          | `lucide-react`                                  |
| Scraping       | `cheerio` + Node `fetch` (server runtime)       |
| Streaming      | Native Web Streams through `Response`           |

## Required npm packages

```bash
npm install cheerio lucide-react
npm install --save-dev @types/cheerio
```

## Configuration

There is no environment variable to configure. The proxy relies on these
HTTP headers, hard-coded inside the route handlers:

```ts
{
  "User-Agent": "Mozilla/5.0 … Chrome/126.0.0.0 Safari/537.36",
  "Referer": "https://animeheaven.me/"
}
```

`Referer` is what lets the upstream CDN serve the `.mp4` to us.

## Routes

| Path                  | Method | Purpose                                                              |
| --------------------- | ------ | -------------------------------------------------------------------- |
| `/api/episodes`       | `GET`  | Scrapes the show page (`div.trackep.watchb.bc`) for episode items.   |
| `/api/resolve-link`   | `GET`  | Resolves a gate page to its direct `.mp4` URL.                       |
| `/api/download`       | `GET`  | Streams the `.mp4` back as `Content-Disposition: attachment`.        |

### Examples

```bash
# 1. List episodes
curl "http://localhost:3000/api/episodes?url=https%3A%2F%2Fanimeheaven.me%2Fanime.php%3Fid%3Dexample"

# 2. Resolve one episode's gate page
curl "http://localhost:3000/api/resolve-link?url=https%3A%2F%2Fanimeheaven.me%2Fgate.php%3Fhash%3Dexample"

# 3. Download the stream
curl -L "http://localhost:3000/api/download?url=https%3A%2F%2Fcz.animeheaven.me%2Fvideo.mp4%3Fid%3Dexample&filename=Episode-1.mp4" -o Episode-1.mp4
```

## UI

`/` (`app/page.tsx` → `src/components/AnimeDownloader.tsx`) renders:

1. A **header + URL input** with a *Fetch episodes* button.
2. A **selection grid** of episodes with `Select all`, `Deselect all`,
   `Download selected`, and `Download all` bulk actions.
3. A **download queue** with per-row status, a "Copy URL" button, a
   re-triggerable save link, and a "Clear finished" action.
4. Inline **toast notifications** for success/error feedback.

## Notes

- All route handlers run in the `nodejs` runtime so `cheerio` (CommonJS) and
  streaming `Response` bodies work without polyfills.
- Sequential downloads are used by default for the bulk action to keep
  upstream pressure low; tweak `startDownloadForMany` for parallelism.
- Respect the target site’s terms of service — this project is provided for
  educational purposes only.
