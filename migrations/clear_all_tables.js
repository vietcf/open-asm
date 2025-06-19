module.exports = async (pool) => {
  await pool.query(`
    TRUNCATE TABLE 
      tag_object,
      file_uploads,
      role_permissions, permissions, roles, users, 
      server_agents, server_services, server_contact, servers, 
      agents, services, contacts, units, platforms, 
      system_ip, system_contact, system_domain, tags, 
      systems, device_types, 
      ip_tag, ip_contact, subnets, 
      domains, 
      ip_addresses,
      device_contact,
      devices,
      -- Privilege tables below
      priv_user_roles,
      priv_users,
      priv_role_permissions,
      priv_permissions,
      priv_roles
    RESTART IDENTITY CASCADE
  `);
};
