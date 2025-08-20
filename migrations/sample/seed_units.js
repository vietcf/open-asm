export default async (pool) => {
  await pool.query(`
    INSERT INTO units (name, code, description)
    VALUES
      ('IT Department', 'IT', 'Information Technology'),
      ('HR Department', 'HR', 'Human Resources'),
      ('Finance', 'FIN', 'Finance & Accounting')
    ON CONFLICT DO NOTHING;
  `);
};