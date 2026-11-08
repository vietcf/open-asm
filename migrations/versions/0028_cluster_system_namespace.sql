-- 0028_cluster_system_namespace
-- On an OCP / Kubernetes cluster each system runs in its own namespace: the
-- system <-> cluster link now records it (optional). Within one cluster a
-- namespace belongs to one system only. Existing links have none (NULL);
-- no rows need converting.
ALTER TABLE cluster_system ADD COLUMN namespace VARCHAR(63);
COMMENT ON COLUMN cluster_system.namespace IS 'Kubernetes / OCP namespace of the system on this cluster (optional)';
CREATE UNIQUE INDEX idx_cluster_system_namespace ON cluster_system (cluster_id, namespace) WHERE namespace IS NOT NULL;
