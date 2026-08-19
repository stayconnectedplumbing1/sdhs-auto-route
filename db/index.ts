export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Add Railway Postgres before enabling persistent customer settings or ServiceM8 token storage."
    );
  }

  throw new Error(
    "Postgres persistence is not wired yet. Add a Railway Postgres adapter before using getDb()."
  );
}
