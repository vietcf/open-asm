-- 0027_server_os_version
-- Servers get a free-text OS version next to their platform (os_id), e.g.
-- "22.04 LTS", "2019 Datacenter". The form suggests the versions already
-- recorded. Existing servers have none (NULL); no rows need converting.
ALTER TABLE servers ADD COLUMN os_version VARCHAR(100);
COMMENT ON COLUMN servers.os_version IS 'OS version (free text, e.g. 22.04 LTS)';
