function openDashboard(request: Request) {
  const dashboardURL = new URL("/?servicem8=1", request.url).toString();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Auto Route</title>
    <style>
      html,body,iframe{width:100%;height:100%;margin:0;border:0;overflow:hidden;background:#f5f7f9}
    </style>
  </head>
  <body>
    <iframe src="${dashboardURL}" title="Same Day Auto Route Dashboard" allow="geolocation"></iframe>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// ServiceM8 online menu actions invoke the configured HTTPS callback.
// The live API/JWT verification layer will replace this demo redirect when
// the private ServiceM8 connection is enabled.
export async function GET(request: Request) {
  return openDashboard(request);
}

export async function POST(request: Request) {
  return openDashboard(request);
}
