// Eco Tashkent uchun o'rnatilgan Telegram bot.
//
// Kirish oqimi: foydalanuvchi saytda telefon raqamini kiritadi -> sayt
// bitta bir martalik "token" yaratadi -> foydalanuvchi shu token bilan
// bot chatiga (https://t.me/<bot>?start=<token>) olib boriladi -> u yerda
// FAQAT "START" tugmasini bosadi (Telegramning o'zi shuni talab qiladi —
// botlar odamga oldindan yozmagan chatga xabar yubora olmaydi, shuning
// uchun bitta bosim baribir kerak) -> bot avtomatik ravishda hisobni
// telefon raqamiga bog'laydi -> sayt fonda buni kuzatib turib (polling),
// bog'lanishi bilanoq foydalanuvchini avtomatik tizimga kiritadi.
// Qo'lda kod terish shart emas.
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('../db');

let bot = null;

// token -> { telefon, ism, status: 'pending'|'linked', userId, createdAt }
const pendingLinks = new Map();
const LINK_TTL_MS = 5 * 60 * 1000;

function normalizePhone(raw) {
  let p = String(raw || '').trim().replace(/[\s-()]/g, '');
  if (p && !p.startsWith('+')) p = '+' + p;
  return p;
}

function createLinkToken(telefon, ism) {
  const token = crypto.randomBytes(16).toString('hex');
  pendingLinks.set(token, { telefon: normalizePhone(telefon), ism: ism || null, status: 'pending', userId: null, createdAt: Date.now() });
  return token;
}

// Holatni tekshirish uchun — o'chirmaydi (polling shu bilan ishlaydi).
function peekLinkStatus(token) {
  const entry = pendingLinks.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > LINK_TTL_MS) {
    pendingLinks.delete(token);
    return null;
  }
  return entry;
}

// "linked" holatidagi tokenni bir martalik iste'mol qilish (qayta ishlatib bo'lmaydi).
function consumeLinkToken(token) {
  const entry = peekLinkStatus(token);
  if (!entry || entry.status !== 'linked') return null;
  pendingLinks.delete(token);
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingLinks) {
    if (now - entry.createdAt > LINK_TTL_MS) pendingLinks.delete(token);
  }
}, 60 * 1000);

async function linkUserByPhone(telefon, chatId, fallbackName) {
  const existing = await pool.query('SELECT * FROM users WHERE telefon = $1', [telefon]);
  if (existing.rows[0]) {
    const upd = await pool.query(
      'UPDATE users SET telegram_chat_id = $1 WHERE telefon = $2 RETURNING *',
      [String(chatId), telefon]
    );
    return upd.rows[0];
  }
  const created = await pool.query(
    `INSERT INTO users (ism, telefon, telegram_chat_id, password_hash)
     VALUES ($1, $2, $3, NULL) RETURNING *`,
    [fallbackName || 'Telegram foydalanuvchisi', telefon, String(chatId)]
  );
  return created.rows[0];
}

function initTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log("[telegram] BOT_TOKEN sozlanmagan — Telegram bot ishga tushmadi (Telegram orqali kirish ishlamaydi, faqat email/Google/parol ishlaydi)");
    return null;
  }

  bot = new TelegramBot(token, { polling: true });

  // /start yoki /start <link-token>
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const payload = match && match[1] ? match[1].trim() : null;

    if (payload) {
      const entry = peekLinkStatus(payload);
      if (!entry) {
        bot.sendMessage(chatId, "⏱ Havola muddati o'tgan yoki noto'g'ri. Saytga qaytib, qaytadan urinib ko'ring.").catch(() => {});
        return;
      }
      try {
        const user = await linkUserByPhone(entry.telefon, chatId, entry.ism || msg.from.first_name);
        entry.status = 'linked';
        entry.userId = user.id;
        await bot.sendMessage(
          chatId,
          `✅ Xush kelibsiz, ${user.ism}!\n\nHisobingiz (${entry.telefon}) saytga muvaffaqiyatli bog'landi. Saytdagi oynaga qayting — avtomatik tizimga kirasiz.`
        );
      } catch (e) {
        console.error('[telegram] Link tokendan bog\'lashda xatolik:', e.message);
        bot.sendMessage(chatId, "Xatolik yuz berdi, birozdan keyin qayta urinib ko'ring.").catch(() => {});
      }
      return;
    }

    // Token'siz oddiy /start — telefon raqamini kontakt tugmasi orqali so'raymiz (zaxira usul).
    bot.sendMessage(
      chatId,
      "Assalomu alaykum! 🌱 Eco Tashkent botiga xush kelibsiz.\n\n" +
      "Saytga Telegram orqali kirish uchun sayt sizni bu yerga avtomatik olib keladi. Agar to'g'ridan-to'g'ri shu yerdan boshlagan bo'lsangiz, telefon raqamingizni tasdiqlang:",
      {
        reply_markup: {
          keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    ).catch(() => {});
  });

  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const telefon = normalizePhone(msg.contact.phone_number);
    if (!telefon) return;
    try {
      const user = await linkUserByPhone(telefon, chatId, msg.contact.first_name);
      await bot.sendMessage(
        chatId,
        `✅ Raqamingiz (${telefon}) saytga bog'landi!\n\nEndi saytga qaytib, telefon raqamingizni kiritib, Telegram orqali kiring.`,
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (e) {
      console.error('[telegram] Bog\'lashda xatolik:', e.message);
      bot.sendMessage(chatId, "Xatolik yuz berdi, birozdan keyin qayta urinib ko'ring.").catch(() => {});
    }
  });

  bot.on('polling_error', (err) => console.error('[telegram] Polling xatosi:', err.message));

  // Navbatga qo'yilgan (boshqa qismlarda yaratilgan) bildirishnomalarni —
  // masalan yangi so'rov yoki xabar — har 5 soniyada bir tekshirib,
  // bog'langan foydalanuvchilarga darhol yuboradi.
  setInterval(async () => {
    try {
      const pending = await pool.query(
        `SELECT n.*, u.telegram_chat_id FROM notifications n
         JOIN users u ON u.id = n.user_id
         WHERE n.is_sent_to_bot = FALSE AND u.telegram_chat_id IS NOT NULL
         ORDER BY n.yaratilgan_sana ASC LIMIT 20`
      );
      for (const n of pending.rows) {
        try {
          await bot.sendMessage(n.telegram_chat_id, n.matn);
          await pool.query('UPDATE notifications SET is_sent_to_bot = TRUE WHERE id = $1', [n.id]);
        } catch (e) {
          console.error('[telegram] Bildirishnoma yuborilmadi:', e.message);
        }
      }
    } catch (e) {
      // jadval hali yaratilmagan bo'lishi mumkin (ishga tushish paytida) — jim o'tkazamiz
    }
  }, 5000);

  console.log('[telegram] Bot ishga tushdi (polling rejimida)');
  return bot;
}

// Eski (qo'lda kod) oqimi uchun hali ham kerak — kirish kodini navbatsiz yuborish.
async function sendLoginCode(chatId, code) {
  if (!bot || !chatId) return false;
  try {
    await bot.sendMessage(chatId, `🔐 Eco Tashkent saytiga kirish kodingiz: ${code}\n\nKod 5 daqiqa amal qiladi. Hech kimga bermang!`);
    return true;
  } catch (e) {
    console.error('[telegram] Kod yuborilmadi:', e.message);
    return false;
  }
}

function isBotActive() {
  return !!bot;
}

module.exports = {
  initTelegramBot,
  sendLoginCode,
  isBotActive,
  createLinkToken,
  peekLinkStatus,
  consumeLinkToken
};
