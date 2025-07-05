// Main application entry point for the Express server
// Sets up middleware, session, view engine, static files, and routes


// Core modules
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Third-party modules
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import session from 'express-session';
import methodOverride from 'method-override';
import flash from 'connect-flash';
import ejs from 'ejs';
import expressLayouts from 'express-ejs-layouts';

// Project modules
import { config } from '../config/config.js';
import { siteConfig } from './utils/siteConfig.js';
import { loadPermissions } from './middlewares/permissions.middleware.js';
// import requireLogin from './middlewares/requireLogin.js';
// import require2fa from './middlewares/require2fa.js';
// import requirePasswordChange from './middlewares/requirePasswordChange.js';
// import { authenticate } from './api/middlewares/auth.js';

// Routers

import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import requireLogin from './middlewares/requireLogin.middleware.js';

import networkRouter from './routes/network.js';
// import systemRouter from './routes/system.js';
// import privAccountRouter from './routes/privAccount.js';
import serverRouter from './routes/server.js';
import organizeRouter from './routes/organize.js';
// import administratorRouter from './routes/administrator.js';
// import dashboardRouter from './routes/dashboard.js';
// import deviceRoutes from './routes/device.js';
// import uploadRouter from './routes/upload.js';
// import firewallRouter from './routes/firewall.js';
// import twofaRouter from './routes/twofa.js';
// import authRouter from './routes/auth.js';
// import changePasswordRouter from './routes/changePassword.js';

// API Routers
// import apiContactRouter from './api/routes/apiContact.js';
// import apiUnitRouter from './api/routes/apiUnit.js';
// import apiRuleRouter from './api/routes/apiRule.js';
// import apiServerRouter from './api/routes/apiServer.js';
// import apiIpAddressRouter from './api/routes/apiIpAddress.js';
// import apiAuthRouter from './api/routes/apiAuth.js';
// import apiSwaggerRouter from './api/routes/apiSwagger.js';
// import apiRouter from './api/routes/index.js';
// Remove unused controller import since we're using router pattern


// =========================
// EXPRESS APP INITIALIZATION
// =========================
const app = express();

// 1. Site configuration (load from DB at startup)
await siteConfig.initialize();

// 2. Trust proxy for HTTPS (Nginx/Proxy setups)
app.set('trust proxy', 1);

// 3. Core middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// 4. Session and flash
app.use(session({
  secret: process.env.SESSION_SECRET || 'VcbS3cr3teeee',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // SSL handled by Nginx
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(flash());

// 5. Global template variables (res.locals)
// 5.1. Load permissions for every request (after session, before routes)
app.use(loadPermissions);

// 5.2. Global template variables (res.locals)
app.use((req, res, next) => {
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
app.use('/', authRouter); // /login, /logout, /login/2fa

// ===========================================
// PROTECTED ROUTES (Authentication required)
// ===========================================

// Change password route (requires login + 2FA)
// app.use('/change-password', requireLogin, require2fa, changePasswordRouter);

// // 2FA setup/disable routes (requires login only)
// app.use('/2fa', requireLogin, twofaRouter); 

// // Dashboard route (requires login + 2FA if enabled)
// app.use('/dashboard', requireLogin, require2fa, dashboardRouter);
app.use('/dashboard', requireLogin, dashboardRouter);
app.use('/network', requireLogin, networkRouter);
app.use('/server', serverRouter);
app.use('/organize', organizeRouter);
// // ===========================================
// // FEATURE ROUTES (Full authentication + password change required)
// // ===========================================
// //app.use('/network', requireLogin, require2fa, requirePasswordChange, networkRouter);
// //app.use('/network', requireLogin, require2fa, requirePasswordChange, networkRouter);
// app.use('/network', networkRouter);
// //app.use('/system', requireLogin, require2fa, requirePasswordChange, systemRouter);
// app.use('/system', systemRouter);
// //app.use('/priv-account', requireLogin, require2fa, requirePasswordChange, privAccountRouter);
// app.use('/priv-account', privAccountRouter);
// //app.use('/device', requireLogin, require2fa, requirePasswordChange, deviceRoutes); 
// app.use('/device', deviceRoutes);
// //app.use('/server', requireLogin, require2fa, requirePasswordChange, serverRouter); 
// //app.use('/organize', requireLogin, require2fa, requirePasswordChange, organizeRouter);

// //app.use('/firewall', requireLogin, require2fa, requirePasswordChange, firewallRouter);
// app.use('/firewall', firewallRouter);
// //app.use('/administrator', requireLogin, require2fa, requirePasswordChange, administratorRouter);
// app.use('/administrator', administratorRouter);

// //Upload route to get upload patch file
// app.use('/api/upload', requireLogin, require2fa, requirePasswordChange, uploadRouter); 

// ===========================================
// API ROUTES
// ===========================================

// Swagger API documentation (public)
// app.use('/api-docs', apiSwaggerRouter);

// // API v1 routes (authentication handled internally)
// app.use('/api/v1', apiRouter);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, 'localhost', () => {
    console.log(`Server running on localhost:${PORT}`);
    console.log('🔒 App bound to localhost only - using reverse proxy (Nginx)');
});

// Start scheduled cleanup job for system logs
// import cleanupLogsJob from './utils/cleanupLogs.js';
// cleanupLogsJob.start();
