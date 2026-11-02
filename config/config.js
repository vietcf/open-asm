import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // No JIT for this app's sessions: its queries are small and short, and on a
  // page query PostgreSQL could spend most of a second compiling JIT code for
  // a few milliseconds of work (seen on the server / system list queries).
  options: '-c jit=off',
});

export const config = {
  cssPath: '/css/',
  jsPath: '/js/',
  imgPath: '/images/'
};
