// Main application entry point for the Express server
// Sets up middleware, session, view engine, static files, and routes

const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const config = require('../config/config');
const requireLogin = require('./middlewares/requireLogin');
const fs = require('fs');
const ejs = require('ejs');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const { authenticate } = require('./middlewares/auth');

// Import routers and controllers
const networkRouter = require('./routes/network');
const systemRouter = require('./routes/system');
const privAccountRouter = require('./routes/privAccount');
const serverRouter = require('./routes/server');
const organizeRouter = require('./routes/organize');
const administratorRouter = require('./routes/administrator');
//const authController = require('./controllers/authController');
const dashboardRouter = require('./routes/dashboard');
const deviceRoutes = require('./routes/device');
const uploadRouter = require('./routes/upload');
const firewallRouter = require('./routes/firewall');
const twofaRouter = require('./routes/twofa');
const authRouter = require('./routes/auth');
const require2fa = require('./middlewares/require2fa');
const changePasswordRouter = require('./routes/changePassword');
const requirePasswordChange = require('./middlewares/requirePasswordChange');
const swaggerRouter = require('./routes/swagger');
const apiCommonRouter = require('./routes/apiCommon');

const app = express();

// Parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Session middleware setup
app.use(session({
  secret: 'VcbS3cr3teeee', // Change to a strong secret in production
  resave: false,
  saveUninitialized: false
}));

// Flash middleware for session messages
app.use(flash());

// Middleware: pass permissions from session to res.locals for views
app.use((req, res, next) => {
  res.locals.permissions = req.session.permissions || [];
  next();
});

// Set EJS as the view engine and views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/html'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Redirect root and /index.html to /login
app.get(['/', '/index.html'], (req, res) => {
    res.redirect('/login');
});

// Register for login/logout/2fa
app.use('/', authRouter);
// Register change password route
app.use('/', changePasswordRouter);

// Dashboard route (requires login + 2FA if enabled)
app.use('/dashboard', requireLogin, require2fa, dashboardRouter);

// Register all feature routers (most require login + 2FA + password change if required)
app.use('/network', requireLogin, require2fa, requirePasswordChange, networkRouter);
app.use('/system', requireLogin, require2fa, requirePasswordChange, systemRouter);
app.use('/priv-account', requireLogin, require2fa, requirePasswordChange, privAccountRouter);
app.use('/device', requireLogin, require2fa, requirePasswordChange, deviceRoutes); 
app.use('/server', requireLogin, require2fa, requirePasswordChange, serverRouter); 
app.use('/organize', requireLogin, require2fa, requirePasswordChange, organizeRouter);
app.use('/firewall', requireLogin, require2fa, requirePasswordChange, firewallRouter);
app.use('/administrator', requireLogin, require2fa, requirePasswordChange, administratorRouter);

//Upload route to get upload patch file
app.use('/api/upload', requireLogin, require2fa, requirePasswordChange, uploadRouter); 

// 2FA setup/disable routes should only require login
app.use('/2fa', requireLogin, twofaRouter); 

// Serve Swagger API docs at /api-docs (no auth for now)
app.use('/api-docs', swaggerRouter);

// Register API routes with JWT authentication globally
const apiPublicPaths = ['/auth/login'];
app.use('/api', (req, res, next) => {
  if (apiPublicPaths.includes(req.path)) return next();
  return authenticate(req, res, next);
}, apiCommonRouter);

// Helper: check permission in EJS
app.locals.hasPermission = (user, perm) => {
  if (!user) return false;
  if (user.role_name === 'superadmin') return true; // superadmin always has all permissions
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(perm);
  }
  // If permissions are stored in res.locals.permissions (legacy)
  if (Array.isArray(res?.locals?.permissions)) {
    return res.locals.permissions.includes(perm);
  }
  return false;
};

// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});

// Start scheduled cleanup job for system logs
const cleanupLogsJob = require('./utils/cleanupLogs');
cleanupLogsJob.start();
