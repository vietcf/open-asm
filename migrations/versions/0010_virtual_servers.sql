-- 0010_virtual_servers
-- Virtual Server management: track frontend listeners (VIP/domain + port)
-- and their backend server members for load balancers, CDN origins, etc.

CREATE TABLE IF NOT EXISTS virtual_servers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(255),
  provider      VARCHAR(100),
  ip_address    VARCHAR(45)  NOT NULL,
  port          INT          NOT NULL,
  protocol      VARCHAR(10)  NOT NULL DEFAULT 'HTTPS',
  device_id     INT          REFERENCES devices(id) ON DELETE SET NULL,
  description   TEXT,
  updated_by    VARCHAR(100),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS virtual_server_members (
  virtual_server_id INT NOT NULL REFERENCES virtual_servers(id) ON DELETE CASCADE,
  server_id         INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  port              INT,
  weight            INT          DEFAULT 1,
  status            VARCHAR(20)  DEFAULT 'active',
  PRIMARY KEY (virtual_server_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_vs_domain   ON virtual_servers (LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_vs_ip       ON virtual_servers (ip_address);
CREATE INDEX IF NOT EXISTS idx_vs_device   ON virtual_servers (device_id);
CREATE INDEX IF NOT EXISTS idx_vsm_server  ON virtual_server_members (server_id);
