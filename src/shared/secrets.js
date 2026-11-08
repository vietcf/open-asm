// Signing secrets for sessions and API tokens. Without SESSION_SECRET /
// JWT_SECRET (the Docker image always generates them, and production refuses
// to start without them, see app.js) a random per-process secret is used: a
// published default would let anyone forge an API token with any permission.
// Sessions and tokens then end when the process restarts.
import crypto from 'crypto';

const random = (name) => {
  console.warn(`⚠️ ${name} is not set: using a random secret (sessions / tokens end on restart).`);
  return crypto.randomBytes(48).toString('base64url');
};

export const SESSION_SECRET = process.env.SESSION_SECRET || random('SESSION_SECRET');
export const JWT_SECRET = process.env.JWT_SECRET || random('JWT_SECRET');
