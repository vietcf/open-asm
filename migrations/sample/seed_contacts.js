export default async (pool) => {
  await pool.query('TRUNCATE TABLE contacts RESTART IDENTITY CASCADE;');

  await pool.query(`
    INSERT INTO contacts (name, email, phone, unit_id, position)
    VALUES
      ('Nguyen Van A', 'a@example.com', '0901234567', 1, 'Manager'),
      ('Tran Thi B', 'b@example.com', '0912345678', 2, 'Staff'),
      ('Le Van C', 'c@example.com', '0923456789', 3, 'Accountant'),
      ('Pham Thi D', 'd@example.com', '0934567890', 1, 'Engineer'),
      ('Hoang Van E', 'e@example.com', '0945678901', 2, 'Technician')
    ON CONFLICT DO NOTHING;
  `);
};