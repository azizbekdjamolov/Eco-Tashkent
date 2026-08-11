const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `item_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat rasm fayllarga ruxsat berilgan'));
  }
});

// GET /api/items - list with filters
router.get('/', async (req, res) => {
  try {
    const { kategoriya, tuman, tur, q, status, user_id } = req.query;
    const clauses = [];
    const params = [];
    if (kategoriya) { params.push(kategoriya); clauses.push(`i.kategoriya = $${params.length}`); }
    if (tuman) { params.push(tuman); clauses.push(`i.tuman = $${params.length}`); }
    if (tur) { params.push(tur); clauses.push(`i.tur = $${params.length}`); }
    if (user_id) { params.push(user_id); clauses.push(`i.user_id = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`i.status = $${params.length}`); }
    else { clauses.push(`i.status != 'ochirilgan'`); }
    if (q) { params.push(`%${q.toLowerCase()}%`); clauses.push(`(LOWER(i.nomi) LIKE $${params.length} OR LOWER(i.tavsif) LIKE $${params.length})`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT i.*, u.ism AS egasi_ismi, u.reyting AS egasi_reytingi, u.ngo_verified
       FROM items i JOIN users u ON u.id = i.user_id
       ${where} ORDER BY i.yaratilgan_sana DESC LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/:id', async (req, res) => {
  const result = await pool.query(
    `SELECT i.*, u.ism AS egasi_ismi, u.telefon AS egasi_telefon, u.reyting AS egasi_reytingi, u.ngo_verified
     FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'E\'lon topilmadi' });
  res.json(result.rows[0]);
});

router.post('/', requireAuth, upload.array('rasmlar', 4), async (req, res) => {
  try {
    const { nomi, tavsif, kategoriya, holat, tur, tuman, lat, lng } = req.body;
    if (!nomi || !kategoriya) return res.status(400).json({ error: 'Nomi va kategoriya shart' });
    let rasmUrls = [];
    if (req.files && req.files.length) {
      rasmUrls = req.files.map(f => `/uploads/${f.filename}`);
    } else if (req.body.rasm_url) {
      rasmUrls = String(req.body.rasm_url).split(',').map(s => s.trim()).filter(Boolean);
    }
    const result = await pool.query(
      `INSERT INTO items (user_id, nomi, tavsif, kategoriya, holat, tur, rasm_url, tuman, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, nomi, tavsif || '', kategoriya, holat || 'yaxshi', tur || 'bepul',
       rasmUrls.join(','), tuman || null, lat || null, lng || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Server xatosi' });
  }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['mavjud', 'band', 'berilgan'].includes(status)) {
    return res.status(400).json({ error: 'Noto\'g\'ri status' });
  }
  const item = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
  if (!item.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
  if (item.rows[0].user_id !== req.user.id && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  const result = await pool.query('UPDATE items SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(result.rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const item = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
  if (!item.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
  if (item.rows[0].user_id !== req.user.id && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
