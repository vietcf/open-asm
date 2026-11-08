-- 0035_internal_exposure
-- A fifth flow, Internal Exposure (direction inbound, scope internal): internal
-- users -> domain (optional) -> VIP IP:port + protocol (on its LB) -> backends
-- IP:port + protocol. No CDN, channel or partner IPs. virtual_servers.scope is
-- free text: no schema change for it.
-- Backends get their own protocol (inbound flows), e.g. HTTPS on the VIP and
-- HTTP on the backends when the LB offloads TLS. Existing backends have none
-- (NULL); no rows need converting.
ALTER TABLE virtual_server_members ADD COLUMN protocol VARCHAR(10);
COMMENT ON COLUMN virtual_server_members.protocol IS 'Backend protocol (inbound flows), e.g. HTTP behind an HTTPS VIP';
