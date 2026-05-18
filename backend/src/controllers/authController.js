const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// @route   POST /api/auth/register (admin only)
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;

  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }
  if (!['admin', 'staff'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    throw new AppError('Email already registered', 409);
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
    [name.trim(), email.toLowerCase().trim(), hashed, role]
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: result.rows[0] }
  });
});

// @route   PUT /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect', 400);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  res.json({ success: true, message: 'Password updated successfully' });
});

// @route   GET /api/auth/users (admin only)
const getUsers = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: { users: result.rows } });
});

module.exports = { login, getMe, register, changePassword, getUsers };
