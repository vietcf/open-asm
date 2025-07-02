const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const apiContactRouter = require('./apiContact');
const apiUnitRouter = require('./apiUnit');
const apiRuleRouter = require('./apiRule');
const apiServerRouter = require('./apiServer');
const apiIpAddressRouter = require('./apiIpAddress');
const apiAuthRouter = require('./apiAuth');
const apiSubnetRouter = require('./apiSubnet');
const apiDeviceRouter = require('./apiDevice');

const apiRouter = express.Router();

// Public route
apiRouter.use('/auth', apiAuthRouter);

// JWT protected routes
apiRouter.use('/contacts', authenticateJWT, apiContactRouter);
apiRouter.use('/units', authenticateJWT, apiUnitRouter);
apiRouter.use('/rules', authenticateJWT, apiRuleRouter);
apiRouter.use('/servers', authenticateJWT, apiServerRouter);
apiRouter.use('/ip-addresses', authenticateJWT, apiIpAddressRouter);
apiRouter.use('/subnets', authenticateJWT, apiSubnetRouter);
apiRouter.use('/devices', authenticateJWT, apiDeviceRouter);

// Handle JSON parse errors for API routes only
apiRouter.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

module.exports = apiRouter;
