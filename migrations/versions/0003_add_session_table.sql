-- 0003_add_session_table
-- Web sessions stored in PostgreSQL (connect-pg-simple) instead of process
-- memory: sessions survive app restarts / container rebuilds, and memory no
-- longer grows with the number of sessions.
CREATE TABLE session (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session (expire);
