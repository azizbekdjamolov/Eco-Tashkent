// Email orqali kirish kodini yuborish. SMTP sozlanmagan bo'lsa (masalan,
// lokal development paytida), kod konsolga chiqariladi — sayt xato bermaydi,
// shunchaki ishlab chiquvchi kodni terminaldan ko'radi.
const nodemailer = require('nodemailer');

let transporter = null;
let triedInit = false;

function getTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.log("[email] EMAIL_HOST/EMAIL_USER/EMAIL_PASS sozlanmagan — kodlar konsolga chiqariladi (dev rejim)");
    return null;
  }
  const port = Number(process.env.EMAIL_PORT || 587);
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  return transporter;
}

async function sendLoginCodeEmail(to, code) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email][DEV] ${to} uchun kirish kodi: ${code}`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: 'Eco Tashkent — kirish kodingiz',
      text: `Eco Tashkent saytiga kirish kodingiz: ${code}\nKod 5 daqiqa amal qiladi. Hech kimga bermang.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;border:1px solid #E5E7EB;border-radius:14px;">
          <h2 style="color:#16A34A;margin:0 0 12px;">Eco Tashkent 🌱</h2>
          <p style="color:#334155;margin:0 0 18px;">Saytga kirish kodingiz:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#0E7E39;margin:0 0 18px;">${code}</p>
          <p style="color:#94A3B8;font-size:13px;margin:0;">Kod 5 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, xabarni e'tiborsiz qoldiring.</p>
        </div>`
    });
    return true;
  } catch (e) {
    console.error('[email] Yuborishda xatolik:', e.message);
    return false;
  }
}

module.exports = { sendLoginCodeEmail };
