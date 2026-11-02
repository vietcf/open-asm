-- 0021_link_table_indexes
-- List and detail queries read each record's links with one subquery per list
-- (subList() in src/shared/db.js), looked up by the parent id. These link
-- tables had no index starting with that column, so every lookup scanned the
-- whole table. Small, plain indexes; existing data is not changed.
CREATE INDEX IF NOT EXISTS idx_tag_object_object ON tag_object (object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_system_ip_system ON system_ip (system_id);
CREATE INDEX IF NOT EXISTS idx_system_ip_ip ON system_ip (ip_id);
CREATE INDEX IF NOT EXISTS idx_system_contact_system ON system_contact (system_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_object ON file_uploads (object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_priv_user_contacts_user ON priv_user_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_priv_user_systems_user ON priv_user_systems (user_id);
CREATE INDEX IF NOT EXISTS idx_priv_user_servers_user ON priv_user_servers (user_id);
