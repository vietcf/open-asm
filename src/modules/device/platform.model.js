// Operating systems / firmware platforms of devices and servers
import { catalogModel } from '../../shared/catalog.js';

export default catalogModel({
  table: 'platforms',
  columns: ['name', 'description'],
  usageSql: '(SELECT COUNT(*) FROM devices u WHERE u.platform_id = t.id) + (SELECT COUNT(*) FROM servers u WHERE u.os_id = t.id)',
});
