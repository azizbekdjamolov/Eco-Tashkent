require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initSchema } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    else if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  }
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/points', require('./routes/points'));
app.use('/api/users', require('./routes/users'));
app.use('/api/bot', require('./routes/bot'));

app.get('/api/health', (req, res) => res.json({ ok: true, xizmat: 'Eco Tashkent API' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server xatosi' });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Eco Tashkent server ${PORT}-portda ishga tushdi`));
  })
  .catch(err => {
    console.error('DB ulanishda xatolik:', err);
    process.exit(1);
  });