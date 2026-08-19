import type { ServiceM8TokenPayload } from "./oauth";

export type ConnectedBusiness = {
  id: string;
  servicem8CompanyUuid: string | null;
  name: string;
  connectedAt: string;
};

export async function storeConnectedBusinessToken(
  tokenPayload: ServiceM8TokenPayload
): Promise<ConnectedBusiness> {
  const companyUuid =
    typeof tokenPayload.company_uuid === "string" ? tokenPayload.company_uuid : null;

  // Commercial v1 requires persistent encrypted token storage before public sale.
  // This placeholder keeps OAuth flow structure clean without pretending tokens
  // are safely stored while the Railway Postgres adapter is still being wired.
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required before storing ServiceM8 OAuth tokens for customers."
    );
  }

  throw new Error(
    `Token storage is not wired yet for company ${companyUuid || "unknown"}. Add the Railway Postgres adapter and encrypted token writes before enabling public onboarding.`
  );
}
