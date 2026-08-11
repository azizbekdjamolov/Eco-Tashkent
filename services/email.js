// Email orqali kirish kodini yuborish.
// Render'ning bepul (free) tarifi SMTP portlarini (25/465/587) bloklaydi,
// shuning uchun bu yerda ikkita usul bor:
//  1) BREVO_API_KEY sozlangan bo'lsa — Brevo HTTP API orqali yuboriladi
//     (SMTP emas, oddiy HTTPS so'rov, Render blokiga tushmaydi).
//  2) Aks holda, eski SMTP (nodemailer/Gmail) usuliga qaytadi — bu faqat
//     lokal kompyuterda yoki Render'ning pullik tarifida ishlaydi.
//  3) Hech biri sozlanmagan bo'lsa — kod konsolga chiqariladi (dev rejim).
const nodemailer = require('nodemailer');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendViaBrevo(to, code) {
  const { BREVO_API_KEY, EMAIL_FROM, EMAIL_USER } = process.env;
  const senderEmail = (EMAIL_FROM && EMAIL_FROM.match(/<(.+)>/)?.[1]) || EMAIL_FROM || EMAIL_USER;
  const senderName = (EMAIL_FROM && EMAIL_FROM.split('<')[0].trim()) || 'Eco Tashkent';

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject: 'Eco Tashkent — kirish kodingiz',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;border:1px solid #E5E7EB;border-radius:14px;">
          <h2 style="color:#16A34A;margin:0 0 12px;">Eco Tashkent 🌱</h2>
          <p style="color:#334155;margin:0 0 18px;">Saytga kirish kodingiz:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#0E7E39;margin:0 0 18px;">${code}</p>
          <p style="color:#94A3B8;font-size:13px;margin:0;">Kod 5 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, xabarni e'tiborsiz qoldiring.</p>
        </div>`,
      textContent: `Eco Tashkent saytiga kirish kodingiz: ${code}\nKod 5 daqiqa amal qiladi. Hech kimga bermang.`
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Brevo xatosi (${res.status}): ${errText}`);
  }
  return true;
}

let transporter = null;
let triedInit = false;

function getSmtpTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  const port = Number(process.env.EMAIL_PORT || 587);
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    connectionTimeout: 8000, // 8s — Render'da bloklangan portda abadiy osilib qolmasin
    greetingTimeout: 8000,
    socketTimeout: 8000
  });
  return transporter;
}

async function sendLoginCodeEmail(to, code) {
  // 1) Brevo (HTTP API) — Render free tier'da ham ishlaydi
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo(to, code);
      return true;
    } catch (e) {
      console.error('[email][Brevo] Yuborishda xatolik:', e.message);
      return false;
    }
  }

  // 2) SMTP (Gmail) — faqat lokal yoki pullik hostingda ishonchli
  const t = getSmtpTransporter();
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
    console.error('[email][SMTP] Yuborishda xatolik:', e.message);
    return false;
  }
}

module.exports = { sendLoginCodeEmail };
