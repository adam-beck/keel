import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function readPassword(): string {
  const file = process.env.POSTGRES_PASSWORD_FILE;
  if (file) return readFileSync(file, "utf-8").trim();

  const inline = process.env.PGPASSWORD;
  if (inline) return inline;

  throw new Error("Set POSTGRES_PASSWORD_FILE (docker secret) or PGPASSWORD (local dev)");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "keel_admin",
    database: process.env.PGDATABASE ?? "keel",
    password: readPassword(),
  },
});
