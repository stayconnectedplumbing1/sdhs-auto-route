function openDashboard(request: Request) {
  const dashboardURL = new URL("/?servicem8=1&direct=1", request.url).toString();
  return Response.redirect(dashboardURL, 303);
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
