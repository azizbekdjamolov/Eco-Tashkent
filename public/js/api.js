const API_BASE = '/api';

function getToken() { return localStorage.getItem('eco_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('eco_user') || 'null'); } catch (e) { return null; }
}
function setSession(token, user) {
  localStorage.setItem('eco_token', token);
  localStorage.setItem('eco_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('eco_token');
  localStorage.removeItem('eco_user');
}
function isLoggedIn() { return !!getToken(); }

async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Xatolik yuz berdi');
    err.status = res.status;
    throw err;
  }
  return data;
}

const KATEGORIYALAR = [
  { id: 'texnika', label: 'Texnika', icon: '🔌' },
  { id: 'mebel', label: 'Mebel', icon: '🪑' },
  { id: 'kitob', label: 'Kitob', icon: '📚' },
  { id: 'kiyim', label: 'Kiyim', icon: '👕' },
  { id: 'bolalar', label: 'Bolalar buyumlari', icon: '🧸' },
  { id: 'boshqa', label: 'Boshqa', icon: '📦' }
];

const TUMANLAR = [
  'Bektemir', 'Chilonzor', 'Mirobod', 'Mirzo Ulug\'bek', 'Olmazor',
  'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 'Yunusobod'
];

const TUR_LABELS = { bepul: 'Bepul berish', almashish: 'Almashish', xayriya: 'Xayriya' };
const STATUS_LABELS = { mavjud: 'Mavjud', band: 'Band qilingan', berilgan: 'Berilgan', ochirilgan: 'O\'chirilgan' };

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
}

function firstImage(rasmUrl) {
  if (!rasmUrl) return null;
  return rasmUrl.split(',')[0].trim() || null;
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}
