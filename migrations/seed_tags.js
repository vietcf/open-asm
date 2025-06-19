/**
 * Seed sample tags into the tags table.
 * Tags are used for categorizing objects (e.g., IPs, systems, contacts, ...)
 */
module.exports = async function seedTags(pool) {
  const tags = [
    { name: 'Critical', description: 'Đối tượng quan trọng, cần ưu tiên' },
    { name: 'Production', description: 'Đối tượng thuộc môi trường production' },
    { name: 'Test', description: 'Đối tượng dùng cho test/dev' },
    { name: 'Internal', description: 'Đối tượng nội bộ' },
    { name: 'External', description: 'Đối tượng bên ngoài' },
    { name: 'Legacy', description: 'Đối tượng cũ, cần thay thế' },
    { name: 'VIP', description: 'Đối tượng đặc biệt, cần chú ý' },
  ];

  for (const tag of tags) {
    // Upsert: insert if not exists (by name)
    await pool.query(
      `INSERT INTO tags (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [tag.name, tag.description]
    );
  }

  // Seed tag_object: gán tag cho các đối tượng mẫu
  // Lấy id các tag vừa seed
  const { rows: tagRows } = await pool.query('SELECT id, name FROM tags');
  const tagMap = {};
  tagRows.forEach(tag => { tagMap[tag.name] = tag.id; });

  // Danh sách seed mẫu cho tag_object
  const tagObjectData = [
    // Gán tag 'Critical' cho IP 1,2
    { tag_id: tagMap['Critical'], object_type: 'ip_address', object_id: 1 },
    { tag_id: tagMap['Critical'], object_type: 'ip_address', object_id: 2 },
    // Gán tag 'Production' cho server 1
    { tag_id: tagMap['Production'], object_type: 'server', object_id: 1 },
    // Gán tag 'Test' cho IP 3
    { tag_id: tagMap['Test'], object_type: 'ip_address', object_id: 3 },
    // Gán tag 'Internal' cho server 2
    { tag_id: tagMap['Internal'], object_type: 'server', object_id: 2 },
  ];

  for (const row of tagObjectData) {
    await pool.query(
      'INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [row.tag_id, row.object_type, row.object_id]
    );
  }
  console.log('Seeded tags table và tag_object table.');
};
