/* Локальные векторные эмблемы клубов.
   SVG строится на лету из названия и работает офлайн; официальные изображения
   можно подключать через logo/logoLocal, не меняя разметку интерфейса. */
function clubLogoColor(name) {
  const palettes = [
    ['#17365d','#d9e7f5'], ['#7b1e2b','#f5d6d8'], ['#126b57','#e0f2e9'],
    ['#a85b16','#fff0d8'], ['#263b82','#e0e7ff'], ['#4a315f','#f1e6fa'],
    ['#263238','#eceff1'], ['#8a2635','#fce4ec'], ['#176b8a','#e0f7fa'],
    ['#6b5b1e','#fff8dc'], ['#315b37','#e8f5e9'], ['#6b3020','#fbe9e7']
  ];
  const value = String(name || '?');
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}
function clubLogoMarkup(club, size = 32, extraClass = '') {
  const name = String(club?.shortName || club?.name || '?');
  const initials = (typeof getInitials === 'function' ? getInitials(name) : name.slice(0, 2))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const [primary, accent] = clubLogoColor(name);
  const safeName = name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const px = Math.max(18, Number(size) || 32);
  return `<span class="club-logo ${extraClass}" role="img" aria-label="Эмблема ${safeName}" style="width:${px}px;height:${px}px;--club-logo-primary:${primary};--club-logo-accent:${accent}"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="club-logo-shield" d="M32 3 56 12v18c0 15-9 25-24 31C17 55 8 45 8 30V12Z"/><path class="club-logo-inner" d="M32 9 50 16v14c0 11-6 19-18 25C20 49 14 41 14 30V16Z"/><path class="club-logo-stripe" d="m13 39 38-18v8L17 47Z"/><text x="32" y="34" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg></span>`;
}
function clubLogoWithFallback(club, size = 32, extraClass = '') {
  const mark = clubLogoMarkup(club, size, extraClass);
  if (!club?.logo) return mark;
  const px = Math.max(18, Number(size) || 32);
  return `<img src="${club.logo}" class="club-logo-image ${extraClass}" style="width:${px}px;height:${px}px" alt="Эмблема ${String(club.name || '').replace(/"/g, '&quot;')}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">${mark}`;
}
