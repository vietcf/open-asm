-- Rename virtual_server permissions → service_mapping
-- role_permissions references permissions.id (FK), so updating the name here is sufficient.
UPDATE permissions SET name = REPLACE(name, 'virtual_server.', 'service_mapping.'),
                       description = REPLACE(description, 'virtual server', 'service mapping')
WHERE name LIKE 'virtual_server.%';
