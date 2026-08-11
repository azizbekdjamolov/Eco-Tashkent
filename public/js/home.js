renderNav('home');

const grid = document.getElementById('item-grid');
const catStrip = document.getElementById('cat-strip');
const fq = document.getElementById('f-q');
const fKategoriya = document.getElementById('f-kategoriya');
const fTuman = document.getElementById('f-tuman');
const fTur = document.getElementById('f-tur');

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
    if (activeKategoriya) btn.style.outline = '2px solid var(--moss)';
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

async function loadItems() {
  grid.innerHTML = '<p style="grid-column:1/-1;color:#8a9a8c;">Yuklanmoqda...</p>';
  const params = new URLSearchParams();
  if (fq.value.trim()) params.set('q', fq.value.trim());
  if (fKategoriya.value) params.set('kategoriya', fKategoriya.value);
  if (fTuman.value) params.set('tuman', fTuman.value);
  if (fTur.value) params.set('tur', fTur.value);
  try {
    const items = await api(`/items?${params.toString()}`);
    document.getElementById('stat-items').textContent = items.length;
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

async function loadHeroMap() {
  const map = L.map('hero-map', { zoomControl: false, scrollWheelZoom: false }).setView([41.3111, 69.2797], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  try {
    const points = await api('/points');
    document.getElementById('stat-points').textContent = points.length;
    points.forEach(p => {
      L.circleMarker([p.lat, p.lng], { radius: 7, color: '#2F5233', fillColor: '#C6952B', fillOpacity: 0.9, weight: 2 })
        .addTo(map)
        .bindPopup(`<b>${escapeHtml(p.nomi)}</b><br>${escapeHtml(p.material_turlari)}`);
    });
  } catch (e) { /* ignore for hero */ }
}

buildFilterOptions();
loadItems();
loadHeroMap();
[fq].forEach(el => el.addEventListener('input', debouncedLoad));
[fKategoriya, fTuman, fTur].forEach(el => el.addEventListener('change', loadItems));
