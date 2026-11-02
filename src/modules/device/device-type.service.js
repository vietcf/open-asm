// Device types: shared by the web pages and the REST API.
import { pool } from '../../../config/config.js';
import DeviceType from './device-type.model.js';
import { catalogService } from '../../shared/catalog.js';

const deviceTypes = catalogService(DeviceType, { entity: 'Device type', columns: ['name', 'description'], usedBy: 'device(s)' });

// Existing type by name (case-insensitive), created when missing (device form / import).
// When a client (transaction) is passed, the lookup uses it so it can see
// rows created earlier in the same transaction (e.g. bulk import).
deviceTypes.findOrCreate = async (name, client) => {
  const { rows } = await (client || pool).query(
    'SELECT * FROM device_types WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1', [name]);
  return rows[0] || DeviceType.create({ name, description: null }, client);
};

export default deviceTypes;
