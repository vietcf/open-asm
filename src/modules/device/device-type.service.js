// Device types: shared by the web pages and the REST API.
import DeviceType from './device-type.model.js';
import { catalogService } from '../../shared/catalog.js';

const deviceTypes = catalogService(DeviceType, { entity: 'Device type', columns: ['name', 'description'], usedBy: 'device(s)' });

// Existing type by name (case-insensitive), created when missing (device form / import)
deviceTypes.findOrCreate = async (name, client) => {
  const [existing] = await DeviceType.findByNameExact(name);
  return existing || DeviceType.create({ name, description: null }, client);
};

export default deviceTypes;
