import express from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware.js';
import apiContactRouter from './apiContact.js';
import apiUnitRouter from './apiUnit.js';
import apiRuleRouter from './apiRule.js';
import apiServerRouter from './apiServer.js';
import apiIpAddressRouter from './apiIpAddress.js';
import apiAuthRouter from './apiAuth.js';
import apiSubnetRouter from './apiSubnet.js';
import apiDeviceRouter from './apiDevice.js';
import apiSystemRouter from './apiSystem.js';
import apiServiceRouter from './apiService.js';
import apiAgentRouter from './apiAgent.js';
import apiPlatformRouter from './apiPlatform.js';
import apiDeviceTypeRouter from './apiDeviceType.js';
import apiTagRouter from './apiTag.js';

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
apiRouter.use('/systems', authenticateJWT, apiSystemRouter);
apiRouter.use('/services', authenticateJWT, apiServiceRouter);
apiRouter.use('/agents', authenticateJWT, apiAgentRouter);
apiRouter.use('/platforms', authenticateJWT, apiPlatformRouter);
apiRouter.use('/device-types', authenticateJWT, apiDeviceTypeRouter);
apiRouter.use('/tags', authenticateJWT, apiTagRouter);


// Handle JSON parse errors for API routes only
apiRouter.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

export default apiRouter;
