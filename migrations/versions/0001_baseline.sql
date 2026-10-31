-- 0001_baseline.sql
-- Full Open ASM schema as of v1.1.0 (every pre-1.1.0 alter folded in).
-- Applied only on an EMPTY database. An existing v1.1.0 database is
-- "adopted" instead: this file is recorded as applied without running it.
-- Never edit this file — add a new numbered migration in this folder instead.

CREATE TABLE permissions (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

CREATE TABLE roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

CREATE TABLE role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INT REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE (role_id, permission_id)
    );

CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      email VARCHAR(100) UNIQUE,
      fullname VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      role_id INT REFERENCES roles(id),
      twofa_secret VARCHAR(64),
      twofa_enabled BOOLEAN DEFAULT FALSE,
      require_twofa BOOLEAN DEFAULT FALSE,
      twofa_setup_deadline TIMESTAMP,
      must_change_password BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      auth_source VARCHAR(20) NOT NULL DEFAULT 'local' CHECK (auth_source IN ('local', 'ldap'))
    );

CREATE INDEX idx_users_is_active ON users (is_active);

CREATE TABLE agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      version VARCHAR(50),
      description TEXT
    );

CREATE TABLE services (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT
    );

CREATE TABLE units (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(20),
      description VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100),
      phone VARCHAR(20),
      unit_id INTEGER,
      position VARCHAR(100),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE pentest_rounds (
      id SERIAL PRIMARY KEY,
      object_type VARCHAR(50) NOT NULL,
      object_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      test_date DATE,
      status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );

CREATE TABLE pentest_round_contact (
      pentest_round_id INTEGER NOT NULL REFERENCES pentest_rounds(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (pentest_round_id, contact_id)
    );

CREATE INDEX idx_pentest_rounds_object ON pentest_rounds(object_type, object_id);

CREATE TABLE servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      os_id INTEGER,
      location TEXT,
      type TEXT,
      status VARCHAR(16) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );

CREATE TABLE server_contact (
      server_id INTEGER,
      contact_id INTEGER,
      PRIMARY KEY (server_id, contact_id)
    );

CREATE TABLE server_system (
      server_id INTEGER,
      system_id INTEGER,
      PRIMARY KEY (server_id, system_id)
    );

CREATE TABLE server_agents (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      PRIMARY KEY (server_id, agent_id)
    );

CREATE TABLE server_services (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      PRIMARY KEY (server_id, service_id)
    );

CREATE TABLE tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL UNIQUE,
      description TEXT
    );

CREATE TABLE tag_object (
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      object_type VARCHAR(32) NOT NULL,
      object_id INTEGER NOT NULL,
      PRIMARY KEY (tag_id, object_type, object_id)
    );

CREATE TABLE ip_addresses (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(64) NOT NULL UNIQUE,
      description TEXT,
      server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      status VARCHAR(32),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128)
    );

CREATE TABLE ip_contact (
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (ip_id, contact_id)
    );

CREATE TABLE domains (
      id SERIAL PRIMARY KEY,
      domain VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      ip_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL,
      record_type VARCHAR(16)
    );

CREATE TABLE subnets (
      id SERIAL PRIMARY KEY,
      address inet NOT NULL UNIQUE,
      description TEXT,
      zone VARCHAR(255) DEFAULT NULL,
      environment VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) DEFAULT NULL,
      gateway_ip_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL
    );

CREATE INDEX idx_subnets_gateway_ip_id ON subnets (gateway_ip_id);

CREATE INDEX idx_subnets_updated_at ON subnets (updated_at DESC);

CREATE INDEX idx_subnets_zone ON subnets (zone);

CREATE INDEX idx_subnets_environment ON subnets (environment);

CREATE TABLE platforms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE systems (
      id SERIAL PRIMARY KEY,
      system_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) UNIQUE NOT NULL,
      level VARCHAR(50),
      department_id INT REFERENCES units(id),
      alias TEXT[],
      fqdn TEXT[],
      description TEXT,
      scopes JSONB DEFAULT NULL,
      architecture JSONB DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255)
    );

CREATE TABLE system_server (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      server_id INT REFERENCES servers(id) ON DELETE CASCADE
    );

CREATE TABLE system_ip (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      ip_id INT REFERENCES ip_addresses(id) ON DELETE CASCADE
    );

CREATE TABLE system_contact (
      id SERIAL PRIMARY KEY,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE,
      contact_id INT REFERENCES contacts(id) ON DELETE CASCADE
    );

CREATE TABLE system_domain (
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      PRIMARY KEY (system_id, domain_id)
    );

CREATE INDEX idx_systems_scopes ON systems USING GIN (scopes);

CREATE INDEX idx_systems_architecture ON systems USING GIN (architecture);

CREATE TABLE clusters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );

CREATE TABLE cluster_members (
      id SERIAL PRIMARY KEY,
      cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
      ip_address_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (cluster_id, ip_address_id)
    );

CREATE TABLE cluster_system (
      cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      PRIMARY KEY (cluster_id, system_id)
    );

CREATE INDEX idx_cluster_members_cluster ON cluster_members(cluster_id);

CREATE INDEX idx_cluster_members_ip ON cluster_members(ip_address_id);

CREATE INDEX idx_cluster_system_system ON cluster_system(system_id);

CREATE TABLE system_components (
      id SERIAL PRIMARY KEY,
      system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      app_type VARCHAR(128),
      fqdn TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128)
    );

CREATE UNIQUE INDEX idx_unique_system_component_name
    ON system_components (system_id, LOWER(name));

CREATE TABLE system_component_contact (
      component_id INTEGER NOT NULL REFERENCES system_components(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (component_id, contact_id)
    );

CREATE TABLE system_component_ip (
      component_id INTEGER NOT NULL REFERENCES system_components(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      PRIMARY KEY (component_id, ip_id)
    );

CREATE TABLE device_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE file_uploads (
      id SERIAL PRIMARY KEY,
      object_type VARCHAR(50) NOT NULL, -- system, server, user, ...
      object_id INTEGER NOT NULL,       -- id of the linked object
      original_name VARCHAR(255) NOT NULL, -- original file name
      file_path VARCHAR(255) NOT NULL,     -- file path on server
      mime_type VARCHAR(100),
      size BIGINT,
      uploaded_by INTEGER,                 -- user id
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE devices (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      serial_number VARCHAR(100),
      device_type_id INTEGER REFERENCES device_types(id) ON DELETE SET NULL,
      platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
      location TEXT,
      management_address VARCHAR(255),
      description TEXT,
      manufacturer VARCHAR(255),
      device_role VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64)
    );

CREATE TABLE device_contact (
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (device_id, contact_id)
    );

ALTER TABLE ip_addresses
    ADD COLUMN device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL;

CREATE INDEX idx_devices_device_role ON devices (device_role);

CREATE TABLE device_ip (
      id SERIAL PRIMARY KEY,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (device_id, ip_id)
    );

CREATE TABLE server_ip (
      id SERIAL PRIMARY KEY,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      ip_id INTEGER NOT NULL REFERENCES ip_addresses(id) ON DELETE CASCADE,
      role VARCHAR(100) DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      UNIQUE (server_id, ip_id)
    );

CREATE INDEX idx_device_ip_device ON device_ip(device_id);

CREATE INDEX idx_device_ip_ip ON device_ip(ip_id);

CREATE INDEX idx_server_ip_server ON server_ip(server_id);

CREATE INDEX idx_server_ip_ip ON server_ip(ip_id);

ALTER TABLE ip_addresses ADD COLUMN ip_type VARCHAR(20) DEFAULT 'physical';

CREATE TABLE priv_roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_id INT REFERENCES systems(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      CONSTRAINT uniq_priv_role_name_system UNIQUE (name, system_id)
    );

CREATE TABLE priv_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      organize_id INT REFERENCES units(id),
      role_id INT REFERENCES priv_roles(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      account_type VARCHAR(255) NOT NULL,
      manage_type VARCHAR(255) NOT NULL,
      app_url VARCHAR(255)
    );

    CREATE TABLE priv_user_contacts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      contact_id INT REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE priv_user_systems (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      system_id INT REFERENCES systems(id) ON DELETE CASCADE
    );

    CREATE TABLE priv_user_servers (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      server_id INT REFERENCES servers(id) ON DELETE CASCADE
    );

CREATE TABLE priv_permissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      system_id INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      UNIQUE (name, system_id)
    );

CREATE TABLE priv_user_roles (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES priv_users(id) ON DELETE CASCADE,
      role_id INT REFERENCES priv_roles(id) ON DELETE CASCADE
    );

CREATE TABLE priv_role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INT REFERENCES priv_roles(id) ON DELETE CASCADE,
      permission_id INT REFERENCES priv_permissions(id) ON DELETE CASCADE
    );

CREATE TABLE configuration (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) NOT NULL UNIQUE,
      value TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100)
    );

CREATE TABLE system_log (
      id SERIAL PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      object_type VARCHAR(100),
      object_id VARCHAR(100),
      description TEXT,
      user_id INTEGER,
      username VARCHAR(100),
      ip_address VARCHAR(50),
      user_agent TEXT,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE rulefirewall (
      id SERIAL PRIMARY KEY,
      rulename VARCHAR(255) NOT NULL,
      firewall_name VARCHAR(255),
      src_zone VARCHAR(128),
      src TEXT,
      src_detail TEXT,
      dst_zone VARCHAR(128),
      dst TEXT,
      dst_detail TEXT,
      services VARCHAR(255),
      application VARCHAR(255),
      url VARCHAR(255),
      action VARCHAR(32) NOT NULL,
      violation_type VARCHAR(128),
      violation_detail TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(128),
      ou_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      solution_proposal TEXT,
      solution_confirm TEXT,
      status VARCHAR(64),
      description TEXT,
      audit_batch TEXT,
      work_order TEXT,
      raw_data TEXT,
      CONSTRAINT unique_rule_firewall_audit UNIQUE (rulename, firewall_name, audit_batch)
    );

    CREATE TABLE rulefirewall_contact (
      rule_id INTEGER REFERENCES rulefirewall(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, contact_id)
    );
