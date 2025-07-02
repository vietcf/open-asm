// Controller for API authentication (JWT login)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../../../config/config');
const User = require('../../models/User');
const Permission = require('../../models/Permission');
const JWT_SECRET = process.env.JWT_SECRET || 'VcB_your_jwt_secret';

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = await User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Lấy danh sách permissions thực tế cho user (dùng Permission model)
    let permissions = [];
    if (user.role_id) {
      permissions = await Permission.findByRoleId(user.role_id);
      permissions = permissions.map(p => p.name);
    }
    // Build JWT payload
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role_name || user.role,
      allowed_ips: user.allowed_ips || null,
      permissions
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
