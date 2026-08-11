const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function notify(userId, turi, matn, link) {
  await pool.query(
    'INSERT INTO notifications (user_id, turi, matn, link) VALUES ($1,$2,$3,$4)',
    [userId, turi, matn, link || null]
  );
}

// "Qiziqaman" tugmasi -> so'rov yuborish
router.post('/', requireAuth, async (req, res) => {
  try {
    const { item_id } = req.body;
    const itemRes = await pool.query('SELECT * FROM items WHERE id = $1', [item_id]);
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: 'E\'lon topilmadi' });
    if (item.user_id === req.user.id) return res.status(400).json({ error: 'O\'z e\'loningizga so\'rov yubora olmaysiz' });

    const result = await pool.query(
      `INSERT INTO requests (item_id, requester_id) VALUES ($1,$2)
       ON CONFLICT (item_id, requester_id) DO UPDATE SET status = requests.status
       RETURNING *`,
      [item_id, req.user.id]
    );
    await notify(item.user_id, 'yangi_sorov', `"${item.nomi}" e'loningizga yangi so'rov keldi`, `/item.html?id=${item.id}`);
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Men yuborgan so'rovlar
router.get('/sent', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT r.*, i.nomi AS item_nomi, i.rasm_url, i.status AS item_status
     FROM requests r JOIN items i ON i.id = r.item_id
     WHERE r.requester_id = $1 ORDER BY r.yaratilgan_sana DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Menga (mening e'lonlarimga) kelgan so'rovlar
router.get('/received', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT r.*, i.nomi AS item_nomi, i.rasm_url, u.ism AS requester_ismi, u.telefon AS requester_telefon
     FROM requests r
     JOIN items i ON i.id = r.item_id
     JOIN users u ON u.id = r.requester_id
     WHERE i.user_id = $1 ORDER BY r.yaratilgan_sana DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Qabul qilish / rad etish
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['qabul', 'rad'].includes(status)) return res.status(400).json({ error: 'Noto\'g\'ri status' });

  const reqRow = await pool.query(
    `SELECT r.*, i.user_id AS owner_id, i.nomi AS item_nomi, i.id AS item_id
     FROM requests r JOIN items i ON i.id = r.item_id WHERE r.id = $1`,
    [req.params.id]
  );
  const row = reqRow.rows[0];
  if (!row) return res.status(404).json({ error: 'So\'rov topilmadi' });
  if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const result = await pool.query('UPDATE requests SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (status === 'qabul') {
    await pool.query(`UPDATE items SET status = 'band' WHERE id = $1`, [row.item_id]);
  }
  await notify(row.requester_id, 'sorov_javobi',
    `"${row.item_nomi}" bo'yicha so'rovingiz ${status === 'qabul' ? 'qabul qilindi' : 'rad etildi'}`,
    `/item.html?id=${row.item_id}`);
  res.json(result.rows[0]);
});

module.exports = router;
