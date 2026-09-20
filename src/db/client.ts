import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Supavisor transaction pooler requires prepare: false
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof postgres.PostgresError && e.code === '23505'
}
