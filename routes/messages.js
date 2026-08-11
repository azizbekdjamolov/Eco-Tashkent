const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function canAccessRequest(requestId, userId) {
  const r = await pool.query(
    `SELECT r.*, i.user_id AS owner_id FROM requests r JOIN items i ON i.id = r.item_id WHERE r.id = $1`,
    [requestId]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.owner_id !== userId && row.requester_id !== userId) return false;
  return row;
}

router.get('/:requestId', requireAuth, async (req, res) => {
  const access = await canAccessRequest(req.params.requestId, req.user.id);
  if (access === null) return res.status(404).json({ error: 'So\'rov topilmadi' });
  if (access === false) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  const result = await pool.query(
    `SELECT m.*, u.ism AS sender_ismi FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.request_id = $1 ORDER BY m.sana ASC`,
    [req.params.requestId]
  );
  res.json(result.rows);
});

router.post('/:requestId', requireAuth, async (req, res) => {
  const { matn } = req.body;
  if (!matn || !matn.trim()) return res.status(400).json({ error: 'Xabar bo\'sh bo\'lishi mumkin emas' });
  const access = await canAccessRequest(req.params.requestId, req.user.id);
  if (access === null) return res.status(404).json({ error: 'So\'rov topilmadi' });
  if (access === false) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const result = await pool.query(
    'INSERT INTO messages (request_id, sender_id, matn) VALUES ($1,$2,$3) RETURNING *',
    [req.params.requestId, req.user.id, matn.trim()]
  );
  const otherUserId = access.owner_id === req.user.id ? access.requester_id : access.owner_id;
  await pool.query(
    'INSERT INTO notifications (user_id, turi, matn, link) VALUES ($1,$2,$3,$4)',
    [otherUserId, 'yangi_xabar', 'Sizga yangi xabar keldi', `/item.html?id=${access.item_id}&request=${access.id}`]
  );
  res.status(201).json(result.rows[0]);
});

module.exports = router;
