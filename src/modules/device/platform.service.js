// Platforms: shared by the web pages and the REST API.
import Platform from './platform.model.js';
import { catalogService } from '../../shared/catalog.js';

const platforms = catalogService(Platform, { entity: 'Platform', columns: ['name', 'description'], usedBy: 'device(s) or server(s)' });

export default platforms;
