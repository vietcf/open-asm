-- 0029_unit_parent
-- Organization units can be nested (e.g. Division > Department > Team):
-- units.parent_id points to the parent unit, NULL = top level. A unit that
-- still has sub-units cannot be deleted (RESTRICT); the app also refuses
-- cycles. Every existing unit stays top level; no rows need converting.
ALTER TABLE units ADD COLUMN parent_id INTEGER REFERENCES units(id) ON DELETE RESTRICT;
ALTER TABLE units ADD CONSTRAINT units_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
CREATE INDEX idx_units_parent ON units (parent_id);
COMMENT ON COLUMN units.parent_id IS 'Parent unit (NULL = top level)';
