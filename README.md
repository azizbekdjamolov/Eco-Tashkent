# Eco Tashkent

Shahar ekologiyasi va buyumlar almashinuvi ekotizimi — TZ asosida qurilgan MVP.

Odamlar kerak bo'lmagan buyumlarni (texnika, mebel, kiyim, kitob) bepul berishi,
almashishi yoki xayriya qilishi mumkin. Shu bilan birga saytda Toshkentdagi
qayta ishlash (recycling) punktlari xaritasi mavjud.

## Texnologiyalar

- **Backend:** Node.js + Express + PostgreSQL (`pg`), JWT autentifikatsiya, `multer` (rasm yuklash)
- **Frontend:** vanilla HTML/CSS/JS (build qadam kerak emas), Leaflet.js + OpenStreetMap (bepul, API key kerak emas)
- **Deploy:** Render.com (`render.yaml` bilan bir bosishda)

## Loyihani lokal ishga tushirish

```bash
npm install
cp .env.example .env   # keyin DATABASE_URL, JWT_SECRET, BOT_SECRET ni to'ldiring
node seed/seed.js      # namunaviy 10 ta qayta ishlash punktini qo'shadi
npm start               # http://localhost:3000
```

Lokal PostgreSQL kerak (yoki quyidagi Render bo'limidagi kabi bulutdagi bazadan foydalaning).

## Render.com ga deploy qilish

1. Bu loyihani GitHub repo sifatida push qiling.
2. Render.com da **New → Blueprint** tanlang va shu repoga ulang — `render.yaml`
   fayli avtomatik ravishda:
   - bepul PostgreSQL bazasini yaratadi,
   - web-servisni shu bazaga ulaydi (`DATABASE_URL` avtomatik beriladi),
   - `JWT_SECRET` va `BOT_SECRET` larni o'zi tasodifiy generatsiya qiladi.
3. Deploy tugagach, birinchi marta quyidagi buyruqni Render "Shell" bo'limida
   ishga tushiring (namunaviy qayta ishlash punktlarini qo'shish uchun):
   ```bash
   node seed/seed.js
   ```
4. Sayt tayyor — Render bergan `https://your-app.onrender.com` manzilidan foydalaning.

**Eslatma (rasm yuklash haqida):** Render’ning bepul tarifida disk vaqtinchalik —
servis qayta ishga tushganda (deploy, sleep/wake) `/uploads` papkasidagi rasmlar
o'chib ketishi mumkin. Hackathon/MVP uchun bu muammo emas, lekin production uchun
Cloudinary yoki Firebase Storage’ga o'tish tavsiya etiladi (TZ dagi 5-bo'limda ham
shu variant taklif qilingan).

## Loyiha tuzilishi

```
server.js              # Express serveri, static fayllar shu yerdan beriladi
db.js                  # PostgreSQL ulanishi va jadval sxemasi (avtomatik yaratiladi)
middleware/auth.js      # JWT tekshiruvi, admin va bot-secret middleware’lari
routes/
  auth.js               # ro'yxatdan o'tish / kirish
  items.js               # e'lonlar CRUD, filtr, qidiruv, rasm yuklash
  requests.js             # "Qiziqaman" so'rovlari, qabul/rad
  messages.js             # ichki chat
  points.js               # qayta ishlash punktlari
  users.js                 # bildirishnomalar
  bot.js                    # kelajakdagi Telegram bot uchun API (pastga qarang)
seed/seed.js             # namunaviy qayta ishlash punktlarini bazaga qo'shadi
public/                   # frontend (HTML/CSS/JS, build kerak emas)
```

## Telegram bot bilan sinxronizatsiya (keyingi bosqich)

Backend allaqachon botga tayyor holda qurilgan — bot alohida loyiha bo'lib,
xuddi shu bazaga **API orqali** ulanadi (bazaga to'g'ridan-to'g'ri emas). Barcha
`/api/bot/*` so'rovlari `X-Bot-Secret` header orqali himoyalangan (`.env` dagi
`BOT_SECRET` bilan bir xil bo'lishi kerak):

- `POST /api/bot/link` — `{ telefon, telegram_chat_id }`. Foydalanuvchi botga
  `/start` bosganda va telefon raqamini yuborganda, botingiz shu endpointni
  chaqirib, uning saytdagi profilini Telegram chat ID’siga bog'laydi.
- `GET /api/bot/notifications/pending` — sayt tomonida sodir bo'lgan va hali
  botga yuborilmagan voqealar ro'yxatini qaytaradi (yangi so'rov, so'rovga javob,
  yangi xabar). Bot buni har necha soniyada bir marta so'rab turadi (polling),
  har bir bildirishnomani foydalanuvchiga Telegram orqali yuboradi.
- `POST /api/bot/notifications/:id/ack` — bot xabarni yuborib bo'lgach, shu
  bildirishnomani "yuborildi" deb belgilaydi (qayta yubormaslik uchun).
  `PATCH /api/users/notifications/read-all` mustaqil funksiya — bularni
  aralashtirmang.
- `POST /api/bot/items` — bot orqali (masalan, foydalanuvchi botga rasm va
  matn yuborsa) yangi e'lon joylashtirish, `telegram_chat_id` orqali
  foydalanuvchi avtomatik aniqlanadi.

Botni odatda Python (`python-telegram-bot` yoki `aiogram`) yoki Node.js
(`telegraf`) bilan alohida loyiha sifatida yozasiz va u shu to'rtta endpointga
HTTP so'rov yuboradi — hech qanday umumiy kod yoki bazaga bevosita ulanish
kerak emas, shuning uchun ikkalasi mustaqil deploy qilinaveradi.

## TZ dagi funksiyalardan MVP’da nima bor / keyinga qoldirilgan

**Bor:** ro'yxatdan o'tish/kirish, profil, e'lon joylash (rasm bilan),
kategoriya/tuman/tur/kalit so'z bo'yicha filtr, "Qiziqaman" so'rovi, ichki chat,
qabul/rad, ekologik xarita (Leaflet + OSM), bildirishnomalar (saytda), admin
huquqi (rol darajasida — punkt qo'shish/o'chirish API’si tayyor).

**Keyinga qoldirilgan (TZ 4-bo'limida ham "MVP’dan keyin" deb belgilangan):**
push/SMS bildirishnoma (hozircha saytda ro'yxat ko'rinishida), ekologik ball
tizimi va gamifikatsiya, CO2 statistikasi, AI orqali rasm-kategoriya aniqlash,
ko'p tilli interfeys, to'liq admin paneli UI (API tayyor, UI yo'q).
