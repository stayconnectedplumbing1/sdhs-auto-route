import crypto from "node:crypto";

export const SERVICEM8_AUTHORIZE_URL = "https://go.servicem8.com/oauth/authorize";
export const SERVICEM8_TOKEN_URL = "https://go.servicem8.com/oauth/access_token";

export type ServiceM8TokenPayload = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  company_uuid?: string;
  [key: string]: unknown;
};

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildServiceM8AuthorizeUrl(state: string) {
  const clientId = requiredEnv("SERVICEM8_CLIENT_ID");
  const redirectUri = requiredEnv("SERVICEM8_REDIRECT_URI");
  const scopes = process.env.SERVICEM8_SCOPES || "";

  const url = new URL(SERVICEM8_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeServiceM8Code(code: string): Promise<ServiceM8TokenPayload> {
  const clientId = requiredEnv("SERVICEM8_CLIENT_ID");
  const clientSecret = requiredEnv("SERVICEM8_CLIENT_SECRET");
  const redirectUri = requiredEnv("SERVICEM8_REDIRECT_URI");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", redirectUri);

  const tokenResponse = await fetch(SERVICEM8_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenPayload = await tokenResponse.json().catch(() => null);

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(
      `ServiceM8 token exchange failed: ${JSON.stringify(tokenPayload)}`
    );
  }

  return tokenPayload;
}
