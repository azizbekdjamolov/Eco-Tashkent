renderNav('home');

const grid = document.getElementById('item-grid');
const catStrip = document.getElementById('cat-strip');
const fq = document.getElementById('f-q');
const fKategoriya = document.getElementById('f-kategoriya');
const fTuman = document.getElementById('f-tuman');
const fTur = document.getElementById('f-tur');
const heroQ = document.getElementById('hero-q');
const heroSearchBtn = document.getElementById('hero-search-btn');

let activeKategoriya = '';

function buildFilterOptions() {
  KATEGORIYALAR.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k.id; opt.textContent = `${k.icon} ${k.label}`;
    fKategoriya.appendChild(opt);
  });
  TUMANLAR.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    fTuman.appendChild(opt);
  });
  catStrip.innerHTML = KATEGORIYALAR.map(k =>
    `<button class="cat-pill" data-cat="${k.id}"><span>${k.icon}</span> ${k.label}</button>`
  ).join('');
  catStrip.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-pill');
    if (!btn) return;
    const cat = btn.dataset.cat;
    activeKategoriya = activeKategoriya === cat ? '' : cat;
    fKategoriya.value = activeKategoriya;
    [...catStrip.children].forEach(c => c.style.outline = '');
    if (activeKategoriya) btn.style.outline = '2px solid var(--brand)';
    loadItems();
  });
}

function itemCardHtml(item) {
  const img = firstImage(item.rasm_url);
  const thumbStyle = img ? `style="background-image:url('${img}')"` : '';
  const catInfo = KATEGORIYALAR.find(k => k.id === item.kategoriya);
  return `
  <a class="item-card" href="item.html?id=${item.id}">
    <div class="item-thumb" ${thumbStyle}>
      ${!img ? `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2.2rem;">${catInfo ? catInfo.icon : '📦'}</div>` : ''}
      <span class="badge-tur">${TUR_LABELS[item.tur] || item.tur}</span>
      ${item.status !== 'mavjud' ? `<span class="badge-status">${STATUS_LABELS[item.status]}</span>` : ''}
    </div>
    <div class="item-body">
      <h3>${escapeHtml(item.nomi)}</h3>
      <div class="item-meta"><span>${catInfo ? catInfo.label : item.kategoriya}</span><span>${item.tuman || '—'}</span></div>
      <div class="item-owner">${escapeHtml(item.egasi_ismi)}${item.ngo_verified ? ' ✅' : ''} · ${timeAgo(item.yaratilgan_sana)}</div>
    </div>
  </a>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

let debounceTimer;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadItems, 300);
}

function setStatEls(id, value) {
  document.querySelectorAll(`[id="${id}"]`).forEach(el => { el.textContent = value; });
}

async function loadItems() {
  grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);">Yuklanmoqda...</p>';
  const params = new URLSearchParams();
  if (fq.value.trim()) params.set('q', fq.value.trim());
  if (fKategoriya.value) params.set('kategoriya', fKategoriya.value);
  if (fTuman.value) params.set('tuman', fTuman.value);
  if (fTur.value) params.set('tur', fTur.value);
  try {
    const items = await api(`/items?${params.toString()}`);
    setStatEls('stat-items', items.length);
    setStatEls('stat-items-2', items.length);
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="glyph">🌱</div>
        <h3>Hozircha e'lon topilmadi</h3>
        <p>Birinchi bo'lib buyum joylashtiring — u kimgadir juda kerak bo'lishi mumkin.</p>
        <a href="add-item.html" class="btn btn-primary">Buyum joylashtirish</a>
      </div>`;
      return;
    }
    grid.innerHTML = items.map(itemCardHtml).join('');
  } catch (e) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:var(--clay);">Xatolik: ${e.message}</p>`;
  }
}

async function loadStats() {
  try {
    const points = await api('/points');
    setStatEls('stat-points', points.length);
    setStatEls('stat-points-2', points.length);
  } catch (e) { /* ignore */ }
  try {
    const s = await api('/stats');
    document.getElementById('tg-stat-users').textContent = s.telegramFoydalanuvchilar;
    document.getElementById('tg-stat-daily').textContent = s.bugungiSorovlar;
  } catch (e) {
    document.getElementById('tg-stat-users').textContent = '—';
    document.getElementById('tg-stat-daily').textContent = '—';
  }
}

function runHeroSearch() {
  fq.value = heroQ.value.trim();
  loadItems();
  document.getElementById('item-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

buildFilterOptions();
loadItems();
loadStats();
[fq].forEach(el => el.addEventListener('input', debouncedLoad));
[fKategoriya, fTuman, fTur].forEach(el => el.addEventListener('change', loadItems));
if (heroSearchBtn) heroSearchBtn.addEventListener('click', runHeroSearch);
if (heroQ) heroQ.addEventListener('keydown', (e) => { if (e.key === 'Enter') runHeroSearch(); });
document.querySelectorAll('.tag-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    heroQ.value = btn.dataset.tag;
    runHeroSearch();
  });
});
