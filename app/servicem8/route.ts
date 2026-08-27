function openDashboard(request: Request) {
  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || "").trim();
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const publicOrigin = railwayDomain
    ? `https://${railwayDomain}`
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : new URL(request.url).origin;
  const dashboardURL = new URL("/?servicem8=1&direct=1", publicOrigin).toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: dashboardURL,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

// ServiceM8 opens this callback inside its own web container. Navigating the
// container directly avoids a second nested iframe, which the ServiceM8
// desktop client can crash with a generic "This page couldn't load" screen.
export async function GET(request: Request) {
  return openDashboard(request);
}

export async function POST(request: Request) {
  return openDashboard(request);
}
