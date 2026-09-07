import { NextRequest } from "next/server";
import { absoluteUrl, ANIMEHEAVEN_HEADERS } from "@/lib/animeheaven";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeForFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  const animeName = req.nextUrl.searchParams.get("anime") ?? "Anime";
  const episodeLabel = req.nextUrl.searchParams.get("episode") ?? "Episode";

  if (!rawUrl) {
    return new Response(
      JSON.stringify({ error: "Missing `url` parameter." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const target = absoluteUrl(rawUrl) ?? rawUrl;

  try {
    const upstream = await fetch(target, {
      headers: {
        ...ANIMEHEAVEN_HEADERS,
        Referer: "https://animeheaven.me/",
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({
          error: `Upstream returned ${upstream.status} ${upstream.statusText}`,
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const filename = `${sanitizeForFilename(animeName)}_${sanitizeForFilename(
      episodeLabel,
    )}.mp4`;

    // Pass-through common video headers
    const headers = new Headers();
    const contentType =
      upstream.headers.get("content-type") ?? "video/mp4";
    headers.set("content-type", contentType);
    headers.set(
      "content-length",
      upstream.headers.get("content-length") ?? "",
    );
    headers.set("content-disposition", `attachment; filename="${filename}"`);
    headers.set("cache-control", "no-store");
    // Surface the resolved URL for debugging
    headers.set("x-resolved-from", target);

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Failed to stream the requested .mp4 file.",
        details: message,
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
