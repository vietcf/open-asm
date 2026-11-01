// REST: /api/v1/services
import Service from './service.model.js';
import services from './service.service.js';
import { catalogApi } from '../../shared/catalog.js';

export default catalogApi(Service, services, { entity: 'Service' });
