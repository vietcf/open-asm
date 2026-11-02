-- 0006_add_system_ops_department
-- A system now has two departments, by support layer:
--   ops_department_id  Operations department (L2, administration/operations)  -- new
--   department_id      Development department (L3)                            -- existing
-- Existing values stay in department_id, so every department recorded so
-- far becomes the development (L3) department; no rows need converting.
-- migrations/data/migrate_data.js needs nothing extra either: older sources
-- have no ops_department_id, which stays NULL.
ALTER TABLE systems ADD COLUMN ops_department_id INTEGER REFERENCES units(id) ON DELETE SET NULL;
CREATE INDEX idx_systems_ops_department ON systems (ops_department_id);
COMMENT ON COLUMN systems.department_id IS 'Development department (L3)';
COMMENT ON COLUMN systems.ops_department_id IS 'Operations department (L2)';
