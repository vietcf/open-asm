-- 0031_user_managed_units
-- A user has one unit (users.unit_id) and a tick "manages the privileged
-- accounts of their unit" (users.priv_unit_admin): only then does the unit
-- limit (priv_scope_enforced) give them the privileged accounts, roles and
-- permissions of the systems whose L2 / L3 department is that unit. The
-- "extra units" list of 0030 (user_scope_units) is dropped. Existing data:
--   - a user without a unit but with extra units gets the first of them;
--   - users who had a unit or extra units get the tick (same access as before
--     for their own unit).
UPDATE users u SET unit_id = x.unit_id
  FROM (SELECT user_id, MIN(unit_id) AS unit_id FROM user_scope_units GROUP BY user_id) x
 WHERE x.user_id = u.id AND u.unit_id IS NULL;

ALTER TABLE users ADD COLUMN priv_unit_admin BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET priv_unit_admin = true WHERE unit_id IS NOT NULL;
COMMENT ON COLUMN users.priv_unit_admin IS 'Manages the privileged accounts of the systems whose L2 / L3 department is their unit';

DROP TABLE user_scope_units;
