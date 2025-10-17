// Type declarations for Express.js custom properties
import { Session, SessionData } from 'express-session';

// Extend SessionData to include user property
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role_name: string;
      [key: string]: any;
    };
  }
}

// Extend Request interface to include permissions property
declare global {
  namespace Express {
    interface Request {
      permissions?: string[];
    }
  }
}

export {};
