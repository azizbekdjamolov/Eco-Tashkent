const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { sendLoginCode: sendTelegramCode, isBotActive } = require('../services/telegramBot');
const { sendLoginCodeEmail } = require('../services/email');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
    ngo_verified: u.ngo_verified,
    telegram_bog_langan: !!u.telegram_chat_id
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
    if (!user.password_hash) {
      return res.status(401).json({ error: "Bu hisob Google orqali yaratilgan — parol bilan emas, \"Google bilan kirish\" tugmasidan foydalaning" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Parol noto\'g\'ri' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});


// Telegram orqali kirish kodi: foydalanuvchi avval botga /start bosib o'z
// raqamini yuborgan (shu bilan telegram_chat_id profiliga bog'langan)
// bo'lishi kerak. Bot shu server jarayonining ichida ishlaydi
// (services/telegramBot.js), shuning uchun kod darhol, navbatsiz yuboriladi.
router.post('/request-code', async (req, res) => {
  try {
    const { telefon } = req.body;
    if (!telefon) return res.status(400).json({ error: 'Telefon raqami shart' });
    const userRes = await pool.query('SELECT * FROM users WHERE telefon = $1', [telefon]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Bu raqam bilan foydalanuvchi topilmadi' });
    if (!user.telegram_chat_id) {
      return res.status(409).json({ error: "Hisobingiz Telegram botiga bog'lanmagan. Avval botga /start bosing va telefon raqamingizni yuboring." });
    }
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      'INSERT INTO login_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
      [user.id, code, expiresAt]
    );
    const sent = await sendTelegramCode(user.telegram_chat_id, code);
    if (!sent) {
      // Bot vaqtincha yuborolmadi (masalan, foydalanuvchi botni bloklagan) —
      // barchbir kodni navbatga ham qo'yamiz, keyinroq qayta urinish uchun.
      await pool.query(
        `INSERT INTO notifications (user_id, turi, matn) VALUES ($1, 'login_code', $2)`,
        [user.id, `Eco Tashkent saytiga kirish kodingiz: ${code}\nKod 5 daqiqa amal qiladi.`]
      );
    }
    res.json({ ok: true, message: 'Kod Telegram orqali yuborildi' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { telefon, code } = req.body;
    if (!telefon || !code) return res.status(400).json({ error: 'Telefon va kod shart' });
    const userRes = await pool.query('SELECT * FROM users WHERE telefon = $1', [telefon]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const codeRes = await pool.query(
      `SELECT * FROM login_codes WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY yaratilgan_sana DESC LIMIT 1`,
      [user.id, code]
    );
    const loginCode = codeRes.rows[0];
    if (!loginCode) return res.status(401).json({ error: "Kod noto'g'ri yoki muddati o'tgan" });
    await pool.query('UPDATE login_codes SET used = TRUE WHERE id = $1', [loginCode.id]);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Email orqali kirish kodi: Telegramdan farqli o'laroq, bu yerda oldindan
// hech narsa bog'lash shart emas — foydalanuvchi hali ro'yxatdan o'tmagan
// bo'lsa ham, shu email bilan hisobi shu yerning o'zida (parolsiz)
// avtomatik yaratiladi va kod yuboriladi (bulldrop.uz kabi saytlardagi
// "email orqali kirish/ro'yxatdan o'tish" oqimiga o'xshash).
router.post('/request-email-code', async (req, res) => {
  try {
    const { email, ism } = req.body;
    if (!email) return res.status(400).json({ error: 'Email shart' });
    const normalizedEmail = String(email).trim().toLowerCase();

    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    let user = userRes.rows[0];
    if (!user) {
      const created = await pool.query(
        `INSERT INTO users (ism, email, password_hash) VALUES ($1, $2, NULL) RETURNING *`,
        [ism || normalizedEmail.split('@')[0], normalizedEmail]
      );
      user = created.rows[0];
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      'INSERT INTO login_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
      [user.id, code, expiresAt]
    );
    await sendLoginCodeEmail(normalizedEmail, code);
    res.json({ ok: true, message: 'Kod emailga yuborildi', isNewUser: !userRes.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/verify-email-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email va kod shart' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const codeRes = await pool.query(
      `SELECT * FROM login_codes WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY yaratilgan_sana DESC LIMIT 1`,
      [user.id, code]
    );
    const loginCode = codeRes.rows[0];
    if (!loginCode) return res.status(401).json({ error: "Kod noto'g'ri yoki muddati o'tgan" });
    await pool.query('UPDATE login_codes SET used = TRUE WHERE id = $1', [loginCode.id]);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Login/ro'yxatdan o'tish sahifalari shu yerdan qaysi kirish usullari
// sozlanganini bilib oladi (Google tugmasi, Telegram bo'limi va h.k.).
router.get('/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    telegramActive: isBotActive(),
    botUsername: process.env.BOT_USERNAME || null
  });
});

// Google Identity Services yuborgan ID tokenni tekshirib, foydalanuvchini
// topadi yoki (birinchi marta kirsa) avtomatik ro'yxatdan o'tkazadi.
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(503).json({ error: "Google bilan kirish serverda sozlanmagan (GOOGLE_CLIENT_ID yo'q)" });
    }
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential yo\'q' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;
    if (!email || !email_verified) {
      return res.status(401).json({ error: "Google email tasdiqlanmagan" });
    }

    // Avval google_id bo'yicha, keyin (bir marta password bilan ro'yxatdan
    // o'tib, endi Google bilan kirmoqchi bo'lganlar uchun) email bo'yicha izlaymiz.
    let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = result.rows[0];


    if (!user) {
      const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (byEmail.rows[0]) {
        const upd = await pool.query(
          'UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *',
          [googleId, byEmail.rows[0].id]
        );
        user = upd.rows[0];
      } else {
        const created = await pool.query(
          `INSERT INTO users (ism, email, google_id, password_hash) VALUES ($1, $2, $3, NULL) RETURNING *`,
          [name || email.split('@')[0], email, googleId]
        );
        user = created.rows[0];
      }
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: "Google token tekshiruvidan o'tmadi" });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
  res.json(publicUser(result.rows[0]));
});

module.exports = router;
