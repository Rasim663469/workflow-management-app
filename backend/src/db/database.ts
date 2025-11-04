import bcrypt from 'bcryptjs';
import pkg from 'pg';

const { Pool } = pkg;

// Get connection string from env (Docker) or fallback to local dev
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://secureapp:secureapp@localhost:5432/secureapp',
});



export default pool;
