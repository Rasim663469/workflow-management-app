import bcrypt from 'bcryptjs';
import pkg from 'pg';

const { Pool } = pkg;

// Get connection string from env (Docker) or fallback to local dev
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://secureapp:secureapp@localhost:5432/secureapp',
  connectionTimeoutMillis: 2000,
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForDatabase(
  maxAttempts = 15,
  delayMs = 1000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`DB pas encore pret (tentative ${attempt}/${maxAttempts}): ${message}`);
      if (attempt === maxAttempts) {
        throw err;
      }
      await sleep(delayMs);
    }
  }
}



export default pool;
