import { cookies } from "next/headers";
import { exchangeServiceM8Code } from "@/lib/servicem8/oauth";
import { storeConnectedBusinessToken } from "@/lib/servicem8/token-store";

export const dynamic = "force-dynamic";

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
    const tokenPayload = await exchangeServiceM8Code(code);
    const business = await storeConnectedBusinessToken(tokenPayload);

    const response = Response.redirect(
      new URL(`/onboarding?connected=${business.id}`, request.url).toString(),
      302
    );
    response.headers.append(
      "Set-Cookie",
      "servicem8_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );
    return response;
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "ServiceM8 callback error" },
      { status: 500 }
    );
  }
}
