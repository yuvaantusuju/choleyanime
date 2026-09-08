import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_HEADERS } from "@/lib/animeheaven";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOWNLOAD_HEADERS: HeadersInit = {
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

  let upstream: Response;
  try {
    upstream = await fetch(baseUrl.toString(), {
      headers: DOWNLOAD_HEADERS,
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
