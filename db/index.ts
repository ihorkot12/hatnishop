import { DatabaseAdapter } from "./interfaces.js";
import { SqliteAdapter } from "./sqlite-adapter.js";
import { PostgresAdapter } from "./postgres-adapter.js";
import { NeonAdapter } from "./neon-adapter.js";

// Use Neon adapter if DATABASE_URL is defined, otherwise Vercel Postgres, otherwise fallback to SQLite
export const db: DatabaseAdapter = process.env.DATABASE_URL
  ? new NeonAdapter()
  : process.env.POSTGRES_URL
  ? new PostgresAdapter()
  : new SqliteAdapter();
