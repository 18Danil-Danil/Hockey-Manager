const DEFAULT_GAME_SETTINGS = { accent: 'orange', compactNav: false, reducedMotion: false, confirmNewGame: true };
function normalizeGameSettings(settings) {
  const value = { ...DEFAULT_GAME_SETTINGS, ...(settings || {}) };
  if (!['orange', 'blue', 'red'].includes(value.accent)) value.accent = 'orange';
  value.compactNav = !!value.compactNav; value.reducedMotion = !!value.reducedMotion; value.confirmNewGame = value.confirmNewGame !== false;
  return value;
}
function applyGameSettings() {
  G.settings = normalizeGameSettings(G.settings);
  document.body.dataset.accent = G.settings.accent;
  document.body.classList.toggle('compact-navigation', G.settings.compactNav);
  document.body.classList.toggle('reduce-motion', G.settings.reducedMotion);
}
function updateGameSetting(key, value) {
  G.settings = normalizeGameSettings({ ...G.settings, [key]: value });
  applyGameSettings();
  if (typeof saveGame === 'function') saveGame({ immediate: true });
  if (G.screen === 'settings' || G.activeTab === 'settings') render();
}
function renderTitleScreen() {
  const hasCareer = !!G.playerTeamId;
  const team = hasCareer ? G.league.teams.find(t => t.id === G.playerTeamId) : null;
  const aboutOpen = !!G.titleAboutOpen;
  return `<main class="start-screen start-screen-art" aria-label="Главное меню Hockey Manager">
    <div class="start-screen-artwork" role="img" aria-label="Хоккейный матч: нападающий против вратаря"></div>
    <div class="start-screen-vignette" aria-hidden="true"></div>
    <header class="start-screen-brand">
      <div class="start-screen-brand-kicker">ХОККЕЙНЫЙ МЕНЕДЖМЕНТ</div>
      <h1>HOCKEY <span>MANAGER</span></h1>
      <div class="start-screen-brand-line">СТРОЙ КОМАНДУ. ВЕДИ К ПОБЕДЕ.</div>
    </header>
    <nav class="start-screen-menu" aria-label="Главное меню">
      <button class="start-menu-button start-menu-primary" data-start-action="new">
        <span class="start-menu-icon" aria-hidden="true">▶</span>
        <span class="start-menu-label">Новая карьера</span>
        <span class="start-menu-arrow" aria-hidden="true">↗</span>
      </button>
      <button class="start-menu-button" data-start-action="continue" ${hasCareer ? '' : 'disabled'}>
        <span class="start-menu-icon" aria-hidden="true">↻</span>
        <span class="start-menu-label">Продолжить</span>
        <span class="start-menu-arrow" aria-hidden="true">↗</span>
      </button>
      <button class="start-menu-button" data-start-action="settings">
        <span class="start-menu-icon" aria-hidden="true">⚙</span>
        <span class="start-menu-label">Настройки</span>
        <span class="start-menu-arrow" aria-hidden="true">↗</span>
      </button>
      <button class="start-menu-button" data-start-action="about">
        <span class="start-menu-icon" aria-hidden="true">ⓘ</span>
        <span class="start-menu-label">Об игре</span>
        <span class="start-menu-arrow" aria-hidden="true">↗</span>
      </button>
      <button class="start-menu-button start-menu-exit" data-start-action="exit">
        <span class="start-menu-icon" aria-hidden="true">⏻</span>
        <span class="start-menu-label">Выход</span>
        <span class="start-menu-arrow" aria-hidden="true">↗</span>
      </button>
    </nav>
    <div class="start-screen-status">${hasCareer ? `АКТИВНАЯ КАРЬЕРА · ${team?.name || 'ВАША КОМАНДА'} · ${G.league.season}` : '30 КЛУБОВ · РЕГУЛЯРНЫЙ ЧЕМПИОНАТ · ПЛЕЙ-ОФФ'}</div>
    ${aboutOpen ? `<div class="start-about-backdrop" data-start-action="close-about"><section class="start-about-card" role="dialog" aria-modal="true" aria-labelledby="start-about-title"><button class="start-about-close" data-start-action="close-about" aria-label="Закрыть">×</button><div class="start-about-eyebrow">ХОККЕЙНЫЙ МЕНЕДЖМЕНТ</div><h2 id="start-about-title">Hockey Manager</h2><p>Стань руководителем хоккейного клуба: управляй составом, развивай команду, проходи регулярный чемпионат и борись за победу в плей-офф.</p><div class="start-about-meta">ВХЛ · Одиночная карьера · Версия 0.1.0</div><div class="start-about-credit"><b>ИСТОЧНИК ИСТОРИЧЕСКОЙ СТАТИСТИКИ</b><p>The information used herein was obtained free of charge from and is copyrighted by the Hockey Databank project. For more information about the Hockey Databank project please visit http://sports.groups.yahoo.com/group/hockey-databank</p></div></section></div>` : ''}
  </main>`;
}
function bindTitleScreen() {
  document.querySelectorAll('[data-start-action]').forEach(button => {
    button.onclick = event => {
      const action = button.dataset.startAction;
      if (action === 'continue' && G.playerTeamId) {
        G.screen = 'game';
        G.activeTab = G.activeTab || 'overview';
      } else if (action === 'new') {
        if (G.playerTeamId && G.settings?.confirmNewGame && !confirm('Начать новую карьеру?')) return;
        newGame();
        return;
      } else if (action === 'settings') {
        G.titleAboutOpen = false;
        G.screen = 'settings';
      } else if (action === 'about') {
        G.titleAboutOpen = true;
      } else if (action === 'close-about') {
        if (event.target.closest('.start-about-card') && !event.target.closest('.start-about-close')) return;
        G.titleAboutOpen = false;
      } else if (action === 'exit') {
        if (confirm('Закрыть Hockey Manager?')) {
          window.close();
          setTimeout(() => {
            if (!document.hidden) showToast('Чтобы выйти из игры, закройте вкладку браузера.');
          }, 100);
        }
        return;
      }
      render();
    };
  });
}
function renderSettings(fromTitle = false) {
  const s = normalizeGameSettings(G.settings);
  const option = (value,label) => `<option value="${value}" ${s.accent===value?'selected':''}>${label}</option>`;
  return `<section class="settings-page"><div class="settings-heading"><div><div class="settings-eyebrow">ПЕРСОНАЛИЗАЦИЯ</div><h2>Настройки игры</h2><p>Настрой внешний вид и поведение интерфейса.</p></div><button class="btn secondary" onclick="${fromTitle?"G.screen='title';render()":"G.activeTab='overview';render()"}">← ${fromTitle?'На главный экран':'К игре'}</button></div>
    <div class="settings-grid">
      <article class="settings-card"><div class="settings-card-icon">🎨</div><h3>Цвет интерфейса</h3><p>Основной акцентный цвет меню и кнопок.</p><select class="settings-select" onchange="updateGameSetting('accent',this.value)">${option('orange','Ледовый оранжевый')}${option('blue','Холодный синий')}${option('red','Клубный красный')}</select></article>
      <article class="settings-card"><div class="settings-card-icon">🧭</div><h3>Компактное меню</h3><p>Уменьшает отступы навигации и освобождает место на экране.</p><label class="settings-toggle"><input type="checkbox" ${s.compactNav?'checked':''} onchange="updateGameSetting('compactNav',this.checked)"><span></span><b>${s.compactNav?'Включено':'Выключено'}</b></label></article>
      <article class="settings-card"><div class="settings-card-icon">✨</div><h3>Уменьшить анимацию</h3><p>Отключает декоративные переходы и движения интерфейса.</p><label class="settings-toggle"><input type="checkbox" ${s.reducedMotion?'checked':''} onchange="updateGameSetting('reducedMotion',this.checked)"><span></span><b>${s.reducedMotion?'Включено':'Выключено'}</b></label></article>
      <article class="settings-card"><div class="settings-card-icon">⚠️</div><h3>Подтверждение новой карьеры</h3><p>Защита от случайного сброса текущего прохождения.</p><label class="settings-toggle"><input type="checkbox" ${s.confirmNewGame?'checked':''} onchange="updateGameSetting('confirmNewGame',this.checked)"><span></span><b>${s.confirmNewGame?'Включено':'Выключено'}</b></label></article>
    </div>${typeof renderVhlImportSettings === 'function' ? renderVhlImportSettings() : ''}<div class="settings-footnote">Настройки не влияют на баланс, результаты матчей или игровые данные существующих карьер.</div></section>`;
}
