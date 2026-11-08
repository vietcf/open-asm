-- 0036_public_exposure_nat_ip
-- Public Exposure may NAT its public IP to a private IP before the backends:
--   ... -> public IP:port (FW) -> NAT -> private IP[:port] (e.g. a VIP on the LB) -> backends
-- virtual_servers.nat_ip_address_id   the private IP (an existing IP record), optional
-- virtual_servers.nat_port            its port, optional (empty = the public port)
-- Existing mappings have none (NULL); no rows need converting.
ALTER TABLE virtual_servers
  ADD COLUMN nat_ip_address_id INTEGER REFERENCES ip_addresses(id) ON DELETE SET NULL,
  ADD COLUMN nat_port INTEGER CHECK (nat_port BETWEEN 1 AND 65535);
CREATE INDEX idx_vs_nat_ip ON virtual_servers (nat_ip_address_id);
