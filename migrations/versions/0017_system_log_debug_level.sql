-- system_log gets a 'debug' level, below info. It is only written by the REST
-- API debug log (configuration api_debug_log = on, seeded off), which records
-- each /api/v1 request with its JSON body; the log_level setting does not
-- filter it.
ALTER TABLE system_log DROP CONSTRAINT system_log_level_check;
ALTER TABLE system_log ADD CONSTRAINT system_log_level_check CHECK (level IN ('debug', 'info', 'warning', 'critical'));
