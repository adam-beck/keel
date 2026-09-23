import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

function readPassword(): string {
  const file = process.env.POSTGRES_PASSWORD_FILE
  if (file) return readFileSync(file, 'utf-8').trim()

  const inline = process.env.PGPASSWORD
  if (inline) return inline

  throw new Error('Set POSTGRES_PASSWORD_FILE (docker secret) or PGPASSWORD (local dev)')
}

const sql = postgres({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  username: process.env.PGUSER ?? 'keel_admin',
  database: process.env.PGDATABASE ?? 'keel',
  password: readPassword()
})

export const db = drizzle(sql)
