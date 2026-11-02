-- 0005_drop_device_page_size_config
-- The device list now uses the same page size options as every other list
-- ("page_size"); its separate "device_page_size" override is gone.
-- Also applied by migrations/data/migrate_data.js after copying older data.
DELETE FROM configuration WHERE key = 'device_page_size';
