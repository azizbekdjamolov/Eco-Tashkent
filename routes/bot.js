// Bu fayl kelajakda yaraladigan Telegram bot bilan ma'lumot almashish uchun mo'ljallangan.
// Barcha so'rovlar X-Bot-Secret header orqali himoyalangan (.env dagi BOT_SECRET bilan bir xil bo'lishi kerak).
const express = require('express');
const { pool } = require('../db');
const { requireBotSecret } = require('../middleware/auth');

const router = express.Router();
router.use(requireBotSecret);

// Telegram foydalanuvchisini saytdagi profiliga bog'lash (telefon orqali)
router.post('/link', async (req, res) => {
  const { telefon, telegram_chat_id } = req.body;
  if (!telefon || !telegram_chat_id) return res.status(400).json({ error: 'telefon va telegram_chat_id shart' });
  const result = await pool.query(
    'UPDATE users SET telegram_chat_id = $1 WHERE telefon = $2 RETURNING id, ism, telefon',
    [String(telegram_chat_id), telefon]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Bu telefon raqami bilan foydalanuvchi topilmadi' });
  res.json({ ok: true, user: result.rows[0] });
});

// Bot yuborilmagan bildirishnomalarni so'rab oladi (polling)
router.get('/notifications/pending', async (req, res) => {
  const result = await pool.query(
    `SELECT n.*, u.telegram_chat_id FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.is_sent_to_bot = FALSE AND u.telegram_chat_id IS NOT NULL
     ORDER BY n.yaratilgan_sana ASC LIMIT 100`
  );
  res.json(result.rows);
});

// Bot xabarni telegram orqali yuborgach shu yerni chaqirib "yuborildi" deb belgilaydi
router.post('/notifications/:id/ack', async (req, res) => {
  await pool.query('UPDATE notifications SET is_sent_to_bot = TRUE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Bot orqali yangi e'lon joylash (foydalanuvchi telegram_chat_id bilan aniqlanadi)
router.post('/items', async (req, res) => {
  const { telegram_chat_id, nomi, tavsif, kategoriya, holat, tur, tuman, rasm_url } = req.body;
  const userRes = await pool.query('SELECT id FROM users WHERE telegram_chat_id = $1', [String(telegram_chat_id)]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'Bu telegram foydalanuvchisi saytga bog\'lanmagan' });
  if (!nomi || !kategoriya) return res.status(400).json({ error: 'nomi va kategoriya shart' });
  const result = await pool.query(
    `INSERT INTO items (user_id, nomi, tavsif, kategoriya, holat, tur, rasm_url, tuman)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [user.id, nomi, tavsif || '', kategoriya, holat || 'yaxshi', tur || 'bepul', rasm_url || '', tuman || null]
  );
  res.status(201).json(result.rows[0]);
});

module.exports = router;
