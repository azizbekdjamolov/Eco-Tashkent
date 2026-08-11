const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Ommaviy statistika: bosh sahifa va Telegram kartochkasi uchun haqiqiy sonlar.
// Bot yoki foydalanuvchi autentifikatsiyasi talab qilinmaydi — faqat o'qish uchun.
router.get('/', async (req, res) => {
  try {
    const [items, points, telegramUsers, requestsToday] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS n FROM items WHERE status = 'mavjud'"),
      pool.query('SELECT COUNT(*)::int AS n FROM recycling_points'),
      pool.query('SELECT COUNT(*)::int AS n FROM users WHERE telegram_chat_id IS NOT NULL'),
      pool.query("SELECT COUNT(*)::int AS n FROM requests WHERE yaratilgan_sana >= CURRENT_DATE")
    ]);
    res.json({
      faolElonlar: items.rows[0].n,
      ekoPunktlar: points.rows[0].n,
      telegramFoydalanuvchilar: telegramUsers.rows[0].n,
      bugungiSorovlar: requestsToday.rows[0].n
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
