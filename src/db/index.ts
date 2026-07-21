import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Local development against plain Postgres behind local-neon-http-proxy
// (docker), so the exact same neon-http driver runs in dev and production.
if (process.env.NEON_LOCAL_PROXY === "true") {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
