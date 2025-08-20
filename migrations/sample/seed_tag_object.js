// Seed mẫu cho bảng tag_object: gán tag cho nhiều loại đối tượng
export default async (db) => {
  // Lấy id các tag mẫu
  const { rows: tags } = await db.query('SELECT id, name FROM tags');
  // Ví dụ: gán tag cho IP (object_type: 'ip_address'), server (object_type: 'server')
  // Giả sử object_id 1,2,3 đã tồn tại trong các bảng tương ứng
  const tagMap = {};
  tags.forEach(tag => { tagMap[tag.name] = tag.id; });

  // Danh sách seed mẫu
  const data = [
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

  for (const row of data) {
    await db.query(
      'INSERT INTO tag_object (tag_id, object_type, object_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [row.tag_id, row.object_type, row.object_id]
    );
  }
  console.log('Seeded tag_object table.');
};
