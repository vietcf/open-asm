module.exports = async (pool) => {
  // Seed một số loại thiết bị mẫu
  await pool.query(`
    INSERT INTO device_types (name, description)
    VALUES
      ('Router', 'Thiết bị định tuyến mạng'),
      ('Switch', 'Thiết bị chuyển mạch'),
      ('Firewall', 'Thiết bị tường lửa'),
      ('Server', 'Máy chủ'),
      ('Storage', 'Thiết bị lưu trữ')
    ON CONFLICT (name) DO NOTHING;
  `);
};
