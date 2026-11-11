/* ============================================================
   ТАКТИЧЕСКИЕ СЛАЙДЕРЫ (общее определение)
   ============================================================ */
const SLIDER_DEFS = [
  { key: 'forecheck', label: 'Форчек', left: 'Пассивный', right: 'Агрессивный' },
  { key: 'pressure', label: 'Давление', left: 'Ловушка', right: 'Прессинг' },
  { key: 'style', label: 'Стиль атаки', left: 'Позиционный', right: 'Вертикальный' },
  { key: 'physical', label: 'Жёсткость', left: 'Мягкая', right: 'Жёсткая' },
  { key: 'risk', label: 'Риск', left: 'Спокойно', right: 'Ва-банк' },
];

function liveChangeTactic(key, val) {
  if (!G.liveMatch) return;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  team.tactics[key] = Number(val);
  const inputs = document.querySelectorAll('.live-tactic-row input[type=range]');
  for (const input of inputs) {
    if (input.getAttribute('oninput')?.includes(`'${key}'`)) {
      const valEl = input.parentElement.querySelector('.lt-val');
      if (valEl) valEl.textContent = val;
      break;
    }
  }
}

function renderLiveMatchScreen() {
  const lm = G.liveMatch;
  if (!lm) return '';
  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);

  const speedBtns = [1, 2, 4].map(s => `<button class="btn small ${lm.speed === s ? 'active' : ''}" onclick="setLiveSpeed(${s})">${s}×</button>`).join('');
  const pauseBtn = lm.paused && !lm.isBreak && !lm.isFinished
    ? `<button class="btn small" onclick="toggleLivePause()">▶ Продолжить</button>`
    : (!lm.isFinished && !lm.isBreak) ? `<button class="btn small secondary" onclick="toggleLivePause()">⏸ Пауза</button>` : '';

  let controlBlock = '';
  if (lm.isFinished) {
    controlBlock = `<button class="btn" onclick="closeLiveMatchModal()">✅ Готово — к таблице</button>`;
  } else if (lm.isBreak) {
    controlBlock = `<button class="btn" onclick="liveResumeFromBreak()">▶ Продолжить период</button>`;
  } else {
    controlBlock = `
      ${pauseBtn}
      ${speedBtns}
      <button class="btn small secondary" onclick="exitLiveMatchEarly()">⏭ До конца матча</button>
    `;
  }

  const canEditTactics = myTeam && (lm.isBreak || lm.paused) && !lm.isFinished;
  const tacticSliders = canEditTactics ? `
    <div class="live-break-overlay">
      <div class="live-break-card">
        <h2>${lm.isBreak ? '⏸ Перерыв — корректировка тактики' : '⏸ Пауза — корректировка тактики'}</h2>
        <div class="subtitle">Изменения влияют на xG следующих периодов</div>
        <h3>Тактика</h3>
        ${SLIDER_DEFS.map(s => `
          <div class="live-tactic-row">
            <label>${s.label}</label>
            <input type="range" min="0" max="100" value="${myTeam.tactics[s.key]}" oninput="liveChangeTactic('${s.key}', this.value)">
            <span class="lt-val">${myTeam.tactics[s.key]}</span>
          </div>
        `).join('')}
        <div style="margin-top:16px;text-align:right">
          ${lm.isBreak
            ? `<button class="btn" onclick="liveResumeFromBreak()">▶ Продолжить период</button>`
            : `<button class="btn" onclick="toggleLivePause()">▶ Продолжить</button>`}
        </div>
      </div>
    </div>
  ` : '';

  const endedHint = lm.isFinished
    ? `<div class="regular-champion" style="margin-top:8px">Матч завершён: ${home.shortName || home.name} ${lm.hg} : ${lm.ag} ${away.shortName || away.name}${lm.shootout ? ' (буллиты)' : lm.ot ? ' (ОТ)' : ''}</div>`
    : '';

  const logoHome = home.logo ? `<img src="${home.logo}" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:6px">` : '';
  const logoAway = away.logo ? `<img src="${away.logo}" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:6px">` : '';

  return `<div class="live-screen">
    <div class="live-topbar">
      <button class="btn small secondary" onclick="if(confirm('Выйти из матча? Остаток будет досимитирован.')) exitLiveMatchEarly()">✕ Выйти</button>
      <div class="live-scoreboard">
        <div class="live-teams">
          <span class="home-name">${logoHome}${home.shortName || home.name}</span>
          <span class="live-score-box"><span id="live-score-home">${lm.hg}</span> : <span id="live-score-away">${lm.ag}</span></span>
          <span class="away-name">${logoAway}${away.shortName || away.name}</span>
        </div>
        <div class="live-period-info" id="live-period-info">${lm.period === 5 ? 'Буллитная серия' : lm.period === 4 ? 'Овертайм' : 'Период ' + lm.period}</div>
        <div class="live-clock" id="live-clock">${liveFmtTime(Math.max(0, Math.ceil(lm.timeLeft)))}</div>
      </div>
      <div style="min-width:120px"></div>
    </div>

    <div id="live-pp-banner" class="live-pp-banner" style="display:none"></div>

    <div class="live-canvas-wrap">
      <canvas id="live-canvas" class="live-canvas"></canvas>
    </div>

    <section class="live-match-stats" aria-label="Статистика матча">
      <div class="live-stats-row live-stats-heading">
        <span>Статистика</span><strong>${home.shortName || home.name}</strong><strong>${away.shortName || away.name}</strong>
      </div>
      <div class="live-stats-row">
        <span>Броски в створ</span><strong id="live-stat-home-shots">${lm.shots?.home || 0}</strong><strong id="live-stat-away-shots">${lm.shots?.away || 0}</strong>
      </div>
      <div class="live-stats-row">
        <span>Все попытки</span><strong id="live-stat-home-attempts">${lm.shotAttempts?.home || 0}</strong><strong id="live-stat-away-attempts">${lm.shotAttempts?.away || 0}</strong>
      </div>
      <div class="live-stats-row">
        <span>Активные удаления</span><strong id="live-stat-home-penalties">${(lm.penalties?.home || []).filter(p => p.endsAt > lm.totalSecPlayed).length}</strong><strong id="live-stat-away-penalties">${(lm.penalties?.away || []).filter(p => p.endsAt > lm.totalSecPlayed).length}</strong>
      </div>
    </section>

    <div class="live-controls">
      ${controlBlock}
    </div>

    <div class="live-feed-heading">
      <h2>Ход матча</h2>
      <div class="live-feed-legend"><span><i class="live-legend-dot is-us"></i> Наши</span><span><i class="live-legend-dot is-opponent"></i> Соперник</span></div>
    </div>
    <div class="live-feed" id="live-feed"></div>

    ${endedHint}
    ${tacticSliders}
  </div>`;
}

function setLiveSpeed(s) {
  if (!G.liveMatch) return;
  G.liveMatch.speed = s;
  render();
}
function toggleLivePause() {
  if (!G.liveMatch) return;
  G.liveMatch.paused = !G.liveMatch.paused;
  // ⚙️ ФИКС #14: если встали на паузу — гасим интервал, чтобы не жечь CPU
  if (G.liveMatch.paused && G.liveMatch.intervalId) {
    clearInterval(G.liveMatch.intervalId);
    G.liveMatch.intervalId = null;
  }
  // На возобновление — перезапускаем интервал, если матч не завершён и не перерыв
  if (!G.liveMatch.paused && !G.liveMatch.isFinished && !G.liveMatch.isBreak && !G.liveMatch.intervalId) {
    G.liveMatch.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  }
  render();
}
