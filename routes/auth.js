const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, ism: user.ism, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    ism: u.ism,
    telefon: u.telefon,
    email: u.email,
    tuman: u.tuman,
    rol: u.rol,
    reyting: u.reyting,
    ngo_verified: u.ngo_verified
  };
}

router.post('/register', async (req, res) => {
  try {
    const { ism, telefon, email, password, tuman } = req.body;
    if (!ism || !password || (!telefon && !email)) {
      return res.status(400).json({ error: 'Ism, parol va telefon yoki email kiritilishi shart' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });
    }
    const existing = await pool.query(
      'SELECT id FROM users WHERE (telefon IS NOT NULL AND telefon = $1) OR (email IS NOT NULL AND email = $2)',
      [telefon || null, email || null]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bu telefon yoki email allaqachon ro\'yxatdan o\'tgan' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (ism, telefon, email, password_hash, tuman)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ism, telefon || null, email || null, hash, tuman || null]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Login va parol kiritilishi shart' });
    }
    const result = await pool.query(
      'SELECT * FROM users WHERE telefon = $1 OR email = $1',
      [identifier]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Parol noto\'g\'ri' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
  res.json(publicUser(result.rows[0]));
});

module.exports = router;
