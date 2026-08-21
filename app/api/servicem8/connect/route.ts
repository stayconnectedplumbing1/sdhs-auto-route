import { buildServiceM8AuthorizeUrl, createOAuthState } from "@/lib/servicem8/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = createOAuthState();
    const url = buildServiceM8AuthorizeUrl(state);

    const response = Response.redirect(url.toString(), 302);
    response.headers.append(
      "Set-Cookie",
      `servicem8_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );
    return response;
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "OAuth setup error" },
      { status: 500 }
    );
  }
}
