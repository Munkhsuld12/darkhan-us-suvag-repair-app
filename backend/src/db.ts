import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in backend/.env");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = async <T extends Record<string, any> = Record<string, any>>(text: string, params: unknown[] = []) => {
  const result = await pool.query<T>(text, params as any[]);
  return result;
};

export const testDbConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connection successful");
  } finally {
    client.release();
  }
};