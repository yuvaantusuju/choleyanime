import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_HEADERS } from "@/lib/animeheaven";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOWNLOAD_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  Accept: "*/*",
  Referer: "https://animeheaven.me/",
};

function sanitizeFilename(input: string): string {
  return (input || "episode")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function guessExtension(url: string, contentType: string | null): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot > -1 && dot < last.length - 1) {
      return last.slice(dot).toLowerCase();
    }
  } catch {
    /* ignore */
  }
  if (contentType) {
    if (contentType.includes("mp4")) return ".mp4";
    if (contentType.includes("webm")) return ".webm";
    if (contentType.includes("octet-stream")) return ".mp4";
  }
  return ".mp4";
}

/**
 * Some animeheaven CDN URLs (especially the `gate.php` ones) need a
 * `key=HASH` cookie to be forwarded. Extract it from the URL itself.
 */
function extractKeyCookie(url: string): string | null {
  try {
    const u = new URL(url);
    const direct = u.searchParams.get("key");
    if (direct) return `key=${direct}`;
    // The URL form `…?HASH` (no `=`) was parsed with HASH as the key name.
    // `searchParams.get(HASH)` returns "" so the value is in the raw search.
    const raw = u.search.replace(/^\?/, "");
    if (raw && !raw.includes("=")) {
      const first = raw.split("&")[0];
      if (first && /^[a-f0-9]{16,}$/i.test(first)) {
        return `key=${first}`;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  const requestedName = searchParams.get("filename");

  if (!target) {
    return NextResponse.json(
      { error: "Missing required 'url' query parameter." },
      { status: 400 }
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(target);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL provided." },
      { status: 400 }
    );
  }

  if (!/^https?:$/.test(baseUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http(s) URLs are supported." },
      { status: 400 }
    );
  }

  // Build the upstream headers. The mp4 URLs themselves only need the
  // Referer to bypass the hotlink check, but if the user passed us a
  // gate.php URL we also need to forward the key cookie.
  const upstreamHeaders: Record<string, string> = { ...DOWNLOAD_HEADERS };
  if (baseUrl.pathname.toLowerCase().includes("gate.php")) {
    const cookie = extractKeyCookie(baseUrl.toString());
    if (cookie) upstreamHeaders.Cookie = cookie;
  }

  let upstream: Response;
  try {
    upstream = await fetch(baseUrl.toString(), {
      headers: upstreamHeaders,
      redirect: "follow",
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    return NextResponse.json(
      { error: `Upstream fetch failed: ${message}` },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: `Upstream responded with ${upstream.status} ${upstream.statusText}`,
      },
      { status: 502 }
    );
  }

  const upstreamType = upstream.headers.get("content-type");
  const ext = guessExtension(baseUrl.toString(), upstreamType);
  const baseName = sanitizeFilename(requestedName ?? `episode-${Date.now()}`);
  const filename = baseName.toLowerCase().endsWith(ext)
    ? baseName
    : `${baseName}${ext}`;

  const passthroughHeaders: Record<string, string> = {
    "Content-Type":
      upstreamType && upstreamType.length > 0
        ? upstreamType
        : "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) passthroughHeaders["Content-Length"] = contentLength;

  // Stream the body straight through. Web ReadableStream is compatible with
  // Next.js Response in the Node.js runtime.
  return new Response(upstream.body, {
    status: 200,
    headers: passthroughHeaders,
  });
}
