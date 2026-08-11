renderNav('');
if (!isLoggedIn()) window.location.href = 'login.html';

const user = getUser();
document.getElementById('avatar').textContent = initials(user.ism);
document.getElementById('p-ism').textContent = user.ism;
document.getElementById('p-meta').textContent = `${user.tuman || 'Tuman ko\'rsatilmagan'} · ${user.telefon || user.email || ''}`;

const tabContent = document.getElementById('tab-content');
const tabs = document.querySelectorAll('.tab-btn');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function reqStatusPill(status) {
  const labels = { kutilmoqda: 'Kutilmoqda', qabul: 'Qabul qilindi', rad: 'Rad etildi' };
  return `<span class="status-pill ${status}">${labels[status] || status}</span>`;
}
function itemStatusPill(status) {
  return `<span class="status-pill ${status}">${STATUS_LABELS[status] || status}</span>`;
}

async function loadTab(tab) {
  tabContent.innerHTML = '<p style="color:#8a9a8c;">Yuklanmoqda...</p>';
  if (tab === 'items') {
    const items = await api(`/items?user_id=${user.id}&status=mavjud`);
    const items2 = await api(`/items?user_id=${user.id}&status=band`);
    const items3 = await api(`/items?user_id=${user.id}&status=berilgan`);
    const all = [...items, ...items2, ...items3];
    tabContent.innerHTML = all.length ? all.map(i => `
      <div class="list-card">
        <img src="${firstImage(i.rasm_url) || ''}" onerror="this.style.display='none'">
        <div class="grow">
          <b><a href="item.html?id=${i.id}">${esc(i.nomi)}</a></b>
          <div style="font-size:0.8rem;color:#6C7C6E;">${i.tuman || ''} · ${timeAgo(i.yaratilgan_sana)}</div>
        </div>
        ${itemStatusPill(i.status)}
      </div>
    `).join('') : emptyBlock('📦', 'Hali e\'lon joylamagansiz', 'Buyum joylashtirish', 'add-item.html');
  }

  if (tab === 'sent') {
    const reqs = await api('/requests/sent');
    tabContent.innerHTML = reqs.length ? reqs.map(r => `
      <div class="list-card">
        <img src="${firstImage(r.rasm_url) || ''}" onerror="this.style.display='none'">
        <div class="grow">
          <b><a href="item.html?id=${r.item_id}">${esc(r.item_nomi)}</a></b>
          <div style="font-size:0.8rem;color:#6C7C6E;">${timeAgo(r.yaratilgan_sana)}</div>
        </div>
        ${reqStatusPill(r.status)}
      </div>
    `).join('') : emptyBlock('🤝', 'Hali hech qanday so\'rov yubormagansiz', 'E\'lonlarni ko\'rish', 'index.html');
  }

  if (tab === 'received') {
    const reqs = await api('/requests/received');
    tabContent.innerHTML = reqs.length ? reqs.map(r => `
      <div class="list-card">
        <img src="${firstImage(r.rasm_url) || ''}" onerror="this.style.display='none'">
        <div class="grow">
          <b><a href="item.html?id=${r.item_id}">${esc(r.item_nomi)}</a></b>
          <div style="font-size:0.8rem;color:#6C7C6E;">${esc(r.requester_ismi)} · ${timeAgo(r.yaratilgan_sana)}</div>
        </div>
        ${reqStatusPill(r.status)}
      </div>
    `).join('') : emptyBlock('📥', 'Hali sizga so\'rov kelmagan', null, null);
  }

  if (tab === 'notif') {
    const notifs = await api('/users/notifications');
    tabContent.innerHTML = notifs.length ? notifs.map(n => `
      <a href="${n.link || '#'}" class="list-card" style="text-decoration:none;${n.is_read ? 'opacity:0.6;' : ''}">
        <div class="grow">
          <div>${esc(n.matn)}</div>
          <div style="font-size:0.78rem;color:#6C7C6E;">${timeAgo(n.yaratilgan_sana)}</div>
        </div>
      </a>
    `).join('') : emptyBlock('🔔', 'Hozircha bildirishnoma yo\'q', null, null);
    api('/users/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  }
}

function emptyBlock(icon, text, btnLabel, btnHref) {
  return `<div class="empty-state">
    <div class="glyph">${icon}</div>
    <p>${text}</p>
    ${btnLabel ? `<a href="${btnHref}" class="btn btn-primary">${btnLabel}</a>` : ''}
  </div>`;
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.toggle('active', b === btn));
    loadTab(btn.dataset.tab);
  });
});

loadTab('items');
