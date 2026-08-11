require('dotenv').config();
const { pool, initSchema } = require('../db');

const points = [
  { nomi: 'Yunusobod qayta ishlash punkti', material_turlari: 'plastik, qog\'oz, shisha', lat: 41.3506, lng: 69.2887, ish_vaqti: '09:00–18:00', manzil: 'Yunusobod tumani, Amir Temur ko\'chasi' },
  { nomi: 'Chilonzor saralash markazi', material_turlari: 'plastik, metall, batareyka', lat: 41.2856, lng: 69.2034, ish_vaqti: '08:00–19:00', manzil: 'Chilonzor tumani, Bunyodkor shoh ko\'chasi' },
  { nomi: 'Mirzo Ulug\'bek eko-punkti', material_turlari: 'qog\'oz, karton, shisha', lat: 41.3306, lng: 69.3287, ish_vaqti: '09:00–17:00', manzil: 'Mirzo Ulug\'bek tumani' },
  { nomi: 'Sergeli qayta ishlash punkti', material_turlari: 'plastik, metall', lat: 41.2280, lng: 69.2270, ish_vaqti: '09:00–18:00', manzil: 'Sergeli tumani' },
  { nomi: 'Shayxontohur konteyner maydonchasi', material_turlari: 'plastik, qog\'oz, batareyka', lat: 41.3266, lng: 69.2320, ish_vaqti: '24/7', manzil: 'Shayxontohur tumani' },
  { nomi: 'Yakkasaroy eko-nuqtasi', material_turlari: 'shisha, metall, kiyim', lat: 41.2938, lng: 69.2632, ish_vaqti: '10:00–19:00', manzil: 'Yakkasaroy tumani' },
  { nomi: 'Mirobod saralash punkti', material_turlari: 'qog\'oz, plastik', lat: 41.3018, lng: 69.2967, ish_vaqti: '09:00–18:00', manzil: 'Mirobod tumani' },
  { nomi: 'Bektemir qayta ishlash markazi', material_turlari: 'metall, plastik, batareyka', lat: 41.2603, lng: 69.3467, ish_vaqti: '08:00–17:00', manzil: 'Bektemir tumani' },
  { nomi: 'Uchtepa eko-konteyner', material_turlari: 'plastik, qog\'oz, shisha', lat: 41.3129, lng: 69.1889, ish_vaqti: '09:00–18:00', manzil: 'Uchtepa tumani' },
  { nomi: 'Olmazor saralash nuqtasi', material_turlari: 'kiyim, kitob, plastik', lat: 41.3550, lng: 69.2120, ish_vaqti: '10:00–18:00', manzil: 'Olmazor tumani' }
];

async function seed() {
  await initSchema();
  const existing = await pool.query('SELECT COUNT(*) FROM recycling_points');
  if (parseInt(existing.rows[0].count, 10) > 0) {
    console.log('Recycling points allaqachon mavjud, seed o\'tkazib yuborildi.');
    process.exit(0);
  }
  for (const p of points) {
    await pool.query(
      `INSERT INTO recycling_points (nomi, material_turlari, lat, lng, ish_vaqti, manzil)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.nomi, p.material_turlari, p.lat, p.lng, p.ish_vaqti, p.manzil]
    );
  }
  console.log(`${points.length} ta qayta ishlash punkti qo'shildi.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
