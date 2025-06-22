const express = require('express');
const { authenticate } = require('../middlewares/auth');
const apiContactRouter = require('./apiContact');
const apiUnitRouter = require('./apiUnit');
const apiRuleRouter = require('./apiRule');
const apiServerRouter = require('./apiServer');
const apiIpAddressRouter = require('./apiIpAddress');
const apiAuthRouter = require('./apiAuth');

const apiRouter = express.Router();

// Public route
apiRouter.use('/auth', apiAuthRouter);

// JWT protected routes
apiRouter.use('/contacts', authenticate, apiContactRouter);
apiRouter.use('/units', authenticate, apiUnitRouter);
apiRouter.use('/rules', authenticate, apiRuleRouter);
apiRouter.use('/servers', authenticate, apiServerRouter);
apiRouter.use('/ipaddresses', authenticate, apiIpAddressRouter);

module.exports = apiRouter;
