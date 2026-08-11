const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const { material } = req.query;
  if (material) {
    const result = await pool.query(
      'SELECT * FROM recycling_points WHERE LOWER(material_turlari) LIKE $1 ORDER BY id',
      [`%${material.toLowerCase()}%`]
    );
    return res.json(result.rows);
  }
  const result = await pool.query('SELECT * FROM recycling_points ORDER BY id');
  res.json(result.rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { nomi, material_turlari, lat, lng, ish_vaqti, manzil } = req.body;
  if (!nomi || lat == null || lng == null) return res.status(400).json({ error: 'Nomi, lat, lng shart' });
  const result = await pool.query(
    `INSERT INTO recycling_points (nomi, material_turlari, lat, lng, ish_vaqti, manzil)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [nomi, material_turlari || '', lat, lng, ish_vaqti || '', manzil || '']
  );
  res.status(201).json(result.rows[0]);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM recycling_points WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
