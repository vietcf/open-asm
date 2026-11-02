// Device types (router, firewall, storage, ...)
import { catalogModel } from '../../shared/catalog.js';

export default catalogModel({
  table: 'device_types',
  columns: ['name', 'description'],
  usageSql: 'SELECT COUNT(*) FROM devices u WHERE u.device_type_id = t.id',
});
