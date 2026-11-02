-- Add direction (inbound/outbound) and scope (public/private) to service mappings.
-- Existing rows default to inbound + public (the original use-case).
ALTER TABLE virtual_servers
  ADD COLUMN direction VARCHAR(10) NOT NULL DEFAULT 'inbound',
  ADD COLUMN scope     VARCHAR(10) NOT NULL DEFAULT 'public';

CREATE INDEX idx_vs_direction ON virtual_servers (direction);
CREATE INDEX idx_vs_scope     ON virtual_servers (scope);
