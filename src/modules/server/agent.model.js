// Monitoring / security agents installed on servers
import { catalogModel } from '../../shared/catalog.js';

export default catalogModel({
  table: 'agents',
  columns: ['name', 'version', 'description'],
  search: ['name', 'version', 'description'],
  usageSql: 'SELECT COUNT(*) FROM server_agents u WHERE u.agent_id = t.id',
  text: (a) => (a.version ? `${a.name} (${a.version})` : a.name),
});
