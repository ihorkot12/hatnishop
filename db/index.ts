import { DatabaseAdapter } from "./interfaces";
import { SqliteAdapter } from "./sqlite-adapter";
import { PostgresAdapter } from "./postgres-adapter";
import { NeonAdapter } from "./neon-adapter";

// Use Neon adapter if DATABASE_URL is defined, otherwise Vercel Postgres, otherwise fallback to SQLite
export const db: DatabaseAdapter = process.env.DATABASE_URL
  ? new NeonAdapter()
  : process.env.POSTGRES_URL
  ? new PostgresAdapter()
  : new SqliteAdapter();
