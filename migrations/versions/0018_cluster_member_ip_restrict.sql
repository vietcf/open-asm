-- Deleting an IP address no longer silently removes it from the clusters it
-- belongs to: the reference becomes RESTRICT, and the IP delete is refused
-- (with the cluster names) until the IP is removed from those clusters.
ALTER TABLE cluster_members DROP CONSTRAINT cluster_members_ip_address_id_fkey;
ALTER TABLE cluster_members ADD CONSTRAINT cluster_members_ip_address_id_fkey
  FOREIGN KEY (ip_address_id) REFERENCES ip_addresses(id) ON DELETE RESTRICT;
