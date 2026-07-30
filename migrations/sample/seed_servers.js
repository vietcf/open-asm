// Seed data for servers table (new structure)
//
// NOTE: server_id here is platforms.id (the "os_id" / operating system
// column), not an arbitrary literal — platforms are seeded before servers,
// but their IDs are not guaranteed to start at 1 on a non-pristine
// database, so we look them up by name below rather than hardcoding them.
//
// server<->system linking lives in seed_systems.js (systems don't exist
// yet at this point in the seed order), not here.
export default async (db) => {
  const { rows: platformRows } = await db.query("SELECT id, name FROM platforms WHERE name IN ('Ubuntu 22.04', 'Windows Server 2019', 'CentOS 7')");
  const platformMap = {};
  platformRows.forEach(p => { platformMap[p.name] = p.id; });
  const os1 = platformMap['Ubuntu 22.04'] || null;
  const os2 = platformMap['Windows Server 2019'] || null;
  const os3 = platformMap['CentOS 7'] || null;

  const servers = [
    ['Server A', os1, 'Data Center 1', 'Vật lý', 'online'],
    ['Server B', os2, 'Data Center 2', 'Cloud', 'offline'],
    ['Server C', os3, 'Data Center 1', 'Ảo hóa', 'online'],
    ['Server D', os1, 'Data Center 3', 'Cloud', 'offline'],
    ['Server E', os2, 'Data Center 2', 'Vật lý', 'online'],
    ['Server F', os3, 'Data Center 1', 'Ảo hóa', 'offline'],
    ['Server G', os1, 'Data Center 4', 'Cloud', 'online'],
    ['Server H', os2, 'Data Center 3', 'Vật lý', 'offline'],
    ['Server I', os3, 'Data Center 2', 'Ảo hóa', 'online'],
    ['Server J', os1, 'Data Center 1', 'Cloud', 'offline'],
  ];
  // servers has no unique constraint on name, so ON CONFLICT can't target
  // it — check existence explicitly instead, so re-running this seed
  // doesn't create duplicate server rows.
  for (const [name, os_id, location, type, status] of servers) {
    const { rows: existing } = await db.query('SELECT id FROM servers WHERE name = $1', [name]);
    if (existing.length > 0) continue;
    await db.query(
      `INSERT INTO servers (name, os_id, location, type, status, updated_by)
       VALUES ($1, $2, $3, $4, $5, 'admin');`,
      [name, os_id, location, type, status]
    );
  }

  const { rows: serverRows } = await db.query("SELECT id, name FROM servers WHERE name LIKE 'Server %'");
  const serverMap = {};
  serverRows.forEach(s => { serverMap[s.name] = s.id; });

  const { rows: agentRows } = await db.query('SELECT id, name FROM agents');
  const agentMap = {};
  agentRows.forEach(a => { agentMap[a.name] = a.id; });
  const agentIds = Object.values(agentMap);

  const { rows: serviceRows } = await db.query('SELECT id, name FROM services');
  const serviceMap = {};
  serviceRows.forEach(s => { serviceMap[s.name] = s.id; });
  const serviceIds = Object.values(serviceMap);

  const { rows: contactRows } = await db.query('SELECT id, name FROM contacts');
  const contactMap = {};
  contactRows.forEach(c => { contactMap[c.name] = c.id; });
  const contactIds = Object.values(contactMap);

  // Give each seeded server 2 agents, 2 services, and 1 contact, cycling
  // through whatever real agent/service/contact rows currently exist
  // (rather than assuming specific IDs).
  let i = 0;
  for (const name of Object.keys(serverMap)) {
    const server_id = serverMap[name];
    if (agentIds.length > 0) {
      await db.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [server_id, agentIds[i % agentIds.length]]);
      await db.query('INSERT INTO server_agents (server_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [server_id, agentIds[(i + 1) % agentIds.length]]);
    }
    if (serviceIds.length > 0) {
      await db.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [server_id, serviceIds[i % serviceIds.length]]);
      await db.query('INSERT INTO server_services (server_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [server_id, serviceIds[(i + 1) % serviceIds.length]]);
    }
    if (contactIds.length > 0) {
      await db.query('INSERT INTO server_contact (server_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [server_id, contactIds[i % contactIds.length]]);
    }
    i++;
  }
};
