import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://go.servicem8.com/oauth/access_token";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = (await cookies()).get("servicem8_oauth_state")?.value;

  if (!code) {
    return Response.json({ ok: false, error: "Missing ServiceM8 authorisation code" }, { status: 400 });
  }
  if (!state || !storedState || state !== storedState) {
    return Response.json({ ok: false, error: "Invalid ServiceM8 OAuth state" }, { status: 400 });
  }

  try {
    const clientId = requiredEnv("SERVICEM8_CLIENT_ID");
    const clientSecret = requiredEnv("SERVICEM8_CLIENT_SECRET");
    const redirectUri = requiredEnv("SERVICEM8_REDIRECT_URI");

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("redirect_uri", redirectUri);

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokenPayload = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok) {
      return Response.json(
        { ok: false, error: "ServiceM8 token exchange failed", details: tokenPayload },
        { status: 502 }
      );
    }

    // Next step: store tokenPayload securely against the connected ServiceM8 account.
    return Response.redirect(new URL("/?connected=servicem8", request.url).toString(), 302);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "ServiceM8 callback error" },
      { status: 500 }
    );
  }
}
