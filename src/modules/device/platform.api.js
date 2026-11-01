// REST: /api/v1/platforms
import Platform from './platform.model.js';
import platforms from './platform.service.js';
import { catalogApi } from '../../shared/catalog.js';

export default catalogApi(Platform, platforms, { entity: 'Platform' });
