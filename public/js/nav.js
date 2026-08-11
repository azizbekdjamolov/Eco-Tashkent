function renderNav(activePage) {
  const mount = document.getElementById('nav-mount');
  if (!mount) return;
  const user = getUser();
  const links = [
    { href: 'index.html', label: 'E\'lonlar', id: 'home' },
    { href: 'map.html', label: 'Xarita', id: 'map' }
  ];
  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">${l.label}</a>`
  ).join('');

  const actionsHtml = user ? `
    <a href="add-item.html" class="btn btn-gold btn-sm">+ E'lon berish</a>
    <a href="profile.html" class="btn btn-ghost btn-sm">👤 ${user.ism.split(' ')[0]}</a>
    <button class="btn btn-outline btn-sm" id="logout-btn">Chiqish</button>
  ` : `
    <a href="login.html" class="btn btn-ghost btn-sm">Kirish</a>
    <a href="register.html" class="btn btn-primary btn-sm">Ro'yxatdan o'tish</a>
  `;

  mount.innerHTML = `
    <div class="topbar-inner">
      <a href="index.html" class="brand">
        <svg class="leaf" viewBox="0 0 32 32" fill="none"><path d="M16 3C9 3 4 9 4 17c0 6 4.5 11 12 12 7.5-1 12-6 12-12C28 9 23 3 16 3Z" fill="#2F5233"/><path d="M16 28V10M16 10c-3 3-6 3-9 2M16 15c3-2 6-2 9 0" stroke="#F6F5EE" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span>Eco Tashkent<small>Qayta hayot bering</small></span>
      </a>
      <nav class="nav-links">${linksHtml}</nav>
      <div class="nav-actions">${actionsHtml}</div>
    </div>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}
