import { DatabaseAdapter } from "./interfaces";
import { SqliteAdapter } from "./sqlite-adapter";
import { PostgresAdapter } from "./postgres-adapter";

// Use Postgres adapter if POSTGRES_URL is defined (Vercel Postgres), otherwise fallback to SQLite
export const db: DatabaseAdapter = process.env.POSTGRES_URL
  ? new PostgresAdapter()
  : new SqliteAdapter();
