-- Service mapping: optional owning system, CDN/WAF access mode (full public or limited
-- to allowed source IPs), drop member weight, member status reduced to active/inactive.
ALTER TABLE virtual_servers
  ADD COLUMN system_id   INTEGER REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN access_mode VARCHAR(10) NOT NULL DEFAULT 'full',
  ADD COLUMN allowed_ips TEXT[];

CREATE INDEX idx_vs_system ON virtual_servers (system_id);

ALTER TABLE virtual_server_members DROP COLUMN weight;

UPDATE virtual_server_members SET status = 'inactive' WHERE status IS NULL OR status NOT IN ('active', 'inactive');
