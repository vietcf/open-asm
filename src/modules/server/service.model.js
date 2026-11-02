// Services running on servers (web, database, ...)
import { catalogModel } from '../../shared/catalog.js';

export default catalogModel({
  table: 'services',
  columns: ['name', 'description'],
  usageSql: 'SELECT COUNT(*) FROM server_services u WHERE u.service_id = t.id',
});
