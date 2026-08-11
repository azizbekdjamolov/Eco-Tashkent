renderNav('');

const content = document.getElementById('content');
const params = new URLSearchParams(window.location.search);
const itemId = params.get('id');
const preselectRequest = params.get('request');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function statusPill(status) {
  return `<span class="status-pill ${status}">${STATUS_LABELS[status] || status}</span>`;
}
function reqStatusPill(status) {
  const labels = { kutilmoqda: 'Kutilmoqda', qabul: 'Qabul qilindi', rad: 'Rad etildi' };
  return `<span class="status-pill ${status}">${labels[status] || status}</span>`;
}

async function main() {
  if (!itemId) { content.innerHTML = '<p>E\'lon ID topilmadi.</p>'; return; }
  let item;
  try {
    item = await api(`/items/${itemId}`);
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="glyph">🙈</div><h3>E'lon topilmadi</h3><p>${e.message}</p></div>`;
    return;
  }

  const user = getUser();
  const isOwner = user && user.id === item.user_id;
  const images = item.rasm_url ? item.rasm_url.split(',').map(s => s.trim()).filter(Boolean) : [];
  const catInfo = KATEGORIYALAR.find(k => k.id === item.kategoriya);

  content.innerHTML = `
    <div class="item-detail-grid">
      <div>
        <div class="detail-gallery">
          <img id="main-img" src="${images[0] || ''}" style="${images.length ? '' : 'display:none;'}" alt="${esc(item.nomi)}">
          ${!images.length ? `<div style="height:380px;display:flex;align-items:center;justify-content:center;font-size:4rem;background:var(--paper-dim);">${catInfo ? catInfo.icon : '📦'}</div>` : ''}
          ${images.length > 1 ? `<div class="thumb-row">${images.map((img, i) => `<img src="${img}" data-i="${i}" class="${i === 0 ? 'active' : ''}">`).join('')}</div>` : ''}
        </div>
        <div style="margin-top:24px;">
          <h3>Tavsif</h3>
          <p>${esc(item.tavsif) || 'Tavsif kiritilmagan.'}</p>
        </div>
      </div>
      <div class="detail-side">
        <span class="eyebrow">${catInfo ? catInfo.label : item.kategoriya}</span>
        <h2 style="margin-top:6px;">${esc(item.nomi)}</h2>
        <div class="tag-row">
          <span class="tag">${TUR_LABELS[item.tur] || item.tur}</span>
          <span class="tag">${item.holat}</span>
          <span class="tag">📍 ${item.tuman || 'Noma\'lum'}</span>
          ${statusPill(item.status)}
        </div>
        <div class="owner-box">
          <div class="owner-avatar">${initials(item.egasi_ismi)}</div>
          <div>
            <div style="font-weight:700;">${esc(item.egasi_ismi)} ${item.ngo_verified ? '✅' : ''}</div>
            <div style="font-size:0.78rem;color:#6C7C6E;">Reyting: ${Number(item.egasi_reytingi || 5).toFixed(1)} / 5</div>
          </div>
        </div>
        <div id="action-zone"></div>
      </div>
    </div>
  `;

  const thumbRow = content.querySelector('.thumb-row');
  if (thumbRow) {
    thumbRow.addEventListener('click', (e) => {
      const t = e.target.closest('img');
      if (!t) return;
      document.getElementById('main-img').src = t.src;
      [...thumbRow.children].forEach(c => c.classList.toggle('active', c === t));
    });
  }

  const actionZone = document.getElementById('action-zone');

  if (!user) {
    actionZone.innerHTML = `<a href="login.html" class="btn btn-primary btn-block">Qiziqaman — kirish kerak</a>`;
    return;
  }

  if (isOwner) {
    await renderOwnerRequests(actionZone, item);
  } else {
    await renderRequesterView(actionZone, item);
  }
}

async function renderRequesterView(zone, item) {
  const sent = await api('/requests/sent');
  const myReq = sent.find(r => r.item_id == item.id);

  if (!myReq) {
    zone.innerHTML = `<button class="btn btn-primary btn-block" id="interest-btn">🌱 Qiziqaman</button>`;
    document.getElementById('interest-btn').addEventListener('click', async (btnEvt) => {
      const btn = btnEvt.target;
      btn.disabled = true; btn.textContent = 'Yuborilmoqda...';
      try {
        await api('/requests', { method: 'POST', body: { item_id: item.id } });
        await main();
      } catch (e) {
        alert(e.message);
        btn.disabled = false; btn.textContent = '🌱 Qiziqaman';
      }
    });
    return;
  }

  zone.innerHTML = `
    <div style="margin-bottom:14px;">Sizning so'rovingiz: ${reqStatusPill(myReq.status)}</div>
    <h4 style="margin-bottom:8px;">Xabar almashish</h4>
    <div class="chat-box" id="chat-box"></div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Xabar yozing...">
      <button class="btn btn-primary" id="chat-send">Yuborish</button>
    </div>
  `;
  await loadChat(myReq.id);
  document.getElementById('chat-send').addEventListener('click', () => sendChat(myReq.id));
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat(myReq.id);
  });
}

async function renderOwnerRequests(zone, item) {
  const received = await api('/requests/received');
  const forItem = received.filter(r => r.item_id == item.id);

  if (!forItem.length) {
    zone.innerHTML = `<p style="color:#6C7C6E;font-size:0.9rem;">Hozircha bu e'longa so'rov kelmagan.</p>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" data-s="band">Band deb belgilash</button>
        <button class="btn btn-outline btn-sm" data-s="berilgan">Berildi deb belgilash</button>
      </div>`;
    wireStatusButtons(zone, item);
    return;
  }

  zone.innerHTML = `<h4 style="margin-bottom:10px;">Kelgan so'rovlar (${forItem.length})</h4>` +
    forItem.map(r => `
      <div class="list-card" style="align-items:flex-start;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <div><b>${esc(r.requester_ismi)}</b> ${r.requester_telefon ? `· ${esc(r.requester_telefon)}` : ''}</div>
          ${reqStatusPill(r.status)}
        </div>
        ${r.status === 'kutilmoqda' ? `
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary btn-sm" data-accept="${r.id}">Qabul qilish</button>
          <button class="btn btn-danger btn-sm" data-reject="${r.id}">Rad etish</button>
        </div>` : `
        <button class="btn btn-ghost btn-sm" data-chat="${r.id}" style="margin-top:8px;">💬 Xabar yozish</button>
        `}
        <div class="chat-wrap" id="chat-wrap-${r.id}" style="display:none;width:100%;margin-top:10px;">
          <div class="chat-box" id="chat-box-${r.id}"></div>
          <div class="chat-input-row">
            <input type="text" id="chat-input-${r.id}" placeholder="Xabar yozing...">
            <button class="btn btn-primary" data-send="${r.id}">Yuborish</button>
          </div>
        </div>
      </div>
    `).join('');

  zone.addEventListener('click', async (e) => {
    const acc = e.target.closest('[data-accept]');
    const rej = e.target.closest('[data-reject]');
    const chatBtn = e.target.closest('[data-chat]');
    const sendBtn = e.target.closest('[data-send]');
    if (acc) {
      await api(`/requests/${acc.dataset.accept}`, { method: 'PATCH', body: { status: 'qabul' } });
      await main();
    } else if (rej) {
      await api(`/requests/${rej.dataset.reject}`, { method: 'PATCH', body: { status: 'rad' } });
      await main();
    } else if (chatBtn) {
      const wrap = document.getElementById(`chat-wrap-${chatBtn.dataset.chat}`);
      wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      if (wrap.style.display === 'block') await loadChat(chatBtn.dataset.chat);
    } else if (sendBtn) {
      await sendChat(sendBtn.dataset.send);
    }
  });

  if (preselectRequest) {
    const wrap = document.getElementById(`chat-wrap-${preselectRequest}`);
    if (wrap) { wrap.style.display = 'block'; await loadChat(preselectRequest); }
  }
}

function wireStatusButtons(zone, item) {
  zone.querySelectorAll('[data-s]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/items/${item.id}/status`, { method: 'PATCH', body: { status: btn.dataset.s } });
      await main();
    });
  });
}

async function loadChat(requestId) {
  const boxId = document.getElementById(`chat-box-${requestId}`) ? `chat-box-${requestId}` : 'chat-box';
  const box = document.getElementById(boxId);
  if (!box) return;
  const msgs = await api(`/messages/${requestId}`);
  const user = getUser();
  box.innerHTML = msgs.length ? msgs.map(m => `
    <div class="msg ${m.sender_id === user.id ? 'mine' : 'theirs'}">${esc(m.matn)}</div>
  `).join('') : `<p style="color:#8a9a8c;font-size:0.85rem;">Hali xabar yo'q. Birinchi bo'lib yozing!</p>`;
  box.scrollTop = box.scrollHeight;
}

async function sendChat(requestId) {
  const inputId = document.getElementById(`chat-input-${requestId}`) ? `chat-input-${requestId}` : 'chat-input';
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await api(`/messages/${requestId}`, { method: 'POST', body: { matn: text } });
  await loadChat(requestId);
}

main();
