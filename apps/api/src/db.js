import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { safeMessage } from "./log.js";

const { Pool } = pg;

export function createPool(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: "devops-task-api",
  });
  pool.on("error", (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        source: "postgres",
        message: safeMessage(error),
      }),
    );
  });
  return pool;
}

export async function migrate(pool) {
  const sqlPath = path.join(import.meta.dirname, "../sql/001_counters.sql");
  const sql = await readFile(sqlPath, "utf8");
  await pool.query(sql);
}

export async function incrementCounter(pool, id) {
  const result = await pool.query(
    `INSERT INTO counters (id, value)
     VALUES ($1, 1)
     ON CONFLICT (id) DO UPDATE
     SET value = counters.value + 1,
         updated_at = now()
     RETURNING value`,
    [id],
  );
  const value = Number(result.rows[0]?.value);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("counter returned a non-integer");
  }
  return value;
}

export async function checkDatabase(pool) {
  const result = await pool.query("SELECT 1 AS ok");
  if (Number(result.rows[0]?.ok) !== 1) {
    throw new Error("unexpected database reply");
  }
}
