renderNav('map');

const map = L.map('full-map').setView([41.3111, 69.2797], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const markers = {};
const listEl = document.getElementById('points-list');
const materialFilter = document.getElementById('material-filter');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function renderList(points) {
  if (!points.length) {
    listEl.innerHTML = `<p style="color:#8a9a8c;font-size:0.85rem;">Hech narsa topilmadi.</p>`;
    return;
  }
  listEl.innerHTML = points.map(p => `
    <div class="point-card" data-id="${p.id}">
      <h4>${esc(p.nomi)}</h4>
      <div class="mat">${esc(p.material_turlari)}</div>
      <div class="addr">📍 ${esc(p.manzil)} · 🕒 ${esc(p.ish_vaqti)}</div>
    </div>
  `).join('');
  [...listEl.children].forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const m = markers[id];
      if (m) { map.setView(m.getLatLng(), 15); m.openPopup(); }
    });
  });
}

async function loadPoints(material) {
  const q = material ? `?material=${encodeURIComponent(material)}` : '';
  const points = await api(`/points${q}`);
  Object.values(markers).forEach(m => map.removeLayer(m));
  Object.keys(markers).forEach(k => delete markers[k]);
  points.forEach(p => {
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 9, color: '#2F5233', fillColor: '#C6952B', fillOpacity: 0.9, weight: 2
    }).addTo(map).bindPopup(`<b>${esc(p.nomi)}</b><br>${esc(p.material_turlari)}<br>${esc(p.manzil)}<br>🕒 ${esc(p.ish_vaqti)}`);
    markers[p.id] = marker;
  });
  renderList(points);
}

let debounceTimer;
materialFilter.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadPoints(materialFilter.value.trim()), 300);
});

loadPoints();
