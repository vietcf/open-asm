// Main application entry point for the Express server
// Sets up middleware, session, view engine, static files, and routes

// =========================
// Core Node.js modules
// =========================
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =========================
// Third-party modules
// =========================
import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import methodOverride from 'method-override';
import flash from 'connect-flash';
import bcrypt from 'bcrypt';
import ejs from 'ejs';
import expressLayouts from 'express-ejs-layouts';

// =========================
// Project modules (config, utils, middlewares)
// =========================
import { config } from '../config/config.js';
import { siteConfig } from './utils/siteConfig.js';
import { UPLOAD_ACCEPT, ALLOWED_UPLOAD_EXTENSIONS } from './utils/uploadTypes.js';
import { loadPermissions } from './middlewares/permissions.middleware.js';
import requirePasswordChange from './middlewares/requirePasswordChange.middleware.js';
import require2fa from './middlewares/require2fa.middleware.js';
import sessionIdleTimeout from './middlewares/sessionIdleTimeout.middleware.js';
import auditLog from './middlewares/auditLog.middleware.js';
// import accessLog from './middlewares/accessLog.middleware.js'; // Disabled

// =========================
// Routers
// =========================
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import requireLogin from './middlewares/requireLogin.middleware.js';
import networkRouter from './routes/network.js';
import systemRouter from './routes/system.js';
import pentestRouter from './routes/pentest.js';
import clusterRouter from './routes/cluster.js';
import privAccountRouter from './routes/privAccount.js';
import serverRouter from './routes/server.js';
import serverController from './controllers/serverController.js';
import organizeRouter from './routes/organize.js';
import administratorRouter from './routes/administrator.js';
import deviceRoutes from './routes/device.js';
import uploadRouter from './routes/upload.js';
import firewallRouter from './routes/firewall.js';
import twofaRouter from './routes/twofa.js';
import changePasswordRouter from './routes/changePassword.js';

// API Routers
// import apiContactRouter from './api/routes/apiContact.js';
// import apiUnitRouter from './api/routes/apiUnit.js';
// import apiRuleRouter from './api/routes/apiRule.js';
// import apiServerRouter from './api/routes/apiServer.js';
// import apiIpAddressRouter from './api/routes/apiIpAddress.js';
// import apiAuthRouter from './api/routes/apiAuth.js';
import apiSwaggerRouter from './api/routes/apiSwagger.js';
import apiRouter from './api/routes/index.js';
import i18n from './middlewares/i18n.middleware.js';
import connectPgSimple from 'connect-pg-simple';
import { pool } from '../config/config.js';
import i18nRouter, { catalogVersion } from './routes/i18n.js';
// Remove unused controller import since we're using router pattern


// =========================
// EXPRESS APP INITIALIZATION
// =========================
const app = express();

// 1. Site configuration (load from DB at startup)
await siteConfig.initialize();

// 2. Trust proxy for HTTPS (Nginx/Proxy setups)
app.set('trust proxy', 1);

// Refuse to run in production with the built-in fallback secrets.
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || !process.env.JWT_SECRET)) {
  console.error('SESSION_SECRET and JWT_SECRET must be set when NODE_ENV=production.');
  process.exit(1);
}

// 3. Core middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// _method override only for POST forms: allowing it on GET would let a plain
// link trigger PUT/DELETE (CSRF).
app.use(methodOverride('_method', { methods: ['POST'] }));

// 4. Session and flash
// Sessions are stored in PostgreSQL (table "session", migration 0003).
const PgSessionStore = connectPgSimple(session);
app.use(session({
  store: new PgSessionStore({ pool, tableName: 'session', pruneSessionInterval: 15 * 60 }),
  name: 'openasm.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto', // Secure flag when the request came over HTTPS (via trust proxy)
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000 // absolute cap; idle timeout is handled separately
  }
}));

// Flash middleware for session messages
app.use(flash());

// 4.1. Auto-expire session after inactivity (must run after session/flash, before routes)
app.use(sessionIdleTimeout);

// 4.2. Access logging middleware (after session, before other middleware)
// app.use(accessLog); // Disabled to reduce console output

// 4.3. Audit log: every data change (POST/PUT/PATCH/DELETE) by a signed-in
// user goes to system_log, app or security category (see the middleware)
app.use(auditLog);

// 5. Global template variables (res.locals)
// 5.1. Load permissions for every request (after session, before routes)
app.use(loadPermissions);

// 5.1b. UI language (req.t / res.locals.t, ?lang= switch) - see src/i18n/
app.use(i18n);

// Cache-busting URLs for the app's own CSS/JS: nginx serves /css and /js
// with a one-year immutable cache, so the URL must change when the file
// does. Version = file mtime; looked up once in production, on every
// request in development (files change under `docker compose watch`).
const PUBLIC_DIR = path.join(__dirname, '../public');
const assetVersions = new Map();
function assetUrl(urlPath) {
  let version = process.env.NODE_ENV === 'production' ? assetVersions.get(urlPath) : undefined;
  if (!version) {
    try {
      version = Math.floor(fs.statSync(path.join(PUBLIC_DIR, urlPath)).mtimeMs).toString(36);
    } catch {
      version = 'missing';
    }
    assetVersions.set(urlPath, version);
  }
  return `${urlPath}?v=${version}`;
}
// app.locals: available to every render, error pages included.
// <link href="<%= asset('/css/custom.css') %>">
app.locals.asset = assetUrl;
// accept="..." for attachment inputs (src/utils/uploadTypes.js)
app.locals.uploadAccept = UPLOAD_ACCEPT;
app.locals.uploadAllowedList = ALLOWED_UPLOAD_EXTENSIONS.join(', ');

// 5.2. Global template variables (res.locals)
app.use((req, res, next) => {
  // Browser-side translation catalog: <script src="<%= i18nScript %>">
  res.locals.i18nScript = `/i18n/${res.locals.lang}.js?v=${catalogVersion[res.locals.lang]}`;
  // User/session
  res.locals.user = req.session.user || null;
  // Asset paths
  res.locals.cssPath = config.cssPath;
  res.locals.jsPath = config.jsPath;
  res.locals.imgPath = config.imgPath;
  // Site config
  res.locals.siteName = siteConfig.getSiteName();
  res.locals.pageSizeOptions = siteConfig.getPageSizeOptions();
  res.locals.defaultPageSize = siteConfig.getDefaultPageSize();
  // Embed data in inline <script> safely (JSON.stringify alone does not
  // escape "</script>"): <script>const x = <%- jsonSafe(data) %>;</script>
  res.locals.jsonSafe = (value) => JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  // URL of the current list page with ?page=N (keeps search/filters/pageSize)
  res.locals.pageUrl = (n) => {
    const url = new URL(req.originalUrl, 'http://x');
    url.searchParams.set('page', n);
    url.searchParams.delete('lang');
    return url.pathname + url.search;
  };
  // Current query string without page/lang, for export links etc.
  res.locals.currentQuery = (() => {
    const url = new URL(req.originalUrl, 'http://x');
    ['page', 'lang'].forEach(k => url.searchParams.delete(k));
    return url.search;
  })();
  // Permission helper
  res.locals.hasPermission = (perm) => {
    const user = res.locals.user;
    if (!user) return false;
    if (user.role_name === 'superadmin') return true;
    
    if (req.permissions && Array.isArray(req.permissions)) {
      return req.permissions.includes(perm);
    }
    return false;
  };
  next();
});

// 6. View engine and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/html'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');
// app.set('layout extractScripts', true);
// app.set('layout extractStyles', true);

// 7. Static files
// User-uploaded documents (system/server/device attachments etc.) are served
// as forced downloads with sniffing disabled — they're arbitrary files
// uploaded by any authenticated user, so this closes the stored-XSS vector
// (a .html/.svg upload would otherwise render/execute in the app's origin).
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use(express.static(path.join(__dirname, '../public')));

// Smart redirect for root URL - handles both authenticated and anonymous users
app.get(['/', '/index.html'], (req, res) => {
  // If user is logged in, redirect to dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  // If not logged in, redirect to login
  res.redirect('/login');
});


// ===========================================
// PUBLIC ROUTES (No authentication required)
// ===========================================
app.use('/i18n', i18nRouter); // /i18n/vi.js - translations for browser scripts
app.use('/', authRouter); // /login, /logout, /login/2fa




// ===========================================
// MIDDLEWARES AFTER SESSION, BEFORE ROUTES
// ===========================================

// Enforce password change for users with must_change_password flag (after session, before routes)
app.use(requirePasswordChange);


// ===========================================
// PROTECTED ROUTES (Authentication required)
// ===========================================

// Change password route (requires login + 2FA)
app.use('/change-password', requireLogin, changePasswordRouter);

// // 2FA setup/disable routes (requires login only)
app.use('/2fa', requireLogin, twofaRouter); 

app.use('/dashboard', requireLogin, require2fa, dashboardRouter);
app.use('/system', requireLogin, require2fa, systemRouter);
app.use('/pentest', requireLogin, require2fa, pentestRouter);
app.use('/cluster', requireLogin, require2fa, clusterRouter);
app.use('/network', requireLogin, require2fa, networkRouter);
// Public template download route (no auth required)
app.get('/server/server/template', serverController.downloadServerTemplate);
app.use('/server', requireLogin, require2fa, serverRouter);
app.use('/organize', requireLogin, require2fa, organizeRouter);
app.use('/device', requireLogin, require2fa, deviceRoutes);
app.use('/priv-account', requireLogin, require2fa, privAccountRouter);
app.use('/firewall', requireLogin, require2fa, firewallRouter);
app.use('/administrator', requireLogin, require2fa, administratorRouter);

// //Upload route to get upload patch file
app.use('/api/upload', requireLogin, uploadRouter); 

// ===========================================
// API ROUTES
// ===========================================

//  Swagger API documentation (public)
app.use('/api-docs', requireLogin, apiSwaggerRouter);

// // API v1 routes (authentication handled internally)
app.use('/api/v1', apiRouter);

// ===========================================
// 404 AND ERROR HANDLERS
// ===========================================
const wantsJson = (req) => req.xhr || req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json';

app.use((req, res) => {
  if (wantsJson(req)) return res.status(404).json({ error: 'Not found' });
  res.status(404).render('pages/error', { title: 'Page not found', status: 404, message: 'The page you are looking for does not exist.', layout: req.session?.user ? 'layouts/layout' : false, activeMenu: '' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  if (wantsJson(req)) return res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  res.status(status).render('pages/error', { title: 'Error', status, message: status === 500 ? 'Something went wrong. Please try again.' : err.message, layout: req.session?.user ? 'layouts/layout' : false, activeMenu: '' });
});

// Start the server
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
    console.log('🔒 App is using reverse proxy (Nginx)');
});

// Start scheduled cleanup job for system logs
try {
  const cleanupLogsJob = await import('./utils/cleanupLogs.js');
  if (cleanupLogsJob.default && typeof cleanupLogsJob.default.start === 'function') {
    cleanupLogsJob.default.start();
  }
} catch (err) {
  console.log('Cleanup logs job not available:', err.message);
}

// Start scheduled cleanup job for temp files
try {
  const { runCleanup } = await import('./utils/cleanupTempFiles.js');
  
  // Run cleanup immediately on startup
  runCleanup();
  
  // Run cleanup every 6 hours
  setInterval(() => {
    runCleanup();
  }, 6 * 60 * 60 * 1000); // 6 hours
  
  console.log('✅ Temp files cleanup job started (every 6 hours)');
} catch (err) {
  console.log('Temp files cleanup job not available:', err.message);
}

// Start scheduled backup job for database
try {
  const backupJob = await import('./utils/backupJob.js');
  if (backupJob.default && typeof backupJob.default.start === 'function') {
    backupJob.default.start();
    console.log('✅ Database backup job started');
  }
} catch (err) {
  console.log('Database backup job not available:', err.message);
}
