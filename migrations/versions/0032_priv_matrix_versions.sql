-- 0032_priv_matrix_versions
-- Permission matrix (role x permission) versions of a system: each version
-- keeps a snapshot of the matrix when it was made (its Word document is built
-- from it, so it never changes), then the signed PDF once it comes back.
--   status   draft (Word made, not signed yet) | signed (PDF uploaded)
--   version  1, 2, 3... per system
-- New table only; existing data is not touched.
CREATE TABLE priv_matrix_versions (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  note TEXT,
  signed_at DATE,
  signed_file_path TEXT,
  signed_file_name VARCHAR(255),
  signed_uploaded_by VARCHAR(100),
  signed_uploaded_at TIMESTAMP,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (system_id, version),
  CHECK (status = 'draft' OR signed_file_path IS NOT NULL)
);
CREATE INDEX idx_priv_matrix_versions_system ON priv_matrix_versions (system_id, version DESC);
