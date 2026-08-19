import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const AUTHORIZE_URL = "https://go.servicem8.com/oauth/authorize";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function GET() {
  try {
    const clientId = requiredEnv("SERVICEM8_CLIENT_ID");
    const redirectUri = requiredEnv("SERVICEM8_REDIRECT_URI");
    const scopes = process.env.SERVICEM8_SCOPES || "";
    const state = crypto.randomBytes(24).toString("hex");

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);

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
