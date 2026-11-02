-- 0023_service_mapping_provider_port
-- The provider / channel of a service mapping (CDN, WAF, VPN, MPLS...) gets the
-- port and protocol it listens on, which can differ from the IP's (e.g. Akamai
-- on 443 HTTPS in front of an origin on 8443). Optional; existing mappings get
-- none (no value is guessed).
ALTER TABLE virtual_servers
  ADD COLUMN provider_port INT CHECK (provider_port BETWEEN 1 AND 65535),
  ADD COLUMN provider_protocol VARCHAR(10);
