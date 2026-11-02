-- Every editable object keeps created_at / updated_at (shown as "Created ... | Updated ...").
-- Rows that existed before this migration get the migration time as created_at
-- (the real creation time was never recorded), and updated_at = created_at.

-- Tables with neither column
ALTER TABLE agents      ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE services    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE domains     ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tags        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE roles       ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE permissions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Tables with created_at only
ALTER TABLE platforms ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE units     ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users     ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE platforms SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(created_at, CURRENT_TIMESTAMP);
UPDATE units     SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(created_at, CURRENT_TIMESTAMP);
UPDATE users     SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(created_at, CURRENT_TIMESTAMP);

-- Privileged-account tables used updated_date: same name as everywhere else
ALTER TABLE priv_users       RENAME COLUMN updated_date TO updated_at;
ALTER TABLE priv_roles       RENAME COLUMN updated_date TO updated_at;
ALTER TABLE priv_permissions RENAME COLUMN updated_date TO updated_at;
UPDATE priv_users       SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
UPDATE priv_roles       SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
UPDATE priv_permissions SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
