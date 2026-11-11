const DEFAULT_GAME_SETTINGS = { accent: 'orange', compactNav: false, reducedMotion: false, confirmNewGame: true };
function normalizeGameSettings(settings) {
  const value = { ...DEFAULT_GAME_SETTINGS, ...(settings || {}) };
  if (!['orange', 'blue', 'red'].includes(value.accent)) value.accent = 'orange';
  value.compactNav = !!value.compactNav;
  value.reducedMotion = !!value.reducedMotion;
  value.confirmNewGame = value.confirmNewGame !== false;
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
  if (typeof saveGame === 'function') saveGame();
  if (G.activeTab === 'settings') render();
}
function renderTitleScreen() {
  const hasCareer = !!G.playerTeamId;
  const team = hasCareer ? G.league.teams.find(t => t.id === G.playerTeamId) : null;
  return `<main class="start-screen">
    <div class="start-screen-backdrop" aria-hidden="true"><div class="start-rink"></div><div class="start-player start-player-away"></div><div class="start-player start-player-home"></div><div class="start-puck"></div><div class="start-crowd"></div></div>
    <div class="start-screen-shade"></div>
    <section class="start-content">
      <div class="start-kicker"><span></span> МЕНЕДЖЕРСКАЯ СИМУЛЯЦИЯ ВХЛ</div>
      <div class="start-emblem">🏒</div>
      <h1>Хоккейный<br><strong>менеджер</strong></h1>
      <p class="start-lead">Построй команду. Проживи сезон. Создай хоккейную историю.</p>
      <div class="start-actions">
        ${hasCareer ? '<button class="start-primary" data-start-action="continue">Продолжить карьеру <span>→</span></button>' : ''}
        <button class="start-primary" data-start-action="new">${hasCareer ? 'Новая карьера' : 'Начать карьеру'} <span>→</span></button>
        <button class="start-secondary" data-start-action="settings">Настройки</button>
        <div class="start-save-note">${hasCareer ? `Сейчас в игре: ${team?.name || 'Твой клуб'} · ${G.league.season}` : '30 клубов · регулярный чемпионат · плей-офф'}</div>
      </div>
      <div class="start-footer"><span>HOCKEY MANAGER</span><span>ВХЛ · КАРЬЕРА ТРЕНЕРА</span></div>
    </section>
  </main>`;
}
function bindTitleScreen() {
  document.querySelectorAll('[data-start-action]').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.startAction;
      if (action === 'continue' && G.playerTeamId) { G.screen = 'game'; G.activeTab = G.activeTab || 'overview'; }
      else if (action === 'new') {
        if (G.playerTeamId && G.settings?.confirmNewGame && !confirm('Начать новую карьеру? Текущая карьера останется в сохранении до начала новой игры.')) return;
        G.screen = 'select';
      } else if (action === 'settings') G.screen = 'settings';
      render();
    };
  });
}
function renderSettings(fromTitle = false) {
  const s = normalizeGameSettings(G.settings);
  const option = (value, label) => `<option value="${value}" ${s.accent === value ? 'selected' : ''}>${label}</option>`;
  return `<section class="settings-page">
    <div class="settings-heading"><div><div class="settings-eyebrow">ПЕРСОНАЛИЗАЦИЯ</div><h2>Настройки игры</h2><p>Настрой внешний вид и поведение интерфейса.</p></div><button class="btn secondary" onclick="${fromTitle ? "G.screen='title';render()" : "G.activeTab='overview';render()"}">← ${fromTitle ? 'На главный экран' : 'К игре'}</button></div>
    <div class="settings-grid">
      <article class="settings-card"><div class="settings-card-icon">🎨</div><h3>Цвет интерфейса</h3><p>Основной акцентный цвет меню и кнопок.</p><select class="settings-select" onchange="updateGameSetting('accent',this.value)">${option('orange','Ледовый оранжевый')}${option('blue','Холодный синий')}${option('red','Клубный красный')}</select></article>
      <article class="settings-card"><div class="settings-card-icon">🧭</div><h3>Компактное меню</h3><p>Уменьшает отступы навигации и освобождает место на экране.</p><label class="settings-toggle"><input type="checkbox" ${s.compactNav ? 'checked' : ''} onchange="updateGameSetting('compactNav',this.checked)"><span></span><b>${s.compactNav ? 'Включено' : 'Выключено'}</b></label></article>
      <article class="settings-card"><div class="settings-card-icon">✨</div><h3>Уменьшить анимацию</h3><p>Отключает декоративные переходы и движения интерфейса.</p><label class="settings-toggle"><input type="checkbox" ${s.reducedMotion ? 'checked' : ''} onchange="updateGameSetting('reducedMotion',this.checked)"><span></span><b>${s.reducedMotion ? 'Включено' : 'Выключено'}</b></label></article>
      <article class="settings-card"><div class="settings-card-icon">⚠️</div><h3>Подтверждение новой карьеры</h3><p>Защита от случайного сброса текущего прохождения.</p><label class="settings-toggle"><input type="checkbox" ${s.confirmNewGame ? 'checked' : ''} onchange="updateGameSetting('confirmNewGame',this.checked)"><span></span><b>${s.confirmNewGame ? 'Включено' : 'Выключено'}</b></label></article>
    </div>
    <div class="settings-footnote">Настройки не влияют на баланс, результаты матчей или игровые данные существующих карьер.</div>
  </section>`;
}
