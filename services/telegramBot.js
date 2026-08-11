// Eco Tashkent uchun o'rnatilgan Telegram bot.
//
// Avvalgi loyihada bot "alohida xizmat" deb rejalashtirilgan edi (faqat
// /api/bot/* endpointlari orqali ulanadigan), lekin haqiqatda hech qanday
// bot ishlamagani uchun Telegram orqali kirish kodi hech kimga yetib
// bormasdi. Endi bot shu server jarayonining o'zida ishlaydi (polling),
// shuning uchun alohida deploy qilish shart emas — BOT_TOKEN ni .env ga
// qo'yish kifoya.
const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('../db');

let bot = null;

function normalizePhone(raw) {
  let p = String(raw || '').trim().replace(/[\s-()]/g, '');
  if (p && !p.startsWith('+')) p = '+' + p;
  return p;
}

function initTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log("[telegram] BOT_TOKEN sozlanmagan — Telegram bot ishga tushmadi (Telegram orqali kirish ishlamaydi, faqat email/Google/parol ishlaydi)");
    return null;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Assalomu alaykum! 🌱 Eco Tashkent botiga xush kelibsiz.\n\n" +
      "Saytga Telegram orqali kirish uchun avval telefon raqamingizni tasdiqlang — pastdagi tugmani bosing.",
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
      const existing = await pool.query('SELECT id FROM users WHERE telefon = $1', [telefon]);
      if (existing.rows[0]) {
        await pool.query('UPDATE users SET telegram_chat_id = $1 WHERE telefon = $2', [String(chatId), telefon]);
      } else {
        await pool.query(
          `INSERT INTO users (ism, telefon, telegram_chat_id, password_hash)
           VALUES ($1, $2, $3, NULL)`,
          [msg.contact.first_name || 'Telegram foydalanuvchisi', telefon, String(chatId)]
        );
      }
      await bot.sendMessage(
        chatId,
        `✅ Raqamingiz (${telefon}) saytga bog'landi!\n\nEndi saytning "Kirish" sahifasida Telegram bo'limidan shu raqamni kiriting — kod shu yerga keladi.`,
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

// Kirish kodini to'g'ridan-to'g'ri (navbatsiz) yuborish uchun — auth.js shundan foydalanadi.
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

module.exports = { initTelegramBot, sendLoginCode, isBotActive };
