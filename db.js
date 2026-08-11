const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
      }
    : {
        host: process.env.PGHOST || 'localhost',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'eco_tashkent',
        port: process.env.PGPORT || 5432
      }
);

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      ism TEXT NOT NULL,
      telefon TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      tuman TEXT,
      rol TEXT NOT NULL DEFAULT 'user',
      reyting NUMERIC DEFAULT 5.0,
      reyting_soni INTEGER DEFAULT 0,
      ngo_verified BOOLEAN DEFAULT FALSE,
      telegram_chat_id TEXT,
      yaratilgan_sana TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      nomi TEXT NOT NULL,
      tavsif TEXT,
      kategoriya TEXT NOT NULL,
      holat TEXT NOT NULL DEFAULT 'yaxshi',
      tur TEXT NOT NULL DEFAULT 'bepul',
      rasm_url TEXT,
      tuman TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      status TEXT NOT NULL DEFAULT 'mavjud',
      yaratilgan_sana TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'kutilmoqda',
      yaratilgan_sana TIMESTAMP DEFAULT NOW(),
      UNIQUE(item_id, requester_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      matn TEXT NOT NULL,
      sana TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recycling_points (
      id SERIAL PRIMARY KEY,
      nomi TEXT NOT NULL,
      material_turlari TEXT,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      ish_vaqti TEXT,
      manzil TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      baholovchi_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ball INTEGER NOT NULL,
      izoh TEXT,
      yaratilgan_sana TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      turi TEXT NOT NULL,
      matn TEXT NOT NULL,
      link TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      is_sent_to_bot BOOLEAN DEFAULT FALSE,
      yaratilgan_sana TIMESTAMP DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initSchema };
