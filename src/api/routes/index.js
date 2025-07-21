import express from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware.js';
import apiContactRouter from './apiContact.js';
import apiUnitRouter from './apiUnit.js';
import apiRuleRouter from './apiRule.js';
import apiServerRouter from './apiServer.js';
import apiIpAddressRouter from './apiIpAddress.js';
import apiAuthRouter from './apiAuth.js';
import apiSubnetRouter from './apiSubnet.js';
// import apiDeviceRouter from './apiDevice.js';

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
// apiRouter.use('/devices', authenticateJWT, apiDeviceRouter);

// Handle JSON parse errors for API routes only
apiRouter.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

export default apiRouter;
