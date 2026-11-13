// /api/v1: REST API. Each module's api.routes.js declares its own paths and
// checks the JWT itself; only /auth is public.
import express from 'express';
import authApiRoutes from '../modules/auth/api.routes.js';
import organizeApiRoutes from '../modules/organize/api.routes.js';
import systemApiRoutes from '../modules/system/api.routes.js';
import serverApiRoutes from '../modules/server/api.routes.js';
import deviceApiRoutes from '../modules/device/api.routes.js';
import clusterApiRoutes from '../modules/cluster/api.routes.js';
import networkApiRoutes from '../modules/network/api.routes.js';
import firewallApiRoutes from '../modules/firewall/api.routes.js';
import pentestApiRoutes from '../modules/pentest/api.routes.js';
import customerApiRoutes from '../modules/customer/api.routes.js';

const apiRouter = express.Router();

apiRouter.use('/auth', authApiRoutes);
apiRouter.use(organizeApiRoutes); // /contacts, /units, /tags
apiRouter.use(systemApiRoutes); // /systems, /components
apiRouter.use(serverApiRoutes); // /servers, /services, /agents
apiRouter.use(deviceApiRoutes); // /devices, /device-types, /platforms
apiRouter.use(clusterApiRoutes); // /clusters
apiRouter.use(networkApiRoutes); // /ip-addresses, /subnets, /domains
apiRouter.use(firewallApiRoutes); // /rules
apiRouter.use(pentestApiRoutes); // /pentest-rounds
apiRouter.use(customerApiRoutes); // /customers

// JSON parse errors of API requests
apiRouter.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

export default apiRouter;
