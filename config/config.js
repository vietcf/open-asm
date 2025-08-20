import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export const config = {
  cssPath: '/css/',
  jsPath: '/js/',
  imgPath: '/images/'
};
