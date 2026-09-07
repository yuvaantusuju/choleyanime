export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "anime-scraper",
    timestamp: new Date().toISOString(),
  });
}
