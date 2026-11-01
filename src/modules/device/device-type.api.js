// REST: /api/v1/device-types
import DeviceType from './device-type.model.js';
import deviceTypes from './device-type.service.js';
import { catalogApi } from '../../shared/catalog.js';

export default catalogApi(DeviceType, deviceTypes, { entity: 'Device type' });
