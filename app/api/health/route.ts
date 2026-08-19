export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "sdhs-auto-route",
    time: new Date().toISOString(),
  });
}
