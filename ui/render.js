/* ============================================================
   UI — ВЫБОР КЛУБА / ХЕДЕР / ТАБЫ
   ============================================================ */
function getInitials(name) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(); }
function getTeamRatings(team) { return team.ratings || { att: 70, def: 70, gk: 70, st: 70 }; }
function logoHeader(team) {
  return clubLogoWithFallback(team, 32, 'team-logo-header');
}
function logoTiny(team) {
  return clubLogoWithFallback(team, 20, 'team-logo-tiny');
}

function renderTeamSelect() {
  const selDiff = G.selectedDifficulty || 'normal';
  const diffCards = Object.entries(DIFFICULTIES).map(([key, d]) => `
    <div class="difficulty-card ${selDiff === key ? 'selected' : ''}" onclick="G.selectedDifficulty='${key}'; render();">
      <div class="d-title">${d.label}</div>
      <div class="d-desc">${d.desc}</div>
    </div>
  `).join('');
  const teams = G.league.teams.slice().sort((a, b) => b.talent - a.talent);
  const cards = teams.map(t => {
    const trendDef = { up: '↗', down: '↘', stable: '→', newcomer: '🆕' };
    const logoImg = clubLogoWithFallback(t, 36, 'team-logo-card');
    return `<div class="team-card" data-team-id="${t.id}">
      <div class="t-name">${logoImg}${t.name}</div>
      <div class="t-city">${t.city} · ${t.region} ${trendDef[t.trend] || ''}</div>
      <div class="t-budget">
        Talent: <b style="color:#4ade80">${t.talent.toFixed(1)}</b> · Prestige: <b style="color:#fbbf24">${t.prestige}</b><br>
        Бюджет: ${t.finance.seasonBudget} млн ₽<br>
        Арена: ${t.finance.arenaCapacity.toLocaleString()}
      </div>
    </div>`;
  }).join('');
  return `<div class="topbar"><div><h1>🏒 ВХЛ — Выбор клуба</h1><div class="subtitle">Сначала выбери сложность, потом клуб</div></div></div>
    <h2>Уровень сложности</h2>
    <div class="difficulty-grid">${diffCards}</div>
    <label class="no-fire-checkbox"><input type="checkbox" ${G.noFireMode ? 'checked' : ''} onchange="G.noFireMode=this.checked; render();"> 🚫 Режим «без увольнения» (совет не может уволить)</label>
    <h2>Клуб</h2>
    <div class="team-grid">${cards}</div>`;
}
function bindTeamSelect() {
  document.querySelectorAll('.team-card').forEach(el => {
    el.onclick = () => {
      G.difficulty = DIFFICULTIES[G.selectedDifficulty || 'normal'];
      G.career = G.career || {};
      G.career.noFireMode = G.noFireMode || false;
      G.career.reputation = G.difficulty.startReputation;
      G.career.history = G.career.history || [];
      G.playerTeamId = Number(el.dataset.teamId);
      applyDifficultySalaryCaps(G.league.teams, G.playerTeamId, G.difficulty);
      G.injuryPrompt = null;
      G.skipInjuryPrompt = false;
      G.openingCupModal = null;
      G.tradeTargetTeamId = null;
      G.activeTab = 'overview';
      G.screen = 'game';
      initAISponsors();
      render();
    };
  });
}

function renderSaveTools() {
  return '<button class="btn secondary" onclick="manualSaveGame()">💾 Сохранить</button> ' +
    '<button class="btn secondary" onclick="exportCareerFile()">📥 Экспорт</button> ' +
    '<button class="btn secondary" onclick="document.getElementById(\'career-import-file\').click()">📤 Импорт</button> ' +
    '<input id="career-import-file" type="file" accept=".json,application/json" style="display:none" onchange="importCareerFile(this.files[0]); this.value=\'\';">';
}

function renderHeader() {
  if (!G.playerTeamId) {
    const rep = G.career?.reputation ?? 50;
    return `<div class="topbar"><div><h1>💼 Свободный агент</h1><div class="subtitle">Репутация: <b>${Math.round(rep)}/100</b>${G.career?.lastTeamName ? ` · Последний клуб: ${G.career.lastTeamName}` : ''}</div></div><div><button class="btn secondary" onclick="G.activeTab='settings';render()">⚙ Настройки</button> ${renderSaveTools()} <button class="btn danger" onclick="if(!G.settings?.confirmNewGame||confirm('Начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
  }
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const playerSal = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const staffSal = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  const r = team.record; const myRank = standingsSorted().findIndex(t => t.id === G.playerTeamId) + 1;
  const bal = team.finance.balance;
  const injured = team.roster.filter(p => p.injury && p.injury.gamesLeft > 0).length;
  const offers = (G.league.aiTradeOffers || []).length;
  const unread = unreadInboxCount();
  const rep = G.career?.reputation ?? 50;
  const diffLabel = G.difficulty?.label || '🟡 Средний';
  const streakTxt = team.streak && team.streak.count >= 2 ? ` · ${team.streak.type === 'w' ? '🔥' : '❄️'} ${team.streak.count}` : '';
  const noFireTxt = G.career?.noFireMode ? ' · 🚫' : '';
  return `<div class="topbar"><div><h1 style="display:flex;align-items:center">${logoHeader(team)}${team.name}</h1><div class="subtitle">Сезон ${G.league.season} · ${diffLabel}${noFireTxt} · ${r.w}-${r.l}-${r.otl} · ${r.pts} очк. · #${myRank} · ЗП: ${Math.round(playerSal + staffSal)}/${team.finance.salaryCap} · Баланс: <b style="color:${bal >= 0 ? '#4ade80' : '#ef4444'}">${Math.round(bal)} млн ₽</b> · Реп: ${Math.round(rep)}/100${injured ? ` · 🚑 ${injured}` : ''}${offers ? ` · 💼 ${offers}` : ''}${unread ? ` · ✉ ${unread}` : ''}${streakTxt}</div></div><div><button class="btn secondary" onclick="G.activeTab='settings';render()">⚙ Настройки</button> ${renderSaveTools()} <button class="btn secondary" onclick="G.screen='title';render()">⌂ Старт</button> <button class="btn secondary" onclick="if(!G.settings?.confirmNewGame||confirm('Сбросить и начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
}
function renderTabs() {
  const unread = unreadInboxCount();
  const groups = [
    {key:'club',label:'Клуб',items:[['overview','Обзор'],['roster','Состав'],['lines','Звенья'],['tactics','Тактика'],['lockerRoom','Раздевалка'],['training','Тренировки'],['staff','Штаб'],['infrastructure','Инфраструктура']]},
    {key:'league',label:'Лига',items:[['standings','Таблица'],['games','Матчи'],['calendar','Календарь'],['stats','Статистика'],['news','Новости']]},
    {key:'transfers',label:'Трансферы',items:[['market','Рынок'],['trades','Обмены'],['loans','Аренды'],['waivers','Драфт отказов']]},
    {key:'development',label:'Развитие',items:[['academy','Академия'],['youth','Молодёжные лиги']]},
    {key:'management',label:'Управление',items:[['finance','Финансы'],['career','Карьера'],['playoffs','Плей-офф'],['history','История'],['inbox',`📬 Почта${unread?' · '+unread:''}`]]}
  ];
  const activeGroup=groups.find(g=>g.items.some(([key])=>key===G.activeTab))?.key||'club';
  const openGroup=G.navGroupOpen||activeGroup;
  return `<nav id="tabs" class="navigation">${groups.map(g=>`<section class="nav-group ${openGroup===g.key?'is-open':''}">
    <button class="nav-group-trigger" type="button" data-nav-group="${g.key}" aria-expanded="${openGroup===g.key}"><span>${g.label}</span><small>${g.items.length}</small><b>${openGroup===g.key?'−':'+'}</b></button>
    <div class="nav-group-items">${g.items.map(([key,label])=>`<button class="tab ${G.activeTab===key?'active':''}" data-tab="${key}" data-nav-group="${g.key}">${label}</button>`).join('')}</div>
  </section>`).join('')}</nav>`;
}

/* ============================================================
   ТАБЛИЦА / МАТЧИ / КАЛЕНДАРЬ
   ============================================================ */
function renderStandings() {
  const sorted = standingsSortedByUI(); const done = G.league.currentRound >= G.league.schedule.length;
  const progress = (G.league.currentRound / G.league.schedule.length) * 100;
  let controls;
  if (done) {
    const p = G.league.playoffs;
    const regularChampion = standingsSorted()[0];
    const rc = `<div class="regular-champion">🥇 Кубок Чемпиона России: ${regularChampion.name}</div>`;
    if (p && p.championId) { const champ = G.league.teams.find(t => t.id === p.championId); controls = rc + `<div class="champion">🏆 Кубок Петрова: ${champ.name}</div><button class="btn" onclick="endSeason()">▶ Новый сезон</button>`; }
    else controls = rc + `<div class="subtitle">Регулярка завершена.</div>`;
  } else {
    const myGame = isMyGameInRound();
    const liveBtn = myGame
      ? `<button class="btn" onclick="startMyLiveMatch()">▶ Live-матч</button>`
      : '';
    controls = `<div class="progress-bar"><div style="width:${progress}%"></div></div><div class="subtitle">Тур ${G.league.currentRound + 1} из ${G.league.schedule.length}${myGame ? ' · твой матч в этом туре' : ''}</div>${liveBtn}<button class="btn secondary" onclick="simRound()">Симулировать тур</button><button class="btn secondary" onclick="simSeason()">Симулировать сезон</button>`;
  }
  const sh = (key, label) => {
    const isActive = G.standingsSort.key === key;
    const arrow = isActive ? (G.standingsSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th onclick="event.stopPropagation(); G.standingsSort={key:'${key}',dir:G.standingsSort.key==='${key}'&&G.standingsSort.dir==='desc'?'asc':'desc'};render();" style="cursor:pointer;${isActive ? 'color:#ff6b35' : ''}">${label}${arrow}</th>`;
  };
  const rows = sorted.map((t, i) => {
    const isMe = t.id === G.playerTeamId; const gp = t.record.w + t.record.l + t.record.otl; const diff = t.record.gf - t.record.ga;
    return `<tr style="cursor:pointer;${isMe ? 'background:rgba(255,107,53,0.1)' : ''}" onclick="G.viewTeamId=${t.id};render();"><td style="color:#7a8299">${i + 1}</td><td style="font-weight:${isMe ? 700 : 400};color:${isMe ? '#ff6b35' : 'inherit'}">${logoTiny(t)}${t.name}</td><td>${gp}</td><td>${t.record.w}</td><td>${t.record.l}</td><td>${t.record.otl}</td><td style="font-weight:700">${t.record.pts}</td><td>${t.record.gf}</td><td>${t.record.ga}</td><td style="color:${diff > 0 ? '#4ade80' : diff < 0 ? '#ef4444' : '#7a8299'}">${diff > 0 ? '+' : ''}${diff}</td></tr>`;
  }).join('');
  return `${controls}<h2>Турнирная таблица</h2><table><thead><tr>${sh('gp','#')}${sh('pts','Команда')}${sh('gp','И')}${sh('w','В')}${sh('l','П')}${sh('otl','ПО')}${sh('pts','О')}${sh('gf','ЗШ')}${sh('ga','ЗП')}${sh('diff','Р')}</tr></thead><tbody>${rows}</tbody></table>`;
}


function closeRoundResults() {
  G.lastRoundResults = null;
  G.lastRoundNumber = null;
  render();
}
function renderRoundResultsModal() {
  if (!G.lastRoundResults || !G.lastRoundResults.length) return '';
  const rows = G.lastRoundResults.map(res => {
    const home = G.league.teams.find(t => t.id === res.homeId);
    const away = G.league.teams.find(t => t.id === res.awayId);
    if (!home || !away) return '';
    const isMe = res.homeId === G.playerTeamId || res.awayId === G.playerTeamId;
    const homeWon = res.hg > res.ag;
    const scoreColor = homeWon ? '#4ade80' : '#ef4444';
    return `<div class="game-row ${isMe ? 'player-game' : ''}" style="padding:10px 8px;margin:4px 0">
      <span class="away" style="flex:1;text-align:right">${away.name}</span>
      <span class="score" style="min-width:76px;text-align:center;font-weight:800;color:${scoreColor}">${res.ag} : ${res.hg}${res.shootout ? '<span class="ot-tag">Б</span>' : res.ot ? '<span class="ot-tag">ОТ</span>' : ''}</span>
      <span style="flex:1">${home.name}</span>
      ${isMe ? '<span class="tag" style="margin-left:6px">Ваш клуб</span>' : ''}
    </div>`;
  }).join('');
  return `<div class="modal-overlay" onclick="if(event.target===this) closeRoundResults();">
    <div class="modal" style="max-width:620px;max-height:85vh;overflow-y:auto">
      <button class="close-btn" onclick="closeRoundResults()">✕</button>
      <h1 style="font-size:22px;margin-bottom:6px">🏒 Итоги игрового дня ${G.lastRoundNumber || ''}</h1>
      <div class="subtitle" style="margin-bottom:14px">Все результаты игрового дня · матч вашего клуба выделен</div>
      ${rows}
      <div style="margin-top:16px;text-align:center"><button class="btn" onclick="closeRoundResults()">Продолжить</button></div>
    </div>
  </div>`;
}

function renderGames() {
  if (G.selectedGamePbp) {
    const game = G.selectedGamePbp; const home = G.league.teams.find(t => t.id === game.homeId); const away = G.league.teams.find(t => t.id === game.awayId);
    let html = `<button class="btn secondary" onclick="G.selectedGamePbp=null; render();">← Назад</button>`;
    html += `<h2>${away.name} ${game.ag} : ${game.hg} ${home.name} ${game.shootout ? '(буллиты)' : game.ot ? '(ОТ)' : ''}</h2><div class="pbp-container">`;
    for (const ev of game.pbp || []) { if (ev.type === 'period') { html += `<div class="pbp-period">${ev.text}</div>`; continue; } const cls = ev.type === 'goal' ? 'pbp-goal' : ev.type === 'penalty' ? 'pbp-penalty' : (ev.type === 'shot' || ev.type === 'shootout') ? 'pbp-shot' : 'pbp-faceoff'; html += `<div class="${cls}">[${ev.time}] ${ev.text}</div>`; }
    html += `</div>`; return html;
  }
  if (G.league.results.length === 0) return `<div class="subtitle">Матчей ещё не было.</div>`;
  const byRound = {}; G.league.results.forEach(r => (byRound[r.round] = byRound[r.round] || []).push(r));
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a); let html = '';
  rounds.forEach(r => {
    html += `<h2>Игровой день ${r + 1}</h2>`;
    byRound[r].forEach(res => {
      const home = G.league.teams.find(t => t.id === res.homeId); const away = G.league.teams.find(t => t.id === res.awayId);
      const isMe = res.homeId === G.playerTeamId || res.awayId === G.playerTeamId; const globalIdx = G.league.results.indexOf(res);
      html += `<div class="game-row ${isMe ? 'player-game' : ''}" onclick="G.selectedGamePbp=G.league.results[${globalIdx}]; render();"><span class="away">${away.name}</span><span class="score">${res.ag} : ${res.hg}${res.shootout ? '<span class="ot-tag">Б</span>' : res.ot ? '<span class="ot-tag">ОТ</span>' : ''}</span><span>${home.name}</span></div>`;
    });
  });
  return html;
}

function renderCalendar() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return '<div class="subtitle">Клуб не найден.</div>';
  const schedule = G.league.schedule || [];
  const meta = ensureScheduleCalendar(G.league);
  const travelZone = window.VHL_TRAVEL_ZONE_BY_SLUG?.[team.slug] || null;
  const myGames = [];
  schedule.forEach((round, idx) => {
    const game = round.find(([h, a]) => h === team.id || a === team.id);
    if (!game) return;
    const isHome = game[0] === team.id;
    const opp = G.league.teams.find(t => t.id === (isHome ? game[1] : game[0]));
    const result = G.league.results.find(r => r.round === idx && (r.homeId === team.id || r.awayId === team.id));
    const roundMeta = meta[idx] || {};
    const opponentZone = window.VHL_TRAVEL_ZONE_BY_SLUG?.[opp?.slug] || null;
    const zoneBlock = travelZone && opponentZone
      ? (roundMeta.zoneBlocks || []).find(block =>
          (block.zoneAId === travelZone.id || block.zoneBId === travelZone.id) &&
          (block.zoneAId === opponentZone.id || block.zoneBId === opponentZone.id))
      : null;
    let seriesLabel = '';
    if (zoneBlock) {
      seriesLabel = isHome
        ? `Домашняя серия · гости из зоны «${zoneBlock.awayZoneName}»`
        : `Выездная серия · ${zoneBlock.homeZoneName}`;
      seriesLabel += ` · матч ${zoneBlock.dayIndex}/${zoneBlock.seriesDays}`;
    } else if (roundMeta.phase === 'local-derby' && (roundMeta.zoneIds || []).includes(travelZone?.id)) {
      seriesLabel = 'Внутризональный матч';
    }
    if (roundMeta.travelNote && (roundMeta.zoneIds || []).includes(travelZone?.id) && ['norilsk', 'sokol'].includes(team.slug)) {
      seriesLabel += (seriesLabel ? ' · ' : '') + roundMeta.travelNote;
    }
    myGames.push({
      round: idx + 1, opp, isHome, result, isCurrent: idx === G.league.currentRound,
      date: roundMeta.date || null, seriesLabel,
    });
  });

  const byMonth = new Map();
  myGames.forEach(game => {
    const key = game.date ? game.date.slice(0, 7) : 'undated';
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(game);
  });
  const formatMonth = key => {
    if (key === 'undated') return 'Расписание';
    return new Date(key + '-01T00:00:00Z').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const formatDate = value => value
    ? new Date(value + 'T00:00:00Z').toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
    : 'Дата не назначена';

  let html = `<h2>Календарь сезона ${G.league.season}</h2>
    <div class="calendar-summary">${myGames.length} матчей регулярного чемпионата · логистическая зона: ${travelZone?.name || "не определена"} · матчи сгруппированы в серии ВХЛ</div>`;
  byMonth.forEach((games, month) => {
    html += `<div class="season-card calendar-month"><div class="head"><span class="season-num">${formatMonth(month)}</span><span class="tag">${games.length} матчей</span></div>`;
    games.forEach(g => {
      const homeAway = g.isHome ? 'ДОМА' : 'В ГОСТЯХ';
      const resultStr = g.result ? `${g.isHome ? g.result.hg : g.result.ag} : ${g.isHome ? g.result.ag : g.result.hg}${g.result.shootout ? ' Б' : g.result.ot ? ' ОТ' : ''}` : '';
      let color = 'color:#7a8299';
      if (g.result) {
        const won = g.isHome ? g.result.hg > g.result.ag : g.result.ag > g.result.hg;
        color = won ? 'color:#4ade80' : g.result.hg === g.result.ag ? 'color:#fbbf24' : 'color:#ef4444';
      }
      const bg = g.isCurrent ? 'background:rgba(255,107,53,0.12)' : '';
      const date = formatDate(g.date);
      html += `<div class="calendar-game ${g.isCurrent ? 'is-current' : ''}" style="${bg}">
        <div class="calendar-game-date">${date}<span>День ${g.round}</span></div>
        <div class="calendar-game-details">
          <div class="calendar-game-topline"><span class="calendar-venue ${g.isHome ? 'is-home' : 'is-away'}">${homeAway}</span><strong>${g.opp?.name || 'Соперник'}</strong><span class="calendar-game-score" style="${color}">${resultStr || '—'}</span></div>
          ${g.seriesLabel ? `<div class="calendar-series-label">${g.seriesLabel}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  });
  return html;
}

/* ============================================================
   СОСТАВ / ЗВЕНЬЯ
   ============================================================ */
function renderRoster() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return '<div class="subtitle">Состав клуба не найден.</div>';
  const benchSet = new Set(team.bench || []);
  const active = team.roster.filter(p => !benchSet.has(p.id));
  const skaters = active.filter(p => p.position !== 'G');
  const goalies = active.filter(p => p.position === 'G');
  const benched = team.roster.filter(p => benchSet.has(p.id));
  const sort = G.rosterSort || 'ovr';
  const sortPlayers = (arr) => arr.slice().sort((a, b) => {
    const sa = ensureStats(a), sb = ensureStats(b);
    if (sort === 'ovr') return b.ovr - a.ovr;
    if (sort === 'age') return a.age - b.age;
    if (sort === 'points') return (sb.points || 0) - (sa.points || 0);
    if (sort === 'salary') return b.contract.salary - a.contract.salary;
    if (sort === 'health') {
      const ha = a.injury && a.injury.gamesLeft > 0 ? 100 + a.injury.gamesLeft : a.fatigue;
      const hb = b.injury && b.injury.gamesLeft > 0 ? 100 + b.injury.gamesLeft : b.fatigue;
      return hb - ha;
    }
    return 0;
  });
  const sortedSkaters = sortPlayers(skaters);
  const sortedGoalies = sortPlayers(goalies);
  const totalSalary = team.roster.reduce((sum, p) => sum + (p.contract?.salary || 0), 0);
  const injured = team.roster.filter(p => p.injury && p.injury.gamesLeft > 0);
  const avgOvr = active.length ? Math.round(active.reduce((sum, p) => sum + p.ovr, 0) / active.length) : 0;
  const sortOptions = [
    ['ovr', 'По рейтингу'], ['points', 'По очкам'], ['age', 'По возрасту'],
    ['salary', 'По зарплате'], ['health', 'По состоянию']
  ].map(([key, label]) => '<option value="' + key + '"' + (sort === key ? ' selected' : '') + '>' + label + '</option>').join('');
  const playerCard = (p, goalie) => {
    const s = ensureStats(p);
    const cls = p.ovr >= 85 ? 'elite' : p.ovr >= 75 ? 'strong' : 'developing';
    const position = p.position === 'G' ? 'ВР' : p.position === 'D' ? 'ЗАЩ' : 'НАП';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const injuredNow = p.injury && p.injury.gamesLeft > 0;
    const condition = injuredNow
      ? '<span class="roster-status injured">' + (p.playingThroughPain ? '🩹 Играет с травмой' : '🚑 Травма') + ' · ' + p.injury.gamesLeft + ' игр</span>'
      : p.fatigue > 80 ? '<span class="roster-status tired">🥵 Усталость</span>'
      : p.fatigue < 20 ? '<span class="roster-status fresh">⚡ Отличное состояние</span>'
      : '<span class="roster-status healthy">● В строю</span>';
    const stats = goalie
      ? '<div class="roster-player-stats"><div><b>' + s.gp + '</b><small>МАТЧИ</small></div><div><b>' + s.wins + '</b><small>ПОБЕДЫ</small></div><div><b>' + (s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—') + '</b><small>SV%</small></div><div><b>' + (s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—') + '</b><small>КН</small></div></div>'
      : '<div class="roster-player-stats"><div><b>' + s.gp + '</b><small>МАТЧИ</small></div><div><b>' + s.goals + '</b><small>ГОЛЫ</small></div><div><b>' + s.assists + '</b><small>ПЕРЕДАЧИ</small></div><div class="highlight"><b>' + s.points + '</b><small>ОЧКИ</small></div></div>';
    const potential = p.pot > p.ovr ? '<span class="roster-potential">▲ Потенциал ' + p.pot + '</span>' : '';
    const country = p.nationality && p.nationality !== 'Россия' ? '<span class="roster-country">🌍 ' + p.nationality + '</span>' : '';
    return '<article class="roster-player-card ' + cls + (injuredNow ? ' is-injured' : '') + '">' +
      '<div class="roster-card-top"><span class="roster-position ' + (goalie ? 'goalie' : p.position === 'D' ? 'defence' : 'forward') + '">' + position + '</span><span class="roster-player-age">' + p.age + ' лет</span></div>' +
      '<div class="roster-player-identity"><div class="roster-player-name"><a href="#" onclick="event.preventDefault();G.popupPlayerId=' + p.id + ';render();">' + p.name + '</a></div><div class="roster-player-meta"><span class="char-badge ' + char.cls + '">' + char.label + '</span>' + country + '</div></div>' +
      '<div class="roster-rating-row"><div class="roster-rating"><strong>' + p.ovr + '</strong><small>OVR</small></div><div class="roster-rating-caption"><span>Общий рейтинг</span>' + potential + '</div><div class="roster-salary"><b>' + (p.contract.salary || 0).toFixed(1) + '</b><small>млн ₽ / сезон</small></div></div>' +
      stats + '<div class="roster-card-bottom">' + condition + '<div class="roster-card-actions"><button class="btn small secondary" onclick="sendToBench(' + p.id + ');render();" title="Отправить на скамейку">🪑</button><button class="btn small danger" onclick="putOnWaivers(' + p.id + ');render();" title="Выставить на драфт отказов (' + (team.waiversUsed || 0) + '/3)">📤</button></div></div></article>';
  };
  const cards = (arr, goalie) => arr.length
    ? '<div class="roster-card-grid">' + arr.map(p => playerCard(p, goalie)).join('') + '</div>'
    : '<div class="roster-empty">В этой категории пока нет игроков.</div>';
  const benchHtml = benched.length
    ? '<section class="roster-bench"><div class="roster-section-heading"><div><span class="roster-eyebrow">РЕЗЕРВ</span><h3>На скамейке <small>' + benched.length + '</small></h3></div><span>Игроки не участвуют в активном составе</span></div><div class="roster-bench-list">' + benched.map(p => '<div class="roster-bench-row"><div><b>' + p.name + '</b><span>' + p.position + ' · OVR ' + p.ovr + ' · ' + p.age + ' лет</span></div><button class="btn small" onclick="removeFromBench(' + p.id + ');render();">⬆ Вернуть в состав</button></div>').join('') + '</div></section>'
    : '';
  return '<section class="roster-management">' +
    '<div class="roster-hero"><div><span class="roster-eyebrow">СПОРТИВНЫЙ ОТДЕЛ · ' + team.name + '</span><h2>Состав команды</h2><p>Управляй игроками, следи за формой и контролируй зарплатную ведомость.</p></div><div class="roster-sort-control"><label for="roster-sort">Сортировка</label><select id="roster-sort" onchange="G.rosterSort=this.value;render();">' + sortOptions + '</select></div></div>' +
    '<div class="roster-overview-stats"><div><span>АКТИВНЫЙ СОСТАВ</span><b>' + active.length + '</b><small>игроков</small></div><div><span>СРЕДНИЙ OVR</span><b>' + avgOvr + '</b><small>по активному составу</small></div><div><span>ТРАВМЫ</span><b class="' + (injured.length ? 'negative' : 'positive') + '">' + injured.length + '</b><small>' + (injured.length ? 'в лазарете' : 'все здоровы') + '</small></div><div><span>ЗАРПЛАТНАЯ ВЕДОМОСТЬ</span><b>' + totalSalary.toFixed(1) + '</b><small>млн ₽ за сезон</small></div></div>' +
    '<div class="roster-section-heading"><div><span class="roster-eyebrow">ПОЛЕВЫЕ ИГРОКИ</span><h3>Нападающие и защитники <small>' + skaters.length + '</small></h3></div><span>Нажми на имя, чтобы открыть карточку игрока</span></div>' + cards(sortedSkaters, false) +
    '<div class="roster-section-heading roster-goalies-heading"><div><span class="roster-eyebrow">ПОСЛЕДНИЙ РУБЕЖ</span><h3>Вратари <small>' + goalies.length + '</small></h3></div><span>SV% — процент отражённых бросков</span></div>' + cards(sortedGoalies, true) +
    benchHtml +
    '<div class="roster-footer-note">Драфт отказов: <b>' + (team.waiversUsed || 0) + '/3</b> использовано за сезон. Перевод на скамейку и выставление на драфт отказов доступны на карточке каждого игрока.</div>' +
    '</section>';
}
function renderLines() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return '<div class="empty-state">Команда не найдена.</div>';
  if (!team.lines) initLines(team);
  syncLines(team);

  const benchSet = new Set(team.bench || []);
  const activeRoster = team.roster.filter(p => !benchSet.has(p.id));
  const poolFor = (isDef) => activeRoster
    .filter(p => isDef ? p.position === 'D' : (p.position !== 'D' && p.position !== 'G'))
    .sort((a,b) => b.ovr - a.ovr);
  const forwardPool = poolFor(false);
  const defencePool = poolFor(true);
  const goaliePool = activeRoster.filter(p => p.position === 'G').sort((a,b) => b.ovr - a.ovr);
  const lineKeys = ['f1','f2','f3','f4','d1','d2','d3'];
  const averageChemistry = Math.round(lineKeys.reduce((sum,key) => sum + (team.lines[key]?.chemistry || 0),0) / lineKeys.length);
  const forwardAssigned = team.lines.f1.players.length + team.lines.f2.players.length + team.lines.f3.players.length + team.lines.f4.players.length;
  const defenceAssigned = team.lines.d1.players.length + team.lines.d2.players.length + team.lines.d3.players.length;

  const lineMeta = {
    f1: { title: 'Первое звено', short: 'F1', hint: 'Главная атакующая тройка' },
    f2: { title: 'Второе звено', short: 'F2', hint: 'Вторая волна атаки' },
    f3: { title: 'Третье звено', short: 'F3', hint: 'Баланс и давление' },
    f4: { title: 'Четвёртое звено', short: 'F4', hint: 'Энергия и развитие' },
    d1: { title: 'Первая пара', short: 'D1', hint: 'Ведущая пара защитников' },
    d2: { title: 'Вторая пара', short: 'D2', hint: 'Поддержка и надёжность' },
    d3: { title: 'Третья пара', short: 'D3', hint: 'Ротация защитников' },
  };
  const positionLabel = (player, isDef) => {
    if (!player) return isDef ? 'ЗАЩИТНИК' : 'НАПАДАЮЩИЙ';
    const labels = { C: 'ЦЕНТР', LW: 'ЛЕВЫЙ КРАЙ', RW: 'ПРАВЫЙ КРАЙ', D: 'ЗАЩИТНИК', G: 'ВРАТАРЬ' };
    return labels[player.position] || (isDef ? 'ЗАЩИТНИК' : 'НАПАДАЮЩИЙ');
  };
  const ratingTier = player => !player ? 'empty' : player.ovr >= 85 ? 'elite' : player.ovr >= 78 ? 'strong' : player.ovr >= 70 ? 'regular' : 'depth';
  const ratingWidth = player => Math.max(0, Math.min(100, Number(player?.ovr) || 0));
  const playerSlot = (key, slotIdx, isDef) => {
    const line = team.lines[key];
    const currentId = line.players[slotIdx];
    const current = team.roster.find(p => p.id === currentId);
    const pool = isDef ? defencePool : forwardPool;
    const options = pool.map(p => `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name} · ${p.position} · ${p.ovr}</option>`).join('');
    return `<div class="lineup-player-slot ${current ? 'is-filled' : 'is-empty'}">
      <div class="lineup-player-main">
        <div class="lineup-player-avatar pos-${current?.position || 'empty'}">${current ? getInitials(current.name) : '—'}</div>
        <div class="lineup-player-info">
          <span class="lineup-player-position">${positionLabel(current,isDef)}</span>
          <b>${current ? current.name : 'Свободное место'}</b>
          <small>${current ? 'В составе звена' : 'Выберите хоккеиста ниже'}</small>
        </div>
        <span class="lineup-player-ovr rating-${ratingTier(current)}" title="Общий рейтинг">${current ? current.ovr : '—'}</span>
      </div>
      <div class="lineup-player-rating-track"><span class="rating-${ratingTier(current)}" style="width:${ratingWidth(current)}%"></span></div>
      <label class="lineup-player-change"><span>ЗАМЕНИТЬ ИГРОКА</span>
        <select class="lineup-player-select" aria-label="Игрок ${slotIdx + 1}, ${lineMeta[key].title}" onchange="setLineSlot('${key}', ${slotIdx}, Number(this.value))">${options}</select>
      </label>
    </div>`;
  };
  const lineCard = (key, size, isDef) => {
    const line = team.lines[key];
    const meta = lineMeta[key];
    const mods = lineMods(line);
    const chemistry = Math.max(0,Math.min(100,Math.round(line.chemistry || 0)));
    const chemClass = chemistry >= 70 ? 'high' : chemistry >= 40 ? 'medium' : 'low';
    const styleOpts = Object.entries(LINE_STYLES).map(([k,v]) => `<option value="${k}" ${line.style === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const roleOpts = Object.entries(LINE_ROLES).map(([k,v]) => `<option value="${k}" ${line.role === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const slots = Array.from({length:size},(_,i) => playerSlot(key,i,isDef)).join('');
    return `<article class="lineup-line-card ${isDef ? 'defence-line' : 'forward-line'}">
      <header class="lineup-line-header">
        <div class="lineup-line-heading">
          <span class="lineup-line-code">${meta.short}</span>
          <div><h4>${meta.title}</h4><p>${meta.hint}</p></div>
        </div>
        <div class="lineup-chemistry ${chemClass}">
          <b>${chemistry}</b><span>ХИМИЯ</span>
        </div>
      </header>
      <div class="lineup-chemistry-track"><span class="${chemClass}" style="width:${chemistry}%"></span></div>
      <div class="lineup-player-grid ${size === 3 ? 'three-slots' : 'two-slots'}">${slots}</div>
      <div class="lineup-line-settings">
        <label><span>РОЛЬ ЗВЕНА</span><select onchange="setLineRole('${key}', this.value)">${roleOpts}</select></label>
        <label><span>СТИЛЬ ИГРЫ</span><select onchange="setLineStyle('${key}', this.value)">${styleOpts}</select></label>
      </div>
      <div class="lineup-line-effects">
        <span>Атака <b class="${mods.atk >= 0 ? 'positive' : 'negative'}">${mods.atk >= 0 ? '+' : ''}${Math.round(mods.atk*100)}%</b></span>
        <span>Защита <b class="${mods.def >= 0 ? 'positive' : 'negative'}">${mods.def >= 0 ? '+' : ''}${Math.round(mods.def*100)}%</b></span>
      </div>
    </article>`;
  };
  const goalieSlot = (label,selectedId,slotIdx) => {
    const current = team.roster.find(p => p.id === selectedId);
    const options = goaliePool.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} · ${p.ovr}</option>`).join('');
    return `<article class="lineup-goalie-card ${current ? 'is-filled' : 'is-empty'}">
      <div class="lineup-goalie-top"><span class="lineup-goalie-label">${label}</span><span class="lineup-player-ovr rating-${ratingTier(current)}">${current ? current.ovr : '—'}</span></div>
      <div class="lineup-player-main">
        <div class="lineup-player-avatar goalie-avatar pos-G">${current ? getInitials(current.name) : '—'}</div>
        <div class="lineup-player-info"><span class="lineup-player-position">ВРАТАРЬ</span><b>${current ? current.name : 'Не выбран'}</b><small>${current ? 'Готов к матчу' : 'Назначьте голкипера'}</small></div>
      </div>
      <div class="lineup-player-rating-track"><span class="rating-${ratingTier(current)}" style="width:${ratingWidth(current)}%"></span></div>
      <label class="lineup-player-change"><span>ВЫБРАТЬ ВРАТАРЯ</span>
        <select class="lineup-player-select" aria-label="${label}" onchange="setLineSlot('g', ${slotIdx}, Number(this.value))">${options}</select>
      </label>
    </article>`;
  };

  return `<section class="lineup-screen">
    <div class="lineup-topbar">
      <div><span class="lineup-eyebrow">ТРЕНЕРСКИЙ ШТАБ · ${team.name}</span><h2>Состав звеньев</h2><p>Соберите сочетания, настройте роли и найдите баланс между атакой и обороной.</p></div>
      <button class="btn small lineup-auto-button" onclick="resetLinesToOvr()">↻ Автосостав по рейтингу</button>
    </div>
    <div class="lineup-overview">
      <div class="lineup-overview-card"><span>НАПАДАЮЩИЕ</span><b>${forwardAssigned}<small> / 12</small></b><i>${forwardPool.length} в распоряжении</i></div>
      <div class="lineup-overview-card"><span>ЗАЩИТНИКИ</span><b>${defenceAssigned}<small> / 6</small></b><i>${defencePool.length} в распоряжении</i></div>
      <div class="lineup-overview-card"><span>ВРАТАРИ</span><b>${[team.lines.g1,team.lines.g2].filter(Boolean).length}<small> / 2</small></b><i>${goaliePool.length} в распоряжении</i></div>
      <div class="lineup-overview-card chemistry-overview"><span>СРЕДНЯЯ ХИМИЯ</span><b>${averageChemistry}<small> / 100</small></b><i>По семи сочетаниям</i></div>
    </div>
    <section class="lineup-section">
      <div class="lineup-section-heading"><div><span>АТАКА</span><h3>Нападающие</h3></div><p>Четыре тройки · 12 игровых мест</p></div>
      <div class="lineup-lines-grid">${['f1','f2','f3','f4'].map(key => lineCard(key,3,false)).join('')}</div>
    </section>
    <section class="lineup-section">
      <div class="lineup-section-heading"><div><span>ОБОРОНА</span><h3>Защитники</h3></div><p>Три пары · 6 игровых мест</p></div>
      <div class="lineup-defence-grid">${['d1','d2','d3'].map(key => lineCard(key,2,true)).join('')}</div>
    </section>
    <section class="lineup-section">
      <div class="lineup-section-heading"><div><span>ПОСЛЕДНИЙ РУБЕЖ</span><h3>Вратари</h3></div><p>Стартовый голкипер и сменщик</p></div>
      <div class="lineup-goalies-grid">${goalieSlot('Стартовый вратарь',team.lines.g1,0)}${goalieSlot('Запасной вратарь',team.lines.g2,1)}</div>
    </section>
  </section>`;
}

/* ============================================================
   СТАТИСТИКА / ФИНАНСЫ
   ============================================================ */
function renderStats() {
  const mode = G.statsMode || 'regular';
  const leaders = leagueLeaders(G.league, mode, 0);
  const findTeam = (p) => G.league.teams.find(t => t.roster.includes(p));
  const getStat = (p) => mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
  const toggle = `<div class="stat-toggle"><button class="${mode === 'regular' ? 'active' : ''}" onclick="G.statsMode='regular'; render();">Регулярка</button><button class="${mode === 'playoff' ? 'active' : ''}" onclick="G.statsMode='playoff'; render();">Плей-офф</button></div>`;
  const expandedKey = (key) => mode + '-' + key;
  const skaterTable = (key, title, players) => {
    const expanded = !!(G.statsExpanded && G.statsExpanded[expandedKey(key)]);
    const visible = expanded ? players : players.slice(0, 10);
    const rows = visible.map((p, i) => {
      const t = findTeam(p), st = getStat(p), isMine = t && t.id === G.playerTeamId;
      return `<tr style="${isMine ? 'background:rgba(255,107,53,0.12)' : ''}"><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td style="${isMine ? 'color:#ff6b35;font-weight:700' : ''}">${t ? t.name : '—'}${isMine ? ' · Ваш клуб' : ''}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.goals}</td><td class="stat-cell">${st.assists}</td><td class="stat-cell" style="font-weight:700;color:#ff6b35">${st.points}</td></tr>`;
    }).join('');
    const more = players.length > 10
      ? `<div class="stat-list-footer"><span>Показано ${visible.length} из ${players.length}</span><button class="btn small secondary" onclick="G.statsExpanded=G.statsExpanded||{};G.statsExpanded['${expandedKey(key)}']=${expanded ? 'false' : 'true'};render();">${expanded ? 'Свернуть список' : 'Показать весь список'}</button></div>`
      : `<div class="stat-list-footer"><span>Всего игроков: ${players.length}</span></div>`;
    return `<section class="stat-leader-section"><h2>${title}</h2><div class="stat-table-scroll"><table class="stat-leader-table"><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>Г</th><th>А</th><th>О</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="subtitle">Пока нет данных.</td></tr>'}</tbody></table></div>${more}</section>`;
  };
  const expandedGoalies = !!(G.statsExpanded && G.statsExpanded[expandedKey('goalies')]);
  const goaliePlayers = leaders.bySvPct;
  const visibleGoalies = expandedGoalies ? goaliePlayers : goaliePlayers.slice(0, 10);
  const goalieRows = visibleGoalies.map((p, i) => {
    const t = findTeam(p), st = getStat(p), sv = st.shotsAgainst > 0 ? (st.saves / st.shotsAgainst).toFixed(3).replace(/^0/, '') : '—';
    const gaa = st.gp > 0 ? (st.goalsAgainst / st.gp).toFixed(2) : '—';
    const isMine = t && t.id === G.playerTeamId;
    return `<tr style="${isMine ? 'background:rgba(255,107,53,0.12)' : ''}"><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td style="${isMine ? 'color:#ff6b35;font-weight:700' : ''}">${t ? t.name : '—'}${isMine ? ' · Ваш клуб' : ''}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.wins}</td><td class="stat-cell" style="font-weight:700">${sv}</td><td class="stat-cell">${gaa}</td><td class="stat-cell">${st.shutouts}</td></tr>`;
  }).join('');
  const goalieMore = goaliePlayers.length > 10
    ? `<div class="stat-list-footer"><span>Показано ${visibleGoalies.length} из ${goaliePlayers.length}</span><button class="btn small secondary" onclick="G.statsExpanded=G.statsExpanded||{};G.statsExpanded['${expandedKey('goalies')}']=${expandedGoalies ? 'false' : 'true'};render();">${expandedGoalies ? 'Свернуть список' : 'Показать весь список'}</button></div>`
    : `<div class="stat-list-footer"><span>Всего в рейтинге: ${goaliePlayers.length}</span></div>`;
  const goalieTable = `<section class="stat-leader-section"><h2>🧤 Вратари <small class="stat-qualification">минимум ${mode === 'playoff' ? 3 : 10} матчей</small></h2><div class="stat-table-scroll"><table class="stat-leader-table"><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>В</th><th>SV%</th><th>КН</th><th>Сух</th></tr></thead><tbody>${goalieRows || '<tr><td colspan="8" class="subtitle">Пока нет квалифицированных вратарей.</td></tr>'}</tbody></table></div>${goalieMore}</section>`;
  return `${toggle}<div class="subtitle">Строки вашего клуба выделены оранжевым. В каждом рейтинге можно раскрыть полный список игроков.</div>${skaterTable('goals', '🎯 Снайперы', leaders.byGoals)}${skaterTable('assists', '🎁 Ассистенты', leaders.byAssists)}${skaterTable('points', '⭐ Бомбардиры', leaders.byPoints)}${goalieTable}`;
}

function renderFinance() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const f = team.finance;
  if (!f.sponsorOffers) generateSponsorOffers(team);
  const signedKeys = new Set((team.sponsors || []).map(s => s.key));
  const allOffers = f.sponsorOffers || [];
  const pendingOffers = allOffers.filter(o => !signedKeys.has(o.key));
  const playerSal = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const staffSal = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  const cards = `<div class="finance-card"><div class="fc-title">Баланс</div><div class="fc-value ${f.balance >= 0 ? 'pos' : 'neg'}">${Math.round(f.balance)} млн ₽</div><div class="fc-sub">Бюджет: ${f.seasonBudget} млн ₽</div></div><div class="finance-card"><div class="fc-title">ЗП игроков</div><div class="fc-value">${Math.round(playerSal)}</div><div class="fc-sub">Потолок: ${f.salaryCap} млн ₽</div></div><div class="finance-card"><div class="fc-title">ЗП штаба</div><div class="fc-value">${staffSal.toFixed(1)}</div></div><div class="finance-card"><div class="fc-title">Арена</div><div class="fc-value">${f.arenaCapacity.toLocaleString()}</div><div class="fc-sub">Фанбаза: ${(f.fanBase * 100).toFixed(0)}%</div></div>`;
  const inRows = [['Билеты', f.income.tickets], ['Мерч/еда', f.income.matchdayExtras], ['Мерч (пассив)', f.income.merch || 0], ['Спонсоры', f.income.sponsors], ['Бонусы спонсоров', f.income.sponsorBonuses], ['ТВ', f.income.tv], ['Призовые', f.income.prizes], ['Гос. поддержка', f.income.gov || 0]].map(([n, v]) => `<tr><td>${n}</td><td class="stat-cell" style="text-align:right">${v.toFixed(1)}</td></tr>`).join('');
  const exRows = [['ЗП игроков', f.expenses.salaries], ['ЗП штаба', f.expenses.staffSalaries], ['Бонусы', f.expenses.bonuses || 0], ['Операции', f.expenses.operations]].map(([n, v]) => `<tr><td>${n}</td><td class="stat-cell" style="text-align:right">${v.toFixed(1)}</td></tr>`).join('');
  let sponsorsHtml = '';
  if (team.sponsors && team.sponsors.length) sponsorsHtml = team.sponsors.map(s => { const progress = G.league.currentRound / G.league.schedule.length; const paid = Math.round(s.base * progress); return `<div class="finance-card"><div class="fc-title">${s.name}</div><div class="fc-value" style="font-size:16px">${s.base} млн ₽</div><div class="fc-sub">Выплачено: ${paid} / ${s.base}</div></div>`; }).join('');
  else sponsorsHtml = `<div class="finance-card"><div class="fc-title">Спонсоры</div><div class="fc-value neg">Не подписаны</div></div>`;
  let offersHtml = '';
  if (pendingOffers.length) offersHtml = `<h2>Спонсорские предложения (${pendingOffers.length})</h2><div style="margin-bottom:8px"><button class="btn" onclick="signAllSponsors(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">📝 Подписать все</button></div><div style="display:flex;gap:12px;flex-wrap:wrap">${pendingOffers.map(o => `<div class="finance-card" style="flex:1;min-width:220px"><div class="fc-title">${o.name}</div><div class="fc-value" style="font-size:18px">${o.base} млн ₽</div><button class="btn small" style="margin-top:8px" onclick="signSponsorByKey('${o.key}')">Подписать</button></div>`).join('')}</div>`;
  return `<div class="finance-grid">${cards}</div><h2>Доходы и расходы</h2><div class="finance-grid"><div class="finance-card"><div class="fc-title">Доходы</div><table>${inRows}</table></div><div class="finance-card"><div class="fc-title">Расходы</div><table>${exRows}</table></div></div><h2>Цена билета</h2><div class="finance-card"><div class="slider-row"><label>${f.ticketPrice} ₽</label><input type="range" min="100" max="1500" step="50" value="${f.ticketPrice}" oninput="setTicketPrice(this.value)" /><span class="slider-value">${f.ticketPrice}</span></div></div><h2>Спонсоры (${(team.sponsors || []).length})</h2><div class="finance-grid">${sponsorsHtml}</div>${offersHtml}`;
}
function setTicketPrice(v) { const team = G.league.teams.find(t => t.id === G.playerTeamId); team.finance.ticketPrice = Number(v); render(); }

function renderFreeAgentMarket() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const hasScout = !!team.staff.scout;
  const filtered = (G.league.freeAgents || []).filter(p => { if (G.marketFilter === 'all') return true; if (G.marketFilter === 'F') return p.position !== 'D' && p.position !== 'G'; if (G.marketFilter === 'D') return p.position === 'D'; if (G.marketFilter === 'G') return p.position === 'G'; return true; });
  const sortValues = { 'age-asc': p => -p.age, 'age-desc': p => p.age, 'ovr-desc': p => p.ovr, 'ovr-asc': p => -p.ovr, 'pot-desc': p => p.pot || p.ovr, 'pot-asc': p => -(p.pot || p.ovr) };
  const requestedSort = G.marketSort || 'ovr-desc';
  const sortMode = (!hasScout && requestedSort.startsWith('pot-')) || !Object.prototype.hasOwnProperty.call(sortValues, requestedSort) ? 'ovr-desc' : requestedSort;
  const sorted = filtered.slice().sort((a, b) => (sortValues[sortMode](b) - sortValues[sortMode](a)) || b.ovr - a.ovr || a.name.localeCompare(b.name, 'ru'));
  const sortControl = `<label class="market-sort-label">Сортировка <select class="market-sort-select" value="${sortMode}" onchange="G.marketSort=this.value; render();">
    <option value="ovr-desc" ${sortMode === 'ovr-desc' ? 'selected' : ''}>Рейтинг: сначала лучшие</option>
    <option value="ovr-asc" ${sortMode === 'ovr-asc' ? 'selected' : ''}>Рейтинг: сначала ниже</option>
    <option value="age-asc" ${sortMode === 'age-asc' ? 'selected' : ''}>Возраст: сначала моложе</option>
    <option value="age-desc" ${sortMode === 'age-desc' ? 'selected' : ''}>Возраст: сначала старше</option>
    <option value="pot-desc" ${hasScout ? '' : 'disabled'} ${sortMode === 'pot-desc' ? 'selected' : ''}>Потенциал: сначала выше</option>
    <option value="pot-asc" ${hasScout ? '' : 'disabled'} ${sortMode === 'pot-asc' ? 'selected' : ''}>Потенциал: сначала ниже</option>
  </select></label>`;
  const rows = sorted.map(p => {
    const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'; const foreign = p.nationality !== 'Россия';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const potTag = hasScout && p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : '';
    const graduateTag = p.youthGraduated ? '<span class="tag" title="Выпускник молодёжной лиги">🎓 Выпускник</span>' : '';
    return `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a> <span class="char-badge ${char.cls}">${char.label}</span> ${graduateTag} ${foreign ? '🌍' : ''}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="salary">${p.contract.salary.toFixed(1)}M</td><td><button class="btn small" onclick="openPlayerContractNegotiation(${p.id}, 'signing')">Переговоры</button><button class="btn small secondary" onclick="offerTryout(G.league.teams.find(t=>t.id===G.playerTeamId), G.league.freeAgents.find(x=>x.id===${p.id})); render();">Просмотр</button></td></tr>`;
  }).join('');
  return `<div class="market-toolbar"><div class="market-filters"><button class="${G.marketFilter === 'all' ? 'active' : ''}" onclick="G.marketFilter='all'; render();">Все</button><button class="${G.marketFilter === 'F' ? 'active' : ''}" onclick="G.marketFilter='F'; render();">Форварды</button><button class="${G.marketFilter === 'D' ? 'active' : ''}" onclick="G.marketFilter='D'; render();">Защитники</button><button class="${G.marketFilter === 'G' ? 'active' : ''}" onclick="G.marketFilter='G'; render();">Вратари</button></div>${sortControl}</div><h2>Свободные агенты (${sorted.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>ЗП</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderLoans() {
  const team = G.league.teams.find(item => item.id === G.playerTeamId);
  const incoming = (team.roster || []).filter(player => player.loan);
  const outgoing = G.league.teams.filter(club => club.id !== team.id).flatMap(club => (club.roster || []).filter(player => player.loan?.parentTeamId === team.id).map(player => ({ club, player })));
  const available = G.league.teams.filter(club => club.id !== team.id).flatMap(club => (club.roster || []).filter(player => !player.loan && (player.transferListed || player.age <= 23)).map(player => ({ club, player })));
  const rows = available.map(({club, player}) => { const terms = getLoanTerms(player, club, team, 5, 50); return '<tr><td>' + player.name + '</td><td>' + club.name + '</td><td>' + player.position + '</td><td>' + player.age + '</td><td>' + player.ovr + '</td><td>' + (Number(player.contract?.salary)||0).toFixed(1) + '</td><td>' + terms.fee.toFixed(1) + ' млн ₽</td><td><button class="btn small" ' + (terms.allowed ? '' : 'disabled title="' + terms.reason + '"') + ' onclick="loanPlayerFromClub(' + club.id + ',' + player.id + ',5,50)">Взять на 5 туров</button></td></tr>'; }).join('');
  const active = incoming.map(player => {
    const report = loanPerformanceReport(player);
    const goalieStats = player.position === 'G' && report.savePct !== null ? ' · отражено ' + report.savePct + '% · КН ' + report.gaa : '';
    return '<tr><td>' + player.name + '</td><td>' + (player.loan.parentTeamName || '—') + '</td><td>' + player.position + '</td><td>' + player.ovr + '</td><td>' + player.loan.endRound + '</td><td>' + player.loan.wageShare + '%</td><td>' + ((player.loan.performance?.gp)||0) + '</td><td>' + ((player.loan.performance?.goals)||0) + '/' + ((player.loan.performance?.assists)||0) + '/' + ((player.loan.performance?.points)||0) + goalieStats + '</td><td>' + report.status + '</td><td><button class="btn small secondary" onclick="returnLoanPlayer(' + player.id + ')">Вернуть досрочно</button></td></tr>';
  }).join('');
  const sent = outgoing.map(({club,player}) => {
    const report = loanPerformanceReport(player);
    const goalieStats = player.position === 'G' && report.savePct !== null ? ' · отражено ' + report.savePct + '% · КН ' + report.gaa : '';
    return '<tr><td>' + player.name + '</td><td>' + club.name + '</td><td>' + player.position + '</td><td>' + player.ovr + '</td><td>' + player.loan.endRound + '</td><td>' + player.loan.roleLabel + '</td><td>' + (100 - player.loan.wageShare) + '%</td><td>' + ((player.loan.performance?.gp)||0) + '</td><td>' + ((player.loan.performance?.goals)||0) + '/' + ((player.loan.performance?.assists)||0) + '/' + ((player.loan.performance?.points)||0) + goalieStats + '</td><td><b>' + report.status + '</b><small class="market-player-meta">' + report.usageRate + '% туров с игровым временем · ' + report.recommendation + '</small></td><td><button class="btn small secondary" onclick="returnLoanPlayer(' + player.id + ',\'recall\')">Отозвать из аренды</button></td></tr>';
  }).join('');
  const history = (G.league.loanLog || []).filter(item => item.returnedRound !== undefined && (item.parentTeamId === team.id || item.borrowerTeamId === team.id)).sort((a, b) => Number(b.returnedRound || 0) - Number(a.returnedRound || 0));
  const historyCards = history.map(item => {
    const wasParent = item.parentTeamId === team.id, stats = item.performance || {}, assessment = item.assessment || {};
    const goalie = item.position === 'G' || item.playerPosition === 'G';
    const clubWageShare = item.wageShare == null ? '—' : (wasParent ? 100 - Number(item.wageShare) : Number(item.wageShare));
    const statLine = goalie ? 'Матчи: ' + (stats.gp || 0) + ' · Победы: ' + (stats.wins || 0) + ' · Отражено бросков: ' + (stats.saves || 0) + ' · Шат-ауты: ' + (stats.shutouts || 0) : 'Матчи: ' + (stats.gp || 0) + ' · Голы: ' + (stats.goals || 0) + ' · Передачи: ' + (stats.assists || 0) + ' · Очки: ' + (stats.points || 0);
    const reason = item.reason === 'expired' ? 'Срок завершён' : item.reason === 'recall' ? 'Отзыв владельцем' : 'Досрочное возвращение';
    const period = item.startRound != null ? 'Туры ' + item.startRound + '–' + (item.returnedRound || item.endRound || '?') : 'Завершение: тур ' + item.returnedRound;
    const side = wasParent ? 'Отдали в аренду' : 'Взяли в аренду';
    const clubs = wasParent ? 'Клуб: ' + (item.borrowerTeamName || '—') : 'Владелец: ' + (item.parentTeamName || '—');
    return '<details class="trade-counter-card"><summary><b>' + (item.playerName || 'Хоккеист') + '</b> · ' + side + ' · ' + (assessment.status || 'Оценка не сохранена') + '</summary><div class="market-player-meta">' + clubs + ' · ' + period + ' · ' + reason + '</div><p>' + statLine + '</p><p>Игровое время: ' + (assessment.usageRate ?? '—') + '% · ' + (assessment.recommendation || 'Нет сохранённой рекомендации') + '</p><p>Роль: ' + (item.roleLabel || item.role || 'не указана') + ' · Доля зарплаты твоего клуба: ' + clubWageShare + '% · Плата: ' + (Number(item.fee) || 0).toFixed(1) + ' млн ₽</p></details>';
  }).join('');
  const own = (team.roster || []).filter(player => !player.loan && (player.transferListed || player.age <= 23)).map(player => '<tr><td>' + player.name + '</td><td>' + player.position + '</td><td>' + player.age + '</td><td>' + player.ovr + '</td><td><button class="btn small" onclick="startOutgoingLoanNegotiation(' + player.id + ')">Предложить в аренду</button></td></tr>').join('');
  let offerPanel = '';
  if (G.pendingOutgoingLoan) { const player = team.roster.find(p => p.id === G.pendingOutgoingLoan.playerId); const clubs = G.league.teams.filter(club => club.id !== team.id); if (player) offerPanel = '<section class="trade-counter-card"><h3>Предложение аренды: ' + player.name + '</h3><label>Клуб <select id="loan-target-club">' + clubs.map(club => '<option value="' + club.id + '">' + club.name + '</option>').join('') + '</select></label> <label>Срок <select id="loan-duration"><option value="3">3 тура</option><option value="5" selected>5 туров</option><option value="8">8 туров</option><option value="10">10 туров</option></select></label> <label>Доля зарплаты, которую платит твой клуб <select id="loan-wage-share"><option value="0">0%</option><option value="25">25%</option><option value="50" selected>50%</option><option value="75">75%</option><option value="100">100%</option></select></label> <label>Ожидаемая роль <select id="loan-role"><option value="top">Ведущая роль</option><option value="rotation" selected>Ротация</option><option value="reserve">Резерв</option></select></label><div class="market-actions"><button class="btn" onclick="submitOutgoingLoanOffer()">Отправить предложение</button><button class="btn secondary" onclick="G.pendingOutgoingLoan=null;render();">Отмена</button></div></section>'; }
  return '<section class="market-shell"><div class="market-intro"><h2>Аренды</h2><p>Бери игроков в аренду или отправляй своих в другие клубы. Отчёт оценивает игровое время и результативность с учётом ожидаемой роли. Можно досрочно вернуть или отозвать игрока.</p></div>' + offerPanel + '<h3>Твои игроки в аренде у других клубов (' + outgoing.length + ')</h3><div class="market-table-wrap"><table><thead><tr><th>Игрок</th><th>Клуб</th><th>Поз.</th><th>OVR</th><th>До тура</th><th>Роль</th><th>Твоя доля ЗП</th><th>Игр</th><th>Г/П/О</th><th>Отчёт</th><th>Действие</th></tr></thead><tbody>' + (sent || '<tr><td colspan="11">Ты пока никого не отправлял в аренду.</td></tr>') + '</tbody></table></div><h3>Игроки твоего клуба, которых можно отдать</h3><div class="market-table-wrap"><table><thead><tr><th>Игрок</th><th>Поз.</th><th>Возраст</th><th>OVR</th><th>Действие</th></tr></thead><tbody>' + (own || '<tr><td colspan="5">Сейчас нет подходящих игроков для аренды.</td></tr>') + '</tbody></table></div><h3>Игроки в аренде у твоего клуба (' + incoming.length + ')</h3><div class="market-table-wrap"><table><thead><tr><th>Игрок</th><th>Клуб-владелец</th><th>Поз.</th><th>OVR</th><th>До тура</th><th>Твоя доля ЗП</th><th>Игр</th><th>Г/П/О</th><th>Отчёт</th><th>Действие</th></tr></thead><tbody>' + (active || '<tr><td colspan="10">Пока нет арендованных игроков.</td></tr>') + '</tbody></table></div><h3>Доступны для аренды</h3><div class="market-table-wrap"><table><thead><tr><th>Игрок</th><th>Клуб</th><th>Поз.</th><th>Возраст</th><th>OVR</th><th>Зарплата</th><th>Плата</th><th>Действие</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">Сейчас нет подходящих игроков для аренды.</td></tr>') + '</tbody></table></div><h3>История завершённых аренд (' + history.length + ')</h3><div class="loan-history-list">' + (historyCards || '<p class="market-player-meta">Завершённых аренд пока нет.</p>') + '</div></section>'
}
function renderMarket() {
  const tabs = [
    ['free', 'Свободные агенты'],
    ['vhl', 'ВХЛ · трансферный список'],
    ['kazakhstan', 'Казахстан'],
    ['belarus', 'Беларусь'],
    ['europe', 'Европа']
  ];
  const tabsHtml = tabs.map(([key, label]) =>
    `<button class="market-region-tab ${G.marketLeague === key ? 'active' : ''}" onclick="G.marketLeague='${key}'; render();">${label}</button>`
  ).join('');
  const content = G.marketLeague === 'free'
    ? renderFreeAgentMarket()
    : G.marketLeague === 'vhl' ? renderVHLTransferMarket() : renderInternationalMarket(G.marketLeague);
  return `<section class="market-shell"><div class="market-region-tabs">${tabsHtml}</div>${content}</section>`;
}
function renderVHLTransferMarket() {
  const buyer = G.league.teams.find(club => club.id === G.playerTeamId);
  const entries = G.league.teams.filter(club => club.id !== G.playerTeamId).flatMap(club => (club.roster || []).filter(player => player.transferListed || player.transferRequest).map(player => ({ club, player })));
  const filter = G.marketFilter || 'all';
  const visible = entries.filter(({ player }) => filter === 'all' || (filter === 'F' ? !['D','G'].includes(player.position) : filter === 'D' ? player.position === 'D' : player.position === 'G'));
  const sort = G.marketSort === 'age-asc' ? (a,b) => a.player.age-b.player.age : G.marketSort === 'age-desc' ? (a,b) => b.player.age-a.player.age : G.marketSort === 'ovr-asc' ? (a,b) => a.player.ovr-b.player.ovr : (a,b) => b.player.ovr-a.player.ovr;
  visible.sort(sort);
  const negotiation = G.pendingVHLTransferNegotiation;
  let negotiationPanel = '';
  if (negotiation) {
    const seller = G.league.teams.find(item => Number(item.id) === Number(negotiation.sellingTeamId));
    const target = seller?.roster.find(item => Number(item.id) === Number(negotiation.playerId));
    if (seller && target) {
      const currentAsk = negotiation.counterPrice || negotiation.askingPrice;
      negotiationPanel = '<section class="trade-counter-card"><h3>Переговоры о трансфере: ' + target.name + '</h3><p>Клуб ' + seller.name + ' запрашивает ' + currentAsk.toFixed(1) + ' млн ₽. Раунд ' + negotiation.round + ' из 3.</p><label>Твоё предложение, млн ₽ <input id="vhl-transfer-offer" type="number" min="0.1" step="0.1" value="' + Math.min(currentAsk, negotiation.askingPrice).toFixed(1) + '"></label><div class="market-actions"><button class="btn" onclick="submitVHLTransferOffer()">Отправить предложение</button>' + (negotiation.counterPrice ? '<button class="btn secondary" onclick="acceptVHLTransferCounter()">Принять ' + negotiation.counterPrice.toFixed(1) + ' млн ₽</button>' : '') + '<button class="btn secondary" onclick="cancelVHLTransferNegotiation()">Отмена</button></div></section>';
    }
  }
  const rows = visible.map(({club,player}) => {
    const quote = getVHLTransferQuote(player, club, buyer);
    const disabled = quote.allowed ? '' : 'disabled title="' + quote.reason + '"';
    return '<tr><td>' + player.position + '</td><td><b>' + player.name + '</b> ' + (player.transferRequest ? 'Запросил переход' : 'Выставлен клубом') + '<small class="market-player-meta">' + player.age + ' лет</small></td><td>' + club.name + '</td><td>' + player.ovr + '</td><td>' + (player.pot || player.ovr) + '</td><td>' + (Number(player.contract?.salary)||0).toFixed(1) + ' млн ₽</td><td>' + quote.price.toFixed(1) + ' млн ₽</td><td><button class="btn small" ' + disabled + ' onclick="buyVHLPlayer(' + club.id + ',' + player.id + ')">Купить</button> <button class="btn small secondary" onclick="startVHLTransferNegotiation(' + club.id + ',' + player.id + ')">Торг</button> <button class="btn small secondary" onclick="prepareTradeForPlayer(' + club.id + ',' + player.id + ')">Обмен</button></td></tr>';
  }).join('');
  return negotiationPanel + '<div class="market-intro"><h2>Игроки ВХЛ на трансферном рынке (' + visible.length + ')</h2><p>Можно купить игрока за трансферную сумму или перейти к обмену. Стоимость и ограничения проверяются перед сделкой.</p></div><div class="market-filters"><button onclick="G.marketFilter=\'all\';render();">Все</button><button onclick="G.marketFilter=\'F\';render();">Форварды</button><button onclick="G.marketFilter=\'D\';render();">Защитники</button><button onclick="G.marketFilter=\'G\';render();">Вратари</button></div><div class="market-table-wrap"><table><thead><tr><th>Поз.</th><th>Игрок</th><th>Клуб</th><th>OVR</th><th>Потенциал</th><th>Зарплата</th><th>Трансфер</th><th>Действие</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">Сейчас клубы ВХЛ не выставили игроков на трансфер.</td></tr>') + '</tbody></table></div>';
}
function renderInternationalMarket(region) {
  const team = G.league.teams.find(item => item.id === G.playerTeamId);
  const clubs = (G.league.internationalMarket?.clubs || []).filter(club => club.region === region);
  const allPlayers = clubs.flatMap(club => club.roster.map(player => ({ player, club })));
  const filteredByPosition = allPlayers.filter(({ player }) => {
    if (G.marketFilter === 'F') return player.position !== 'D' && player.position !== 'G';
    if (G.marketFilter === 'D') return player.position === 'D';
    if (G.marketFilter === 'G') return player.position === 'G';
    return true;
  });
  const sortValues = {
    'age-asc': p => -p.age, 'age-desc': p => p.age,
    'ovr-desc': p => p.ovr, 'ovr-asc': p => -p.ovr,
    'pot-desc': p => p.pot || p.ovr, 'pot-asc': p => -(p.pot || p.ovr)
  };
  const requestedSort = G.marketSort || 'ovr-desc';
  const sortMode = Object.prototype.hasOwnProperty.call(sortValues, requestedSort) ? requestedSort : 'ovr-desc';
  const filtered = filteredByPosition.slice().sort((a, b) =>
    sortValues[sortMode](b.player) - sortValues[sortMode](a.player) ||
    b.player.ovr - a.player.ovr || a.player.name.localeCompare(b.player.name, 'ru'));
  const sortControl = `<label class="market-sort-label">Сортировка <select class="market-sort-select" value="${sortMode}" onchange="G.marketSort=this.value; render();">
    <option value="ovr-desc" ${sortMode === 'ovr-desc' ? 'selected' : ''}>Рейтинг: сначала лучшие</option>
    <option value="ovr-asc" ${sortMode === 'ovr-asc' ? 'selected' : ''}>Рейтинг: сначала ниже</option>
    <option value="age-asc" ${sortMode === 'age-asc' ? 'selected' : ''}>Возраст: сначала моложе</option>
    <option value="age-desc" ${sortMode === 'age-desc' ? 'selected' : ''}>Возраст: сначала старше</option>
    <option value="pot-desc" ${sortMode === 'pot-desc' ? 'selected' : ''}>Потенциал: сначала выше</option>
    <option value="pot-asc" ${sortMode === 'pot-asc' ? 'selected' : ''}>Потенциал: сначала ниже</option>
  </select></label>`;
  const filters = `<div class="market-toolbar"><div class="market-filters">
    <button class="${G.marketFilter === 'all' ? 'active' : ''}" onclick="G.marketFilter='all'; render();">Все</button>
    <button class="${G.marketFilter === 'F' ? 'active' : ''}" onclick="G.marketFilter='F'; render();">Форварды</button>
    <button class="${G.marketFilter === 'D' ? 'active' : ''}" onclick="G.marketFilter='D'; render();">Защитники</button>
    <button class="${G.marketFilter === 'G' ? 'active' : ''}" onclick="G.marketFilter='G'; render();">Вратари</button>
  </div>${sortControl}</div>`;
  const realCount = allPlayers.filter(({player}) => player.internationalRealPlayer).length;
  const generatedCount = allPlayers.length - realCount;
  const rows = filtered.map(({ player, club }) => {
    const quote = getInternationalTransferQuote(player, club, team);
    const cls = player.ovr >= 85 ? 'hi' : player.ovr >= 75 ? 'mid' : 'lo';
    const tag = player.internationalRealPlayer ? '<span class="tag real-player">Реальная статистика</span>' : '';
    const listed = player.transferListed ? '<span class="tag transfer-listed">На трансфере</span>' : '';
    const stats = player.internationalStats
      ? (player.position === 'G'
        ? `${player.internationalStats.gp} игр · ${Number(player.internationalStats.gaa).toFixed(2)} КН · ${Number(player.internationalStats.svPct).toFixed(1)}% ОБ`
        : `${player.internationalStats.gp} игр · ${player.internationalStats.g}-${player.internationalStats.a}-${player.internationalStats.g + player.internationalStats.a} очк. · +/- ${player.internationalStats.pm > 0 ? '+' : ''}${player.internationalStats.pm}`)
      : 'Нет подтверждённой сезонной статистики';
    const disabled = quote.allowed ? '' : 'disabled';
    const title = quote.allowed ? 'Купить игрока' : quote.reason;
    return `<tr>
      <td><span class="pos ${player.position === 'G' ? 'G' : player.position === 'D' ? 'D' : 'F'}">${player.position}</span></td>
      <td><b>${player.name}</b> ${tag} ${listed}<small class="market-player-meta">${player.age} лет · ${player.nationality}</small></td>
      <td><span class="market-club-cell">${clubLogoWithFallback(club, 28, 'market-club-logo')}<span>${club.name}<small class="market-player-meta">${club.city}, ${club.country}</small></span></span></td>
      <td>${club.leagueName}</td>
      <td>${player.age}</td>
      <td class="ovr ${cls}">${player.ovr}</td>
      <td class="market-potential">${player.pot || player.ovr}</td>
      <td class="market-player-stats">${stats}</td>
      <td class="salary">${quote.salary.toFixed(1)}M</td>
      <td class="salary">${quote.price.toFixed(1)}M</td>
      <td><button type="button" class="btn small" ${disabled} title="${title}" onclick="openInternationalClubNegotiation(${Number(player.id)})">Переговоры</button></td>
    </tr>`;
  }).join('');
  const title = region === 'kazakhstan' ? 'Клубы Казахстана' : region === 'belarus' ? 'Клубы Беларуси' : 'Европейские клубы';
  const clubList = clubs.map(club => club.name).join(' · ');
  return `<div class="market-intro"><div><h2>${title} (${filtered.length})</h2><p>Проверка зарплатного потолка, трансферной суммы и лимита легионеров действует при каждом подписании.</p></div><span class="market-data-note">${realCount} игроков с реальной статистикой · ${generatedCount} игровых дополнений</span></div>
    <p class="market-club-list">Команды лиги (${clubs.length}): ${clubList}</p>
    ${filters}
    <div class="market-table-wrap"><table><thead><tr><th>Поз.</th><th>Игрок</th><th>Клуб</th><th>Лига</th><th>Возраст</th><th>OVR</th><th>Потенциал</th><th>Статистика сезона</th><th>ЗП</th><th>Трансфер</th><th>Действие</th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="market-empty">В этой лиге пока нет доступных игроков</td></tr>'}</tbody></table></div>
    <p class="market-footnote">Статистика — регулярный чемпионат сезона 2026/27. Возраст игроков без подтверждённого профиля пока временный. Все суммы указаны в млн ₽.</p>`;
}
function renderTrades() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const offers = G.league.aiTradeOffers || [];
  const deadline = isTradeDeadlinePassed();
  let html = `<h2>Обмены</h2>`;
  if (deadline) html += `<div class="trade-deadline-banner">🚫 Трансферный дедлайн закрыт. Обмены недоступны до конца сезона.</div>`;
  if (G.pendingTradeCounter) {
    const counter = G.pendingTradeCounter;
    const club = G.league.teams.find(t => t.id === counter.aiTeamId);
    html += '<div class="trade-counter-card"><b>Встречное предложение ' + (club ? club.name : 'клуба') + '</b><p>' + counter.message + '. Клуб просит увеличить денежную часть с ' + counter.myCash.toFixed(1) + ' до ' + counter.counterMyCash.toFixed(1) + ' млн ₽.</p><button class="btn small" onclick="acceptTradeCounterOffer()">Принять условия</button> <button class="btn small secondary" onclick="declineTradeCounterOffer()">Отказаться</button></div>';
  }
  if (offers.length) {
    html += `<h2>💼 Предложения (${offers.length})</h2>`;
    for (const o of offers) {
      const from = G.league.teams.find(t => t.id === o.fromTeamId);
      const theirOffer = o.theyOffer.map(id => from?.roster.find(p => p.id === id)).filter(Boolean);
      const want = o.theyWant.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
      const disabled = deadline ? 'disabled style="opacity:0.4;cursor:not-allowed"' : '';
      const playerLabel = (p) => `<span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span> ${p.name} (${p.ovr})`;
      html += `<div class="trade-offer-card"><div class="to-head"><span class="to-team">💼 ${from ? from.name : '—'}</span></div><div class="to-players"><div><b style="color:#4ade80">Отдают:</b> ${theirOffer.map(playerLabel).join(', ') || '—'}</div><div><b style="color:#fbbf24">Хотят:</b> ${want.map(playerLabel).join(', ') || '—'}</div></div><div class="to-actions"><button class="btn small" ${disabled} onclick="acceptAITradeOffer(${o.id})">✅ Принять</button><button class="btn small secondary" onclick="declineAITradeOffer(${o.id})">❌ Отклонить</button></div></div>`;
    }
  }
  if (deadline) return html;
  const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId).sort((a, b) => a.name.localeCompare(b.name));
  if (!G.tradeTargetTeamId && aiTeams.length) G.tradeTargetTeamId = aiTeams[0].id;
  const theirTeam = G.league.teams.find(t => t.id === G.tradeTargetTeamId);
  const myPlayers = team.roster.filter(p => p.ovr >= 55).sort((a, b) => b.ovr - a.ovr);
  const theirPlayers = theirTeam ? theirTeam.roster.slice().sort((a, b) => b.ovr - a.ovr) : [];
  html += `<h2>Свой обмен</h2><div class="finance-card"><div class="fc-title">Соперник</div><select onchange="setTradeTeam(this.value)" style="width:100%;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:8px;border-radius:4px">${aiTeams.map(t => `<option value="${t.id}" ${t.id === G.tradeTargetTeamId ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>`;
  const tradePlayerRow = (p, side) => `<label class="trade-check-row"><input type="checkbox" class="trade-${side}-pick" value="${p.id}" ${side === "their" && Number(G.marketTargetPlayerId) === Number(p.id) ? "checked" : ""}><span><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span> ${p.name} (${p.ovr}) — ${tradeValue(p)}</span></label>`;
  html += `<div class="trade-multi"><div class="trade-col"><h4>Мои игроки</h4>${myPlayers.map(p => tradePlayerRow(p, 'my')).join('')}<div style="margin-top:8px"><label style="font-size:12px">+ Деньги (млн): </label><input id="my-cash" type="number" min="0" value="0" style="width:80px;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px;border-radius:3px"></div></div><div class="trade-col"><h4>Игроки соперника</h4>${theirPlayers.map(p => tradePlayerRow(p, 'their')).join('')}<div style="margin-top:8px"><label style="font-size:12px">+ Деньги (млн): </label><input id="their-cash" type="number" min="0" value="0" style="width:80px;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px;border-radius:3px"></div></div></div>`;
  html += `<button class="btn" onclick="proposeMultiTrade()" style="margin-top:12px">🔄 Предложить обмен</button>`;
  return html;
}

function renderWaivers() {
  const list = G.league.waivers || [];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  let html = `<h2>Драфт отказов (${team.waiversUsed || 0}/3)</h2>`;
  if (!list.length) return html + `<div class="subtitle">Список пуст.</div>`;
  html += `<table><thead><tr><th>Игрок</th><th>Откуда</th><th>OVR</th><th>Истекает</th></tr></thead><tbody>`;
  for (const w of list) { const from = G.league.teams.find(t => t.id === w.fromTeamId); html += `<tr><td>${w.player.name}</td><td>${from ? from.name : '—'}</td><td>${w.player.ovr}</td><td>Тур ${w.expiresRound + 1}</td></tr>`; }
  return html + `</tbody></table>`;
}

/* ============================================================
   ТАКТИКА / ТРЕНИРОВКИ / ШТАБ
   ============================================================ */
function setTactic(key, value) { const team = G.league.teams.find(t => t.id === G.playerTeamId); team.tactics[key] = Number(value); render(); }
function renderTactics() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const t = team.tactics; const mods = tacticMods(t, team);
  const rows = SLIDER_DEFS.map(s => `<div class="slider-row"><label>${s.label}</label><input type="range" min="0" max="100" value="${t[s.key]}" oninput="setTactic('${s.key}', this.value)" /><span class="slider-value">${t[s.key]}</span></div><div class="subtitle" style="margin:-4px 0 8px 172px;font-size:11px">${s.left} ↔ ${s.right}</div>`).join('');
  const assistantBtn = team.staff.assistantCoach
    ? `<button class="btn" onclick="suggestTactics(); render();" style="margin-top:12px">📋 Совет ассистента (ур. ${team.staff.assistantCoach.level})</button>`
    : `<div class="subtitle" style="margin-top:12px">💡 Найми ассистента во вкладке «Штаб».</div>`;
  return `<h2>Тактическая схема</h2><div class="finance-card">${rows}<div class="fc-sub">Атака: ${mods.atkMod >= 0 ? '+' : ''}${Math.round(mods.atkMod*100)}% · Защита: ${mods.defMod >= 0 ? '+' : ''}${Math.round(mods.defMod*100)}%</div></div>${assistantBtn}`;
}
function renderTraining() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const players = team.roster.filter(p => p.age <= 27).sort((a, b) => b.pot - a.pot).slice(0, 14);
  const rows = players.map(p => {
    const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'; const isG = p.position === 'G';
    const focuses = Object.entries(DEV_FOCUSES).filter(([, f]) => isG ? f.goalie : !f.goalie);
    const btns = focuses.map(([key, f]) => `<button class="${p.developmentFocus === key ? 'active' : ''}" onclick="setDevelopmentFocus(G.league.teams.find(t=>t.id===G.playerTeamId).roster.find(x=>x.id===${p.id}), '${key}'); render();">${f.label}</button>`).join('');
    const mentor = getMentor(team, p.id);
    const mentorTag = mentor ? ` <span class="tag">🎓 ${mentor.name}</span>` : '';
    return `<div class="dev-row"><div class="dr-info"><div class="dr-name"><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a> <span class="ovr ${cls}">${p.ovr}</span>${mentorTag}</div><div class="dr-meta">${p.position} · ${p.age} лет · Потенциал: ${p.pot}</div></div><div class="dr-focus">${btns}</div></div>`;
  }).join('');
  const assistantBtn = team.staff.assistantCoach
    ? `<button class="btn" onclick="suggestTraining(); render();" style="margin-bottom:12px">📋 Распределить фокусы (ассистент ур. ${team.staff.assistantCoach.level})</button>`
    : `<div class="subtitle" style="margin-bottom:12px">💡 Найми ассистента для автораспределения.</div>`;
  return `<h2>Тренировочный лагерь</h2>${assistantBtn}<div class="dev-list">${rows || '<div class="subtitle">Нет подходящих игроков.</div>'}</div>`;
}
function renderStaff() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const totalStaffSalary = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  let html = `<h2>Штаб</h2><div class="finance-card"><div class="fc-title">Зарплата штаба</div><div class="fc-value">${totalStaffSalary.toFixed(1)} млн ₽</div></div><h2>Текущий состав</h2><table><thead><tr><th>Роль</th><th>Сотрудник</th><th>Уровень</th><th>XP</th><th>Действие</th></tr></thead><tbody>`;
  for (const [role, def] of Object.entries(STAFF_ROLES)) {
    const emp = team.staff[role];
    html += `<tr><td>${def.icon} <b>${def.label}</b><div class="tag">${def.desc}</div></td>`;
    if (emp) { const xpNeeded = emp.level * 20; html += `<td>${emp.name}</td><td>${'★'.repeat(emp.level)}</td><td>${emp.xp || 0}/${emp.level < 5 ? xpNeeded : '—'}</td><td><button class="btn small danger" onclick="fireStaff('${role}'); render();">Уволить</button></td>`; }
    else html += `<td colspan="4" style="color:#7a8299">Вакансия</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table><h2>Кандидаты (${G.league.staffPool.length})</h2>`;
  if (!G.league.staffPool.length) html += `<div class="subtitle">Кандидатов нет.</div>`;
  else { html += `<table><thead><tr><th>Роль</th><th>Имя</th><th>Возраст</th><th>Уровень</th><th>Действие</th></tr></thead><tbody>`; for (const cand of G.league.staffPool) { const def = STAFF_ROLES[cand.role]; html += `<tr><td>${def.icon} ${def.label}</td><td>${cand.name}</td><td>${cand.age}</td><td>${'★'.repeat(cand.level)}</td><td><button class="btn small" onclick="hireStaff(${cand.id}); render();">Нанять</button></td></tr>`; } html += `</tbody></table>`; }
  return html;
}

/* ============================================================
   ИНФРАСТРУКТУРА / АКАДЕМИЯ
   ============================================================ */
function renderInfrastructure() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const f = team.finance;
  let html = `<h2>Арена</h2><div class="finance-card"><div class="fc-title">Вместимость</div><div class="fc-value">${f.arenaCapacity.toLocaleString()}</div><div class="fc-sub">Ур. ${team.arenaLevel}/5</div>`;
  if (team.arenaLevel < 5) { const cost = arenaUpgradeCost(team.arenaLevel); html += `<button class="btn small" style="margin-top:8px" onclick="upgradeArena(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Расширить за ${cost} млн</button>`; }
  html += `</div><h2>Инфраструктура</h2><div class="finance-grid">`;
  for (const [key, def] of Object.entries(INFRA)) {
    const lvl = team.infrastructure[key]; const cost = def.upgradeCost(lvl);
    html += `<div class="finance-card"><div class="fc-title">${def.label}</div><div class="fc-value">Ур. ${lvl}</div><div class="fc-sub">${def.effect(lvl)}</div>`;
    if (lvl < def.maxLevel) html += `<button class="btn small" style="margin-top:8px" onclick="upgradeInfra('${key}'); render();">Улучшить за ${cost} млн</button>`;
    html += `</div>`;
  }
  html += `</div>`;
  const merchCosts = { 1: 5, 2: 12, 3: 25, 4: 50 };
  const merchDesc = ['База', '+15% к мерчу', '+30%, +1 фанбаза за победу', '+50%', '+75%, +1 млн/тур'];
  html += `<h2>Мерч (уровень ${f.merchLevel || 1}/5)</h2><div class="infrastructure-card"><div class="ic-title">Логотип и мерч</div><div class="ic-desc">${merchDesc[(f.merchLevel || 1) - 1]}</div>`;
  if ((f.merchLevel || 1) < 5) { const cost = merchCosts[f.merchLevel || 1]; html += `<button class="btn small" onclick="upgradeMerch(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Улучшить за ${cost} млн</button>`; }
  html += `</div>`;
  const vipCosts = { 0: 10, 1: 25, 2: 50 };
  html += `<h2>ВИП-ложи (уровень ${f.vipLevel || 0}/3)</h2><div class="infrastructure-card"><div class="ic-title">ВИП-ложи</div><div class="ic-desc">${f.vipLevel === 0 ? 'Нет' : `+${f.vipLevel * 15}% к цене билета`}</div>`;
  if ((f.vipLevel || 0) < 3) { const cost = vipCosts[f.vipLevel || 0]; html += `<button class="btn small" onclick="upgradeVip(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Улучшить за ${cost} млн</button>`; }
  html += `</div>`;
  html += `<h2>Матч-дэй активности</h2><div class="finance-grid">`;
  const flagDefs = [{ key: 'fanzone', label: 'Фан-зона', cost: 2, desc: '+5% к заполняемости' }, { key: 'show', label: 'Шоу перед матчем', cost: 5, desc: '+3% к заполняемости, +мораль' }, { key: 'kidsTickets', label: 'Детские билеты', cost: 1, desc: '+10% к заполняемости против аутсайдеров' }];
  for (const flag of flagDefs) {
    const active = f.matchdayFlags?.[flag.key];
    html += `<div class="finance-card"><div class="fc-title">${flag.label}</div><div class="fc-sub">${flag.desc}</div><div style="margin-top:8px"><button class="btn small ${active ? 'danger' : ''}" onclick="toggleMatchdayFlag(G.league.teams.find(t=>t.id===G.playerTeamId), '${flag.key}'); render();">${active ? 'Отключить' : `Включить (${flag.cost} млн)`}</button></div></div>`;
  }
  html += `</div>`;
  return html;
}
function renderAcademy() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  let html = `<h2>Академия (ур. ${team.infrastructure.youthAcademy})</h2>`;
  html += `<div style="margin-bottom:12px"><button class="btn" onclick="searchForTalent()">🔍 Искать талант (5 млн ₽)</button>`;
  if (team.scoutMission?.active) html += `<button class="btn secondary" disabled>Миссия до тура ${team.scoutMission.endsRound + 1}</button>`;
  else html += `<button class="btn secondary" onclick="sendScoutMission()">📤 Миссия скаута (2 млн)</button>`;
  html += `</div>`;
  if (team.scoutMission?.results?.length) {
    html += `<h2>📤 Результаты миссии</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>Потенциал</th><th>Действие</th></tr></thead><tbody>`;
    for (const p of team.scoutMission.results) html += `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}</td><td>${p.age}</td><td>${p.ovr}</td><td><span class="pot">▲${p.pot - p.ovr}</span></td><td><button class="btn small" onclick="addScoutedPlayerToAcademy(G.league.teams.find(t=>t.id===G.playerTeamId), ${p.id});">В академию</button></td></tr>`;
    html += `</tbody></table>`;
  }
  for (const group of ['U18', 'U17', 'U16']) {
    const players = (team.academy[group] || []).slice().sort((a, b) => b.pot - a.pot);
    html += `<h2>${group} (${players.length})</h2>`;
    if (!players.length) { html += `<div class="subtitle">Нет игроков.</div>`; continue; }
    html += `<table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>Потенциал</th><th>Прогноз</th></tr></thead><tbody>`;
    for (const p of players) { const prog = academyPrognosis(p); html += `<tr style="cursor:pointer" onclick="openYouthPlayerCard('academy', '${group}', null, null, ${p.id})"><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}</td><td>${p.age}</td><td class="ovr ${p.ovr >= 65 ? 'mid' : 'lo'}">${p.ovr}</td><td><span class="pot">▲${p.pot - p.ovr}</span></td><td><span class="academy-role-badge ${prog.cls}">${prog.label}</span></td></tr>`; }
    html += `</tbody></table>`;
  }
  return html;
}

function openYouthPlayerCard(source, group, leagueId, teamId, playerId) { G.youthPlayerModal = { source, group, leagueId, teamId, playerId }; render(); }
function closeYouthPlayerCard() { G.youthPlayerModal = null; render(); }
function renderYouthPlayerModal() {
  const modal = G.youthPlayerModal; if (!modal) return '';
  const senior = G.league.teams.find(team => team.id === G.playerTeamId);
  let player = null, sourceName = '', action = '', price = 0;
  if (modal.source === 'academy') {
    player = (senior?.academy?.[modal.group] || []).find(item => item.id === modal.playerId);
    sourceName = senior?.name + ' · академия ' + modal.group; action = 'В основную команду';
  } else {
    const league = G.league.youth?.leagues?.[modal.leagueId];
    const club = league?.teams.find(item => item.id === modal.teamId);
    player = club?.roster.find(item => item.id === modal.playerId);
    if (club && player) {
      const assignedToMe = player.youth?.parentSeniorClubId === senior?.id;
      const ownSystem = youthTeamBelongsToSeniorClub(club, senior);
      price = assignedToMe || ownSystem ? 0 : youthTransferPrice(player, modal.leagueId);
      sourceName = club.name + ' · ' + league.name;
      action = assignedToMe ? 'Вернуть в основную команду' : ownSystem ? 'Вызвать бесплатно' : 'Приобрести за ' + price.toFixed(1) + ' млн ₽';
    }
  }
  if (!player) return '<div class="modal-overlay"><div class="modal"><button class="close-btn" onclick="closeYouthPlayerCard()">✕</button><div class="subtitle">Игрок больше недоступен.</div></div></div>';
  const stats = player.stats || {};
  const assignedToMe = !!(player.youth?.parentSeniorClubId && player.youth.parentSeniorClubId === senior?.id);
  const disabled = !senior || senior.roster.length >= 30 || (player.nationality !== 'Россия' && senior.roster.filter(p => p.nationality !== 'Россия').length >= 3) || (!assignedToMe && senior.finance.balance < price);
  const attrs = Object.entries(player.attrs || {}).map(([key, value]) => '<div class="attr-row"><span>' + key + '</span><span>' + value + '</span></div>').join('');
  return '<div class="modal-overlay" onclick="if(event.target===this) closeYouthPlayerCard()"><div class="modal"><button class="close-btn" onclick="closeYouthPlayerCard()">✕</button><h1 style="font-size:22px">' + player.name + '</h1><div class="subtitle">' + player.position + ' · ' + player.age + ' лет · ' + (player.nationality || '—') + ' · ' + sourceName + '</div><div class="finance-grid" style="margin-top:12px"><div class="finance-card"><div class="fc-title">OVR</div><div class="fc-value">' + player.ovr + '</div></div><div class="finance-card"><div class="fc-title">Потенциал</div><div class="fc-value">' + (player.pot || player.ovr) + '</div></div></div><h2>Атрибуты</h2><div class="attr-grid">' + attrs + '</div><h2>Статистика</h2><div class="attr-grid"><div class="attr-row"><span>Игры</span><span>' + (stats.gp || 0) + '</span></div><div class="attr-row"><span>Голы</span><span>' + (stats.goals || 0) + '</span></div><div class="attr-row"><span>Передачи</span><span>' + (stats.assists || 0) + '</span></div><div class="attr-row"><span>Очки</span><span>' + (stats.points || 0) + '</span></div></div><div style="margin-top:16px"><button class="btn" ' + (disabled ? 'disabled' : '') + ' onclick="acquireYouthPlayerFromCard()">' + action + '</button><button class="btn secondary" onclick="closeYouthPlayerCard()">Закрыть</button></div>' + (disabled ? '<div class="subtitle" style="margin-top:8px">Проверь место в составе, лимит легионеров и баланс клуба.</div>' : '') + '</div></div>';
}
function acquireYouthPlayerFromCard() {
  const modal = G.youthPlayerModal; if (!modal) return;
  const senior = G.league.teams.find(team => team.id === G.playerTeamId);
  if (modal.source === 'academy') {
    const list = senior?.academy?.[modal.group] || []; const index = list.findIndex(player => player.id === modal.playerId);
    if (index < 0 || !senior) { showToast('Игрок больше недоступен'); closeYouthPlayerCard(); return; }
    const player = list[index];
    if (senior.roster.length >= 30) { showToast('В основном составе нет места'); return; }
    if (player.nationality !== 'Россия' && senior.roster.filter(p => p.nationality !== 'Россия').length >= 3) { showToast('Превысится лимит легионеров'); return; }
    list.splice(index, 1); player.status = 'contract'; player.contract = contractFor(player.ovr, player.age); senior.roster.push(player); senior.lines = null; if (typeof syncLines === 'function') syncLines(senior);
    showToast(player.name + ' переведён в основную команду', 'success');
  } else {
    if (modal.source === 'youth') {
      const player = G.league.youth?.leagues?.[modal.leagueId]?.teams.find(item => item.id === modal.teamId)?.roster.find(item => item.id === modal.playerId);
      if (player?.youth?.parentSeniorClubId === senior?.id) {
        const result = recallYouthPlayerToSenior(senior, modal.teamId, modal.playerId);
        if (!result.success) { showToast(result.error); return; }
        showToast(result.player.name + ' возвращён в основную команду', 'success');
      } else {
        const result = acquireYouthPlayer(senior, modal.teamId, modal.playerId);
        if (!result.success) { showToast(result.error); return; }
        showToast(result.ownSystem ? result.player.name + ' вызван из молодёжной системы' : result.player.name + ' приобретён за ' + result.price.toFixed(1) + ' млн ₽', 'success');
      }
    }
  }
  G.youthPlayerModal = null; render();
}
function setYouthLeague(leagueId) {
  if (!G.league.youth) return;
  G.league.youth.activeLeague = leagueId;
  render();
}
function renderYouthLeagues() {
  const youth = G.league.youth;
  if (!youth) return '<div class="subtitle">Молодёжные соревнования ещё не созданы.</div>';
  const leagueId = youth.activeLeague === 'RHL' ? 'RHL' : 'MHL';
  const league = youth.leagues[leagueId];
  const table = getYouthStandings(league);
  const completed = league.currentRound >= league.schedule.length;
  const progress = Math.round(league.currentRound / league.schedule.length * 100);
  let html = '<h2>Молодёжные соревнования</h2>';
  html += '<div class="inbox-filter"><button class="' + (leagueId === 'MHL' ? 'active' : '') + '" onclick="setYouthLeague(\'MHL\')">МХЛ · Молодёжный чемпионат</button><button class="' + (leagueId === 'RHL' ? 'active' : '') + '" onclick="setYouthLeague(\'RHL\')">РХЛ · Молодёжное первенство</button></div>';
  html += '<div class="subtitle">Сезон ' + league.season + ' · Тур ' + league.currentRound + ' из ' + league.schedule.length + ' · Команд: ' + league.teams.length + '</div>';
  html += '<div class="progress-bar"><div style="width:' + progress + '%"></div></div>';
  html += '<div class="subtitle">⏩ Молодёжные лиги перематываются автоматически вместе с основной лигой. Используйте кнопки «Симулировать тур» или «Симулировать сезон» в основном календаре.</div>';
  if (completed && table.length) html += '<div class="champion">🏆 Победитель регулярного чемпионата: ' + table[0].name + '</div>';
  html += '<h2>Турнирная таблица</h2><table><thead><tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>ВО</th><th>ПО</th><th>П</th><th>О</th><th>ЗШ</th><th>ЗП</th></tr></thead><tbody>';
  table.forEach((team, index) => {
    const r = team.record;
    html += '<tr><td>' + (index + 1) + '</td><td><span class="market-club-cell">' + clubLogoWithFallback(team, 24, 'youth-table-logo') + '<span>' + team.name + '</span></span></td><td>' + r.gp + '</td><td>' + r.w + '</td><td>' + r.otw + '</td><td>' + r.otl + '</td><td>' + r.l + '</td><td><b>' + r.pts + '</b></td><td>' + r.gf + '</td><td>' + r.ga + '</td></tr>';
  });
  html += '</tbody></table>';
  const rosterTeam = league.teams.find(team => String(team.id) === String(G.youthRosterTeamId)) || table[0] || league.teams[0];
  if (rosterTeam) {
    html += '<h2>Игроки команды</h2><div class="market-club-cell" style="margin:8px 0 12px">' + clubLogoWithFallback(rosterTeam, 30, 'youth-roster-logo') + '<b>' + rosterTeam.name + '</b></div><div class="inbox-filter"><select onchange="G.youthRosterTeamId=this.value;render()" style="max-width:100%">' + table.map(team => '<option value="' + team.id + '" ' + (team.id === rosterTeam.id ? 'selected' : '') + '>' + team.name + '</option>').join('') + '</select></div>' +
      '<table><thead><tr><th>Поз.</th><th>Игрок</th><th>Возраст</th><th>OVR</th><th>Пот.</th><th>И</th><th>О</th></tr></thead><tbody>' +
      rosterTeam.roster.slice().sort((a,b) => b.ovr-a.ovr).map(player => '<tr style="cursor:pointer" onclick="openYouthPlayerCard(\'youth\', null, \'' + leagueId + '\', \'' + rosterTeam.id + '\', ' + player.id + ')"><td>' + player.position + '</td><td>' + player.name + '</td><td>' + player.age + '</td><td>' + player.ovr + '</td><td>' + (player.pot || player.ovr) + '</td><td>' + (player.stats?.gp || 0) + '</td><td>' + (player.stats?.points || 0) + '</td></tr>').join('') + '</tbody></table>';
  }
  const scorers = youthTopScorers(league, 10);
  html += '<h2>Лучшие бомбардиры</h2>';
  if (!scorers.length) html += '<div class="subtitle">Статистика появится после первых матчей.</div>';
  else {
    html += '<table><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>Г</th><th>П</th><th>О</th></tr></thead><tbody>';
    scorers.forEach((player, index) => {
      html += '<tr><td>' + (index + 1) + '</td><td>' + player.name + '</td><td>' + player.teamName + '</td><td>' + player.stats.gp + '</td><td>' + player.stats.goals + '</td><td>' + player.stats.assists + '</td><td><b>' + player.stats.points + '</b></td></tr>';
    });
    html += '</tbody></table>';
  }
  const latestRound = league.results.filter(result => result.round === league.currentRound).slice(-league.teams.length / 2);
  if (latestRound.length) {
    html += '<h2>Последний тур</h2>';
    latestRound.forEach(result => {
      const home = league.teams.find(team => team.id === result.homeId);
      const away = league.teams.find(team => team.id === result.awayId);
      if (home && away) html += '<div class="game-row"><span class="away">' + away.name + '</span><span class="score">' + result.ag + ' : ' + result.hg + (result.overtime ? ' ОТ' : '') + '</span><span>' + home.name + '</span></div>';
    });
  }
  const graduates = (youth.graduates || []).slice().reverse();
  const availableGraduates = graduates.filter(item => item.status === 'available');
  html += '<h2>🎓 Выпускники молодёжных лиг (' + availableGraduates.length + ' доступны)</h2>';
  if (!graduates.length) {
    html += '<div class="subtitle">Пока нет выпускников. Игроки, достигшие предельного возраста, будут автоматически выставлены на общий рынок.</div>';
  } else {
    html += '<div style="margin-bottom:10px"><button class="btn secondary" onclick="G.activeTab=\'market\'; render();">Открыть рынок игроков</button></div>';
    html += '<table><thead><tr><th>Игрок</th><th>Возраст</th><th>Поз.</th><th>OVR</th><th>Команда</th><th>Статус</th></tr></thead><tbody>';
    graduates.slice(0, 20).forEach(item => {
      const status = item.status === 'available' ? '<span style="color:#4ade80">Доступен на рынке</span>' : 'Подписан: ' + (item.signedByTeamName || 'клуб');
      html += '<tr><td>' + item.name + '</td><td>' + item.age + '</td><td>' + item.position + '</td><td>' + item.ovr + '</td><td>' + item.formerTeamName + '</td><td>' + status + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  return html;
}

/* ============================================================
   ПОЧТА / НОВОСТИ
   ============================================================ */
function renderInbox() {
  const msgs = (G.league.inbox || []).slice().reverse();
  const filter = G.inboxFilter || 'all';
  const filtered = filter === 'all' ? msgs : msgs.filter(m => m.type === filter);
  const unread = unreadInboxCount();
  const types = [{ key: 'all', label: 'Все' }, { key: 'player', label: '👤 Игроки' }, { key: 'coach', label: '🎓 Тренер' }, { key: 'league', label: '🏒 Лига' }, { key: 'sponsor', label: '💰 Спонсор' }, { key: 'scout', label: '🔍 Скаут' }, { key: 'board', label: '🏛 Совет' }];
  let html = `<h2>📬 Почта ${unread ? `<span class="inbox-badge">${unread}</span>` : ''}</h2>`;
  html += `<div class="inbox-filter">${types.map(t => `<button class="${filter === t.key ? 'active' : ''}" onclick="G.inboxFilter='${t.key}'; render();">${t.label}</button>`).join('')}<button onclick="markAllInboxRead()">Прочитать всё</button></div>`;
  if (!filtered.length) return html + `<div class="subtitle">Сообщений нет.</div>`;
  for (const m of filtered) {
    html += `<div class="inbox-msg ${m.read ? '' : 'unread'}"><div class="msg-head"><span class="msg-from">${m.from}</span><span>Сезон ${m.season} · Тур ${m.round + 1}</span></div><div class="msg-subject">${m.subject}</div><div class="msg-body">${m.body}</div><div class="msg-actions">${(m.actions || []).map((a, i) => `<button class="primary" onclick="executeInboxAction(${m.id}, ${i})">${a.label}</button>`).join('')}${!m.read ? `<button onclick="markInboxRead(${m.id}); render();">Прочитано</button>` : ''}</div></div>`;
  }
  return html;
}
function renderNews() {
  const list = (G.league.news || []).slice().reverse();
  let html = `<h2>📰 Хроника (${list.length})</h2>`;
  if (!list.length) return html + `<div class="subtitle">Новостей нет.</div>`;
  const icons = { injury: '🚑', signing: '✍️', trade: '🔄', milestone: '⭐', streak: '🔥', retirement: '👋', academy: '🎓', event: '📰', release: '📤', career: '💼', firing: '🚫', opening_cup: '⚡', trade_deadline: '🚫', season_upset: '🎉', season_flop: '📉', upset: '🎉', disappointment: '📉', player_story: '👤', shutout: '🥅', high_scoring: '🔥', blowout: '💥', overtime: '⏱️' };
  html += `<div class="news-list">${list.map(n => `<div class="news-item imp-${n.importance || 1}"><div class="news-round">С${n.season} Т${n.round + 1}</div><div class="news-icon">${icons[n.type] || '📌'}</div><div class="news-text">${n.text}</div></div>`).join('')}</div>`;
  return html;
}

/* ============================================================
   КАРЬЕРА / СВОБОДНЫЙ АГЕНТ
   ============================================================ */
function renderCareer() {
  if (!G.playerTeamId) return renderFreeAgentScreen();
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const rep = G.career?.reputation ?? 50;
  const repColor = rep >= 70 ? '#4ade80' : rep >= 40 ? '#fbbf24' : '#ef4444';
  let html = `<h2>💼 Карьера</h2>`;
  html += `<div class="finance-grid"><div class="finance-card"><div class="fc-title">Репутация</div><div class="fc-value" style="color:${repColor}">${Math.round(rep)}/100</div><div class="reputation-bar"><div style="width:${rep}%;background:${repColor}"></div></div></div><div class="finance-card"><div class="fc-title">Сложность</div><div class="fc-value" style="font-size:16px">${G.difficulty?.label || '—'}</div><div class="fc-sub">${G.career?.noFireMode ? '🚫 Без увольнения' : 'Стандартный режим'}</div></div></div>`;
  html += `<h2>История карьеры</h2>`;
  const hist = G.career?.history || [];
  if (!hist.length) html += `<div class="subtitle">Пока пусто — заверши сезон.</div>`;
  else {
    html += `<table><thead><tr><th>Сезон</th><th>Клуб</th><th>Место</th><th>Очки</th></tr></thead><tbody>`;
    hist.forEach(h => { html += `<tr><td>${h.season}</td><td>${h.teamName}</td><td>${h.rank}</td><td>${h.pts}</td></tr>`; });
    html += `</tbody></table>`;
  }
  if (G.careerOffers && G.careerOffers.length) {
    html += `<h2>📨 Предложения на следующий сезон</h2>`;
    for (const o of G.careerOffers) {
      html += `<div class="offer-card"><div class="offer-info"><div class="offer-title">${o.label}</div><div class="offer-sub">${o.type === 'stay' ? 'Текущий клуб' : 'Новый вызов'}</div></div><button class="btn" onclick="acceptCareerOffer(${o.teamId})">Принять</button></div>`;
    }
    html += `<div style="margin-top:16px"><button class="btn secondary" onclick="stayAtCurrentTeam()">Остаться, не менять</button></div>`;
  } else {
    html += `<div style="margin-top:16px"><button class="btn danger" onclick="if(confirm('Уйти в свободные агенты? Потеряешь текущий клуб.')) becomeFreeAgent()">🚪 Уйти в свободные агенты</button></div>`;
  }
  return html;
}
function renderFreeAgentScreen() {
  const rep = G.career?.reputation ?? 50;
  if (G.league.currentRound >= G.league.schedule.length) {
    if (!G.freeAgentOffers) generateFreeAgentOffers();
    return `<div class="fa-screen"><h1>💼 Свободный агент</h1><div class="fa-hint">Сезон завершён. Репутация: <b>${Math.round(rep)}/100</b>. Вот клубы, которые ищут тренера:</div>
      ${(G.freeAgentOffers || []).map(o => {
        if (o.type === 'stay_free') return `<div class="offer-card"><div class="offer-info"><div class="offer-title">Остаться свободным агентом</div><div class="offer-sub">Ещё один сезон в ожидании</div></div><button class="btn secondary" onclick="G.freeAgentOffers=null; render();">Выбрать</button></div>`;
        return `<div class="offer-card"><div class="offer-info"><div class="offer-title">${o.teamName}</div><div class="offer-sub">Сила: ${o.strength.toFixed(2)}</div></div><button class="btn" onclick="acceptCareerOffer(${o.teamId})">Возглавить</button></div>`;
      }).join('')}
      <div style="margin-top:24px"><button class="btn danger" onclick="if(confirm('Сбросить и начать заново?')) newGame()">🔄 Новая игра</button></div>
    </div>`;
  }
  const sorted = standingsSortedByUI();
  const progress = (G.league.currentRound / G.league.schedule.length) * 100;
  return `<div class="fa-screen"><h1>💼 Свободный агент</h1><div class="fa-hint">Репутация: <b>${Math.round(rep)}/100</b>. Ты вне клуба. Следи за лигой или перемотай сезон.</div>
    <div class="progress-bar" style="max-width:600px;margin:12px auto"><div style="width:${progress}%"></div></div>
    <div style="margin:16px 0"><button class="btn" onclick="simRoundFreeAgent()">▶ Тур</button><button class="btn secondary" onclick="simSeasonFreeAgent()">⏭ Весь сезон</button></div>
  </div>
  <h2>Таблица</h2><table><thead><tr><th>#</th><th>Команда</th><th>И</th><th>О</th></tr></thead><tbody>${sorted.slice(0, 10).map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.record.w + t.record.l + t.record.otl}</td><td>${t.record.pts}</td></tr>`).join('')}</tbody></table>
  <div style="margin-top:24px"><button class="btn danger" onclick="if(confirm('Сбросить?')) newGame()">🔄 Новая игра</button></div>`;
}

/* ============================================================
   ПЛЕЙ-ОФФ
   ============================================================ */
function renderSeries(series, roundIdx) {
  if (!series.aId || !series.bId) return `<div class="series"><span style="color:#7a8299">Ожидает...</span></div>`;
  const a = G.league.teams.find(t => t.id === series.aId); const b = G.league.teams.find(t => t.id === series.bId);
  const isMe = series.aId === G.playerTeamId || series.bId === G.playerTeamId;
  const aWon = series.winnerId === series.aId, bWon = series.winnerId === series.bId;
  const gameStr = series.games.map(g => { const aIsHome = g.homeId === series.aId; return `${aIsHome ? g.hg : g.ag}-${aIsHome ? g.ag : g.hg}${g.shootout ? 'Б' : g.ot ? 'ОТ' : ''}`; }).join(', ');
  const currentGame = series.aWins + series.bWins + 1;
  const matchIndicator = !series.winnerId && isMe ? `<div class="match-indicator">Матч ${currentGame} из 7</div>` : '';
  let actions = '';
  if (!series.winnerId && isMe && roundIdx === G.league.playoffs.currentRoundIdx) {
    actions = `<div class="series-actions"><button class="btn small" onclick="simMyPlayoffMatch()">▶ Следующий матч</button><button class="btn small secondary" onclick="simPlayoffRound()">⏩ Вся серия</button></div>`;
  }
  return `<div class="series ${isMe ? 'player-series' : ''} ${series.winnerId ? 'won' : ''}"><div style="flex:1"><div class="team" style="color:${aWon ? '#4ade80' : '#e6e8ee'}">${a.name}${aWon ? '<span class="winner-mark">✓</span>' : ''}</div><div class="games-list">${gameStr || '—'}</div>${matchIndicator}</div><div class="score">${series.aWins} : ${series.bWins}</div><div style="flex:1;text-align:right" class="team"><div style="color:${bWon ? '#4ade80' : '#e6e8ee'}">${b.name}${bWon ? '<span class="winner-mark">✓</span>' : ''}</div></div></div>${actions}`;
}
function renderPlayoffs() {
  const p = G.league.playoffs;
  if (!p) { const done = G.league.currentRound >= G.league.schedule.length; if (!done) return `<div class="subtitle">Плей-офф начнётся после регулярки.</div>`; return `<div class="subtitle">Ошибка: плей-офф не создан.</div>`; }
  const done = !!p.championId;
  const regularChampion = standingsSorted()[0];
  const rc = `<div class="regular-champion">🥇 Кубок Чемпиона России: ${regularChampion.name}</div>`;
  const controls = done ? rc + `<div class="champion">🏆 Кубок Петрова: ${G.league.teams.find(t => t.id === p.championId).name}!</div><button class="btn" onclick="endSeason()">▶ Новый сезон</button>` : rc + `<button class="btn" onclick="simPlayoffRound()">⏩ Симулировать раунд</button><button class="btn secondary" onclick="simPlayoffsAll()">⏭ Весь плей-офф</button>`;
  let html = controls;
  p.rounds.forEach((round, idx) => {
    const isPast = idx < p.currentRoundIdx, isCurrent = idx === p.currentRoundIdx;
    html += `<div class="playoff-round" style="${isPast ? 'opacity:0.75' : ''}"><h3>${round.name}${isCurrent && !done ? ' · текущий' : ''}</h3>${round.series.map(s => renderSeries(s, idx)).join('')}</div>`;
  });
  return html;
}

/* ============================================================
   ИСТОРИЯ
   ============================================================ */
function renderAwards(awards) {
  if (!awards) return '<div class="subtitle">Награды не определены.</div>';
  const card = (title, a) => a ? `<div class="finance-card"><div class="fc-title">${title}</div><div class="fc-value" style="font-size:16px">${a.name}</div><div class="fc-sub">${a.team}${a.position ? ' · ' + a.position : ''}</div></div>` : '';
  return `<div class="finance-grid">${card('🏆 MVP', awards.mvp)}${card('🎯 Снайпер', awards.topScorer)}${card('🎁 Ассистент', awards.topAssister)}${card('⭐ Бомбардир', awards.topPointMan)}${card('🛡️ Защитник', awards.topDefenseman)}${card('🧤 Вратарь', awards.topGoalie)}${card('🌟 Новичок', awards.rookieOfYear)}</div>`;
}
function renderAllTimeLeaders() {
  if (!G.league.allTimeLeaders || !G.league.allTimeLeaders.skaters) return '';
  const entries = Object.values(G.league.allTimeLeaders.skaters);
  if (!entries.length) return '';
  const skaters = entries.filter(e => !e.isG); const goalies = entries.filter(e => e.isG);
  const table = (title, arr, headers, vals) => arr.length ? `<h2>${title}</h2><table><thead><tr><th>#</th><th>Игрок</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map((e, i) => `<tr><td style="color:#7a8299">${i + 1}</td><td>${e.name}</td>${vals(e).map(v => `<td class="stat-cell">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<h2>🏆 За всю историю</h2>` +
    table('🎯 Снайперы', skaters.slice().sort((a, b) => b.goals - a.goals).slice(0, 10), ['Сезонов', 'И', 'Г'], e => [e.seasons, e.gp, e.goals]) +
    table('⭐ Бомбардиры', skaters.slice().sort((a, b) => b.points - a.points).slice(0, 10), ['И', 'Г', 'А', 'О'], e => [e.gp, e.goals, e.assists, e.points]) +
    table('🧤 Вратари', goalies.slice().sort((a, b) => b.wins - a.wins).slice(0, 10), ['И', 'В', 'Сух'], e => [e.gp, e.wins, e.shutouts]);
}
function renderClubDirectory() {
  const clubs = Array.isArray(window.VHL_CLUB_DIRECTORY) ? window.VHL_CLUB_DIRECTORY : [];
  const activeCount = clubs.filter(c => c.currentTeamSlug).length;
  const historicCount = clubs.length - activeCount;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cards = clubs.map(club => {
    const rows = (club.seasons || []).slice().sort((a, b) => b.season.localeCompare(a.season));
    const bestPlace = rows.length ? Math.min(...rows.map(r => r.regularPlace)) : '—';
    const titles = rows.filter(r => r.playoffStage === 'champion' || r.seasonAward === 'winner').length;
    const last = rows[0]?.season || '—';
    const first = rows[rows.length - 1]?.season || '—';
    const aliases = (club.aliases || []).filter(name => name !== club.name);
    const status = club.currentTeamSlug ? 'current' : 'historic';
    const searchText = [club.name, club.id, ...(club.aliases || []), ...(club.historicalIds || [])].join(' ').toLowerCase();
    const seasonRows = rows.map(row => {
      const wins = row.wins + row.overtimeWins + row.shootoutWins;
      const otl = row.overtimeLosses + row.shootoutLosses;
      const stage = getTeamPlayoffLabel({playoff:row.playoffStage,seasonAward:row.seasonAward});
      return `<tr><td>${safe(row.season)}</td><td>${safe(row.clubName)}</td><td>${row.regularPlace}</td><td>${row.games}</td><td>${wins}-${row.losses}-${otl}</td><td>${row.points}</td><td>${row.goalsFor}:${row.goalsAgainst}</td><td>${safe(stage)}</td></tr>`;
    }).join('');
    return `<article class="club-directory-card" data-status="${status}" data-search="${safe(searchText)}">
      <div class="directory-card-top"><span class="directory-status ${status}">${club.currentTeamSlug ? 'Клуб в игре' : 'Исторический участник'}</span><span class="directory-seasons">${rows.length} сез.</span></div>
      <h3>${safe(club.name)}</h3>
      <div class="directory-years">${first} — ${last}</div>
      <div class="directory-metrics"><span><b>${bestPlace}</b><small>лучшее место</small></span><span><b>${titles}</b><small>титулов ВХЛ</small></span><span><b>${rows.length}</b><small>сезонов</small></span></div>
      ${aliases.length ? `<div class="directory-aliases">Названия: ${aliases.map(safe).join(' · ')}</div>` : ''}
      ${club.note ? `<div class="directory-note">${safe(club.note)}</div>` : ''}
      <details class="directory-details"><summary>Сезонная история</summary><div class="table-scroll"><table><thead><tr><th>Сезон</th><th>Название клуба</th><th>Место</th><th>И</th><th>В-П-ПО</th><th>О</th><th>Шайбы</th><th>Плей-офф</th></tr></thead><tbody>${seasonRows}</tbody></table></div></details>
    </article>`;
  }).join('');
  return `<div class="directory-intro"><div><h2>🏒 Клубы в истории ВХЛ</h2><p>Все исторические участники лиги за 16 сезонов. В одну карточку объединены только клубы с подтверждённой историей преемственности.</p></div><div class="directory-count">${clubs.length}<small>исторических карточек</small></div></div>
    <div class="directory-stats"><div><b>${clubs.length}</b><span>клубов в архиве</span></div><div><b>${activeCount}</b><span>представлены в игре</span></div><div><b>${historicCount}</b><span>другие участники</span></div><div><b>2010/11–2025/26</b><span>охват архива</span></div></div>
    <div class="directory-tools"><input id="club-directory-search" type="search" placeholder="Найти клуб или прежнее название…" oninput="filterClubDirectory(this.value)" /><select aria-label="Фильтр клубов" onchange="filterClubDirectory(document.getElementById('club-directory-search').value,this.value)"><option value="all">Все клубы</option><option value="current">Клубы текущей игры</option><option value="historic">Остальные участники</option></select><span id="club-directory-count">${clubs.length} из ${clubs.length}</span></div>
    <div class="club-directory-grid">${cards}</div>`;
}
function filterClubDirectory(query, status) {
  const statusSelect = document.querySelector('.directory-tools select');
  const selectedStatus = status || (statusSelect ? statusSelect.value : 'all');
  const term = String(query || '').trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('.club-directory-card').forEach(card => {
    const matchesText = !term || (card.dataset.search || '').includes(term);
    const matchesStatus = selectedStatus === 'all' || card.dataset.status === selectedStatus;
    const show = matchesText && matchesStatus;
    card.hidden = !show;
    if (show) visible++;
  });
  const counter = document.getElementById('club-directory-count');
  if (counter) counter.textContent = visible + ' из ' + document.querySelectorAll('.club-directory-card').length;
}
function renderHistory() {
  const hist = G.league.history || [];
  const directoryView = G.clubDirectoryView === 'directory';
  let html = `<div class="history-view-switch"><button class="btn ${!directoryView ? '' : 'secondary'}" onclick="G.clubDirectoryView='seasons';render();">История карьеры</button><button class="btn ${directoryView ? '' : 'secondary'}" onclick="G.clubDirectoryView='directory';render();">Справочник клубов ВХЛ</button></div>`;
  if (directoryView) return html + renderClubDirectory();
  if (hist.length === 0) return html + `<div class="subtitle">История карьеры пока пуста. Справочник клубов ВХЛ доступен на соседней вкладке.</div>`;
  const allTime = allTimeTeamRecords(hist);
  html += `<h2>🏆 Сводная таблица</h2><div class="table-scroll"><table><thead><tr><th>#</th><th>Команда</th><th>Сезонов</th><th>В</th><th>П</th><th>Очки</th><th>🥇</th><th>🏆</th></tr></thead><tbody>${allTime.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.seasons}</td><td>${r.w}</td><td>${r.l}</td><td style="font-weight:700">${r.pts}</td><td>${r.regular > 0 ? '🥇'.repeat(Math.min(r.regular, 3)) : '—'}</td><td>${r.cups > 0 ? '🏆'.repeat(Math.min(r.cups, 5)) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  html += renderAllTimeLeaders();
  hist.slice().reverse().forEach(h => {
    html += `<div class="season-card"><div class="head"><span class="season-num">${h.season}</span><span class="champ">🥇 ${h.regularChampionName} · 🏆 ${h.championName}${h.openingCupWinnerName ? ` · ⚡ ${h.openingCupWinnerName}` : ''}</span></div>`;
    html += `<details><summary>Награды</summary>${renderAwards(h.awards)}</details>`;
    html += `<details><summary>Таблица</summary><div class="table-scroll"><table><thead><tr><th>#</th><th>Команда</th><th>В</th><th>П</th><th>О</th></tr></thead><tbody>${h.standings.map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.w}</td><td>${t.l}</td><td>${t.pts}</td></tr>`).join('')}</tbody></table></div></details>`;
    html += `</div>`;
  });
  return html;
}

/* ============================================================
   МОДАЛКА ИГРОКА (с кнопкой реабилитации — фиксы #4/#13)
   ============================================================ */

function renderClubTransferNegotiationModal() {
  const state = G.clubTransferNegotiation;
  const found = state && findInternationalPlayer(state.playerId);
  if (!found || found.club.id !== state.clubId) {
    return '<div class="modal-overlay"><div class="modal"><p>Игрок или клуб больше недоступен.</p><button class="btn" onclick="closeClubTransferNegotiation()">Закрыть</button></div></div>';
  }
  const player = found.player, club = found.club;
  const result = state.lastResult;
  const resultHtml = result
    ? '<div class="profile-contract-row"><span>Ответ клуба</span><b>' + (result.message || 'Получен ответ') + '</b></div>' +
      (result.counteroffer ? '<div class="profile-contract-row"><span>Встречная сумма</span><b>' + result.counteroffer.fee.toFixed(1) + ' млн ₽</b></div>' : '')
    : '';
  const counterButton = result && result.decision === 'counter'
    ? '<button class="btn" onclick="acceptClubTransferCounterOffer()">Принять встречную сумму</button>' : '';
  return '<div class="modal-overlay" onclick="if(event.target===this)closeClubTransferNegotiation()"><div class="modal player-profile-modal">' +
    '<button class="close-btn" onclick="closeClubTransferNegotiation()">✕</button>' +
    '<span class="profile-eyebrow">ПЕРЕГОВОРЫ МЕЖДУ КЛУБАМИ</span><h2>' + player.name + '</h2>' +
    '<p>' + club.name + ' · ' + club.leagueName + ' · ' + player.position + ' · ' + player.ovr + ' OVR</p>' +
    '<div class="profile-contract-row"><span>Оценка трансфера</span><b>' + getInternationalTransferPrice(player, club).toFixed(1) + ' млн ₽</b></div>' +
    '<div class="profile-contract-row"><span>Ожидание клуба</span><b>' + state.demand.toFixed(1) + ' млн ₽</b></div>' +
    '<label class="profile-contract-row"><span>Ваше предложение, млн ₽</span><input type="number" min="0.5" step="0.1" value="' + Number(state.offerFee).toFixed(1) + '" onchange="updateClubTransferOffer(this.value)"></label>' +
    resultHtml + '<div class="profile-action-group"><button class="btn" onclick="submitClubTransferOffer()">Отправить предложение</button>' + counterButton +
    '<button class="btn secondary" onclick="closeClubTransferNegotiation()">Отмена</button></div>' +
    '<p class="profile-muted">Если клуб согласится, начнутся отдельные переговоры с хоккеистом о зарплате и сроке контракта.</p>' +
    '</div></div>';
}

function renderModal() {
  if (G.clubTransferNegotiation) return renderClubTransferNegotiationModal();
  if (!G.popupPlayerId) return '';
  let p = null, team = null;
  for (const t of G.league.teams) { const found = t.roster.find(x => x.id === G.popupPlayerId); if (found) { p = found; team = t; break; } }
  if (!p) p = (G.league.freeAgents || []).find(x => x.id === G.popupPlayerId);
  if (!p && typeof findInternationalPlayer === 'function') { const found = findInternationalPlayer(G.popupPlayerId); if (found) { p = found.player; team = found.club; } }
  if (!p) { G.popupPlayerId = null; return ''; }
  const isG = p.position === 'G', attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const s = ensureStats(p), ps = ensurePlayoffStats(p), career = p.careerStats || {};
  const seasons = (p.seasonHistory || []).slice().sort((a,b) => String(b.season).localeCompare(String(a.season)));
  const onBench = team && (team.bench || []).includes(p.id), isMyTeam = team && team.id === G.playerTeamId;
  const mentor = isMyTeam ? getMentor(team,p.id) : null, char = CHARACTERS[p.character] || CHARACTERS.calm;
  const contract = p.contract || {salary:0,years:0}, injured = p.injury && p.injury.gamesLeft > 0;
  const isFreeAgent = !team && (G.league.freeAgents || []).some(item => item.id === p.id);
  const badges = [];
  if (onBench) badges.push('<span class="profile-badge neutral">🪑 На скамейке</span>');
  if (injured) badges.push('<span class="profile-badge danger">🚑 Травма · '+p.injury.gamesLeft+' игр</span>');
  else if (p.fatigue > 80) badges.push('<span class="profile-badge warning">🥵 Усталость '+p.fatigue+'/100</span>');
  else if (p.fatigue < 20) badges.push('<span class="profile-badge success">⚡ Свежий</span>');
  else badges.push('<span class="profile-badge success">● В строю</span>');
  if (p.playingThroughPain && injured) badges.push('<span class="profile-badge warning">Играет через боль</span>');
  const attrRows = attrs.map(a => {
    const value = Number(p.attrs?.[a] || 0), pot = Number(p.attrPot?.[a] || value);
    return '<div class="profile-attribute"><div><span>'+ATTR_LABELS[a]+'</span><b>'+value+'<small> / '+pot+'</small></b></div><div class="profile-attribute-track"><i style="width:'+Math.max(0,Math.min(100,value))+'%"></i></div></div>';
  }).join('');
  const statTiles = isG
    ? [['МАТЧИ',s.gp],['ПОБЕДЫ',s.wins],['ПОРАЖЕНИЯ',s.losses||0],['SV%',s.shotsAgainst>0?(s.saves/s.shotsAgainst).toFixed(3).replace(/^0/,''):'—'],['КН',s.gp>0?(s.goalsAgainst/s.gp).toFixed(2):'—'],['СУХИЕ МАТЧИ',s.shutouts],['ФИКСАЦИИ ОТСКОКОВ',s.reboundCovers||0]]
    : [['МАТЧИ',s.gp],['ГОЛЫ',s.goals],['ПЕРЕДАЧИ',s.assists],['ОЧКИ',s.points],['+/-',s.plusMinus||0],['ШТРАФ',s.pim||0],['СИЛОВЫЕ',s.hits||0],['ПОЛУЧЕННЫЕ СИЛОВЫЕ',s.hitsReceived||0],['БЛОКИ',s.blocks||0],['БОРЬБА У БОРТА',(s.boardBattlesWon||0)+' / '+(s.boardBattlesLost||0)],['БОРЬБА ЗА ШАЙБУ',(s.puckBattlesWon||0)+' / '+(s.puckBattlesLost||0)],['ОТБОРЫ',s.takeaways||0],['ПЕРЕХВАТЫ ПЕРЕДАЧ',s.interceptions||0],['ВЫХОДЫ 1 НА 1',s.breakawayAttempts||0],['ПЕРЕДАЧИ НА ПЯТАК',s.slotPasses||0],['БРОСКИ С ПЯТАКА',s.slotShots||0],['ПОДБОРЫ',s.reboundRecoveries||0],['БОРЬБА ЗА ОТСКОК',(s.reboundBattlesWon||0)+' / '+(s.reboundBattlesLost||0)]];
  const playoffTiles = isG
    ? [['МАТЧИ',ps.gp],['ПОБЕДЫ',ps.wins],['SV%',ps.shotsAgainst>0?(ps.saves/ps.shotsAgainst).toFixed(3).replace(/^0/,''):'—'],['КН',ps.gp>0?(ps.goalsAgainst/ps.gp).toFixed(2):'—'],['ФИКСАЦИИ ОТСКОКОВ',ps.reboundCovers||0]]
    : [['МАТЧИ',ps.gp],['ГОЛЫ',ps.goals],['ПЕРЕДАЧИ',ps.assists],['ОЧКИ',ps.points],['СИЛОВЫЕ',ps.hits||0],['ПОЛУЧЕННЫЕ СИЛОВЫЕ',ps.hitsReceived||0],['БЛОКИ',ps.blocks||0],['БОРЬБА У БОРТА',(ps.boardBattlesWon||0)+' / '+(ps.boardBattlesLost||0)],['БОРЬБА ЗА ШАЙБУ',(ps.puckBattlesWon||0)+' / '+(ps.puckBattlesLost||0)],['ОТБОРЫ',ps.takeaways||0],['ПЕРЕХВАТЫ ПЕРЕДАЧ',ps.interceptions||0],['ВЫХОДЫ 1 НА 1',ps.breakawayAttempts||0],['ПЕРЕДАЧИ НА ПЯТАК',ps.slotPasses||0],['БРОСКИ С ПЯТАКА',ps.slotShots||0],['ПОДБОРЫ',ps.reboundRecoveries||0],['БОРЬБА ЗА ОТСКОК',(ps.reboundBattlesWon||0)+' / '+(ps.reboundBattlesLost||0)]];
  const tileGrid = items => '<div class="profile-stat-grid">'+items.map(([label,value],i)=>'<div class="profile-stat-tile'+(i===3?' accent':'')+'"><span>'+label+'</span><b>'+(value??0)+'</b></div>').join('')+'</div>';
  const totals = isG
    ? [['СЕЗОНОВ',career.seasons||seasons.length],['МАТЧИ',career.gp||0],['ПОБЕДЫ',career.wins||0],['СУХИЕ',career.shutouts||0],['ОТРАЖЁННЫЕ',career.saves||0]]
    : [['СЕЗОНОВ',career.seasons||seasons.length],['МАТЧИ',career.gp||0],['ГОЛЫ',career.goals||0],['ПЕРЕДАЧИ',career.assists||0],['ОЧКИ',career.points||0]];
  const awards = [];
  (G.league.history||[]).forEach(h=>Object.entries(h.awards||{}).forEach(([key,a])=>{
    if(a && a.name===p.name) { const labels={mvp:'Самый ценный игрок',topScorer:'Лучший снайпер',topAssister:'Лучший ассистент',topPointMan:'Лучший бомбардир',topDefenseman:'Лучший защитник',topGoalie:'Лучший вратарь',rookieOfYear:'Лучший новичок'}; awards.push({season:h.season,label:labels[key]||'Награда лиги'}); }
  }));
  const awardHtml = awards.length ? '<div class="profile-award-list">'+awards.map(a=>'<div><span>🏅</span><b>'+a.label+'</b><small>'+a.season+'</small></div>').join('')+'</div>' : '<div class="profile-empty">Пока нет индивидуальных наград в архиве лиги.</div>';
  const timeline = seasons.length ? '<div class="profile-career-timeline">'+seasons.map((row,i)=>{
    const po=row.playoffStats||{}, poText=po.gp?(isG?'Плей-офф: '+po.gp+' игр · '+(po.wins||0)+' побед':'Плей-офф: '+po.gp+' игр · '+(po.points||0)+' очков'):'';
    const regular=isG?'Регулярка: '+(row.gp||0)+' игр · '+(row.wins||0)+' побед · SV '+(row.shotsAgainst>0?(row.saves/row.shotsAgainst).toFixed(3).replace(/^0/,''):'—'):'Регулярка: '+(row.gp||0)+' игр · '+(row.goals||0)+' голов · '+(row.assists||0)+' передач · '+(row.points||0)+' очков';
    return '<article class="profile-season-row"><div class="profile-season-marker">'+(i===0?'●':'○')+'</div><div class="profile-season-main"><div class="profile-season-heading"><b>'+row.season+'</b><span>'+(row.teamName||'Клуб не указан')+'</span></div><div class="profile-season-details">'+regular+'</div>'+(poText?'<div class="profile-season-playoff">'+poText+'</div>':'')+'</div><div class="profile-season-ovr"><b>'+(row.ovr||'—')+'</b><small>OVR</small></div></article>';
  }).join('')+'</div>' : '<div class="profile-empty">История сезонов начнёт заполняться после завершения первого сезона в этой карьере.</div>';
  const sourceCareer = p.source === 'vhlru' && p.sourcePlayerId
    ? window.VHL_PLAYER_LEAGUE_HISTORY?.players?.[String(p.sourcePlayerId)]
    : null;
  const sourceCareerRowsByKey = new Map();
  (sourceCareer?.seasons || []).forEach(row => {
    const stage = row.stage === 'playoffs' ? 'playoffs' : 'regular';
    const key = [row.season, row.league, row.team, stage].join('|');
    const previous = sourceCareerRowsByKey.get(key);
    const rowScore = Object.keys(row).length;
    const previousScore = previous ? Object.keys(previous).length : -1;
    if (!previous || rowScore > previousScore ||
      (rowScore === previousScore && Number(row.gp || 0) > Number(previous.gp || 0))) {
      sourceCareerRowsByKey.set(key, row);
    }
  });
  const sourceCareerGroups = new Map();
  [...sourceCareerRowsByKey.values()].forEach(row => {
    const season = String(row.season || '');
    const league = String(row.league || '');
    const teamName = String(row.team || 'Клуб не указан');
    if (!season || !league) return;
    const key = [season, league, teamName].join('|');
    if (!sourceCareerGroups.has(key)) {
      sourceCareerGroups.set(key, { season, league, teamName, regularStats: null, playoffStats: null });
    }
    const item = sourceCareerGroups.get(key);
    const stageKey = row.stage === 'playoffs' ? 'playoffStats' : 'regularStats';
    const target = item[stageKey] || (item[stageKey] = {});
    [
      'gp', 'goals', 'assists', 'points', 'plusMinus', 'pim', 'wins', 'losses',
      'shootoutsPlayed', 'shotsOnGoal', 'shotsAgainst', 'goalsAgainst', 'saves',
      'savePercentage', 'goalsAgainstAverage', 'shutouts', 'evenStrengthGoals',
      'powerPlayGoals', 'shortHandedGoals', 'overtimeGoals', 'gameWinningGoals',
      'shootoutDecidingShots', 'hits', 'blockedShots'
    ].forEach(key => {
      if (row[key] === undefined || row[key] === null) return;
      const value = Number(row[key]);
      if (!Number.isFinite(value)) return;
      if (['savePercentage', 'goalsAgainstAverage', 'shotsPerGame', 'faceoffPercentage'].includes(key)) target[key] = value;
      else target[key] = (target[key] || 0) + value;
    });
    ['timeOnIce', 'timeOnIcePerGame'].forEach(key => {
      if (row[key] !== undefined && row[key] !== null) target[key] = row[key];
    });
  });
  const escapeCareerText = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const careerLeagueLabels = {
    NHL: 'НХЛ', AHL: 'АХЛ', KHL: 'КХЛ', VHL: 'ВХЛ', MHL: 'МХЛ',
    RHL: 'РХЛ', SHL: 'SHL', LIIGA: 'Liiga', DEL: 'DEL', ECHL: 'ECHL',
    WHA: 'WHA', NHA: 'NHA', PCHA: 'PCHA', WCHL: 'WCHL'
  };
  const sourceCareerRows = [...sourceCareerGroups.values()].sort((a,b) =>
    String(b.season).localeCompare(String(a.season), 'en', { numeric: true }) ||
    a.league.localeCompare(b.league) || a.teamName.localeCompare(b.teamName)
  );
  const sourceCareerTimeline = sourceCareerRows.length
    ? '<div class="profile-career-timeline">' + sourceCareerRows.map((row, index) => {
      const regular = row.regularStats || {}, playoffs = row.playoffStats || {};
      const formatGoalie = stats => {
        const pct = stats.shotsAgainst > 0
          ? stats.saves / stats.shotsAgainst
          : (stats.savePercentage > 1 ? stats.savePercentage / 100 : stats.savePercentage);
        return 'Регулярка: ' + (stats.gp || 0) + ' игр · ' + (stats.wins || 0) +
          ' побед · SV ' + (pct != null ? pct.toFixed(3).replace(/^0/, '') : '—');
      };
      const formatSkater = stats => 'Регулярка: ' + (stats.gp || 0) + ' игр · ' +
        (stats.goals || 0) + ' голов · ' + (stats.assists || 0) + ' передач · ' +
        (stats.points || 0) + ' очков';
      const regularText = regular.gp ? (isG ? formatGoalie(regular) : formatSkater(regular)) : '';
      const playoffText = playoffs.gp
        ? (isG
          ? 'Плей-офф: ' + playoffs.gp + ' игр · ' + (playoffs.wins || 0) + ' побед'
          : 'Плей-офф: ' + playoffs.gp + ' игр · ' + (playoffs.goals || 0) + ' голов · ' +
            (playoffs.assists || 0) + ' передач · ' + (playoffs.points || 0) + ' очков')
        : '';
      return '<article class="profile-season-row"><div class="profile-season-marker">' +
        (index === 0 ? '●' : '○') + '</div><div class="profile-season-main">' +
        '<div class="profile-season-heading"><b>' + escapeCareerText(row.season) +
        '</b><span>' + escapeCareerText(careerLeagueLabels[row.league] || row.league) +
        ' · ' + escapeCareerText(row.teamName) + '</span></div>' +
        (regularText ? '<div class="profile-season-details">' + regularText + '</div>' : '') +
        (playoffText ? '<div class="profile-season-playoff">' + playoffText + '</div>' : '') +
        '</div></article>';
    }).join('') + '</div>'
    : '';
  const sourceSeasonalGpByLeague = new Map();
  for (const row of sourceCareerRowsByKey.values()) {
    sourceSeasonalGpByLeague.set(
      row.league,
      (sourceSeasonalGpByLeague.get(row.league) || 0) + Number(row.gp || 0)
    );
  }
  const sourceCareerTotalsByLeague = new Map();
  (sourceCareer?.career || []).forEach(row => {
    const league = String(row.league || '');
    if (!league) return;
    if (!sourceCareerTotalsByLeague.has(league)) sourceCareerTotalsByLeague.set(league, { gp: 0 });
    const total = sourceCareerTotalsByLeague.get(league);
    total.gp += Number(row.gp || 0);
  });
  const matchWord = value => {
    const n = Math.abs(Number(value) || 0) % 100;
    const last = n % 10;
    return n > 10 && n < 20 ? 'матчей' : last === 1 ? 'матч' : last >= 2 && last <= 4 ? 'матча' : 'матчей';
  };
  const sourceCareerSummary = [...sourceCareerTotalsByLeague.entries()].map(([league, total]) => {
    const seasonalGp = sourceSeasonalGpByLeague.get(league) || 0;
    const extraGp = Math.max(0, total.gp - seasonalGp);
    if (!extraGp) return '';
    const detail = seasonalGp
      ? extraGp + ' ' + matchWord(extraGp) + ' сверх показанных сезонов'
      : total.gp + ' ' + matchWord(total.gp) + ' — сезонная разбивка пока недоступна';
    return '<article class="profile-season-row"><div class="profile-season-main">' +
      '<div class="profile-season-heading"><b>' +
      escapeCareerText(careerLeagueLabels[league] || league) +
      '</b><span>' + escapeCareerText(detail) + '</span></div></div></article>';
  }).filter(Boolean).join('');
  const transfers=(G.league.transferLog||[]).flatMap(e=>(e.transfers||[]).filter(t=>t.player===p.name).map(t=>({season:e.season,from:t.from,to:t.to})));
  const transferHtml=transfers.length?'<div class="profile-transfer-list">'+transfers.slice().reverse().map(t=>'<div><span>'+t.season+'</span><b>'+t.from+' → '+t.to+'</b></div>').join('')+'</div>':'<div class="profile-empty">Зафиксированных переходов между клубами пока нет.</div>';
  const canExtend=isMyTeam&&contract.years<=1&&p.status==='contract', canRelease=isMyTeam&&p.status==='contract';
  const releaseCost=Math.round(contract.salary*Math.max(0,contract.years)*.5*10)/10;
  const ownYouthTeams=isMyTeam&&p.age>=YOUTH_RULES.minAge&&p.age<=YOUTH_RULES.maxAge?getOwnYouthTeams(team):[];
  const canSendToYouth=ownYouthTeams.length>0&&p.status==='contract';
  const youthTransferButtons=ownYouthTeams.map(item => '<button class="btn secondary" onclick="handleSendToYouth('+p.id+', \''+item.team.id+'\')">🎓 Перевести в '+item.team.name+' ('+(item.league.id==='MHL'?'МХЛ':'РХЛ')+')</button>').join('');
  const canIndTraining=isMyTeam&&(G.league.currentRound-(p.lastIndTraining||-10))>=5;
  const attrButtons=canIndTraining?attrs.filter(a=>p.attrs[a]<p.attrPot[a]).map(a=>'<button class="btn small secondary" onclick="handleIndTraining('+p.id+', \''+a+'\')">'+ATTR_LABELS[a]+'</button>').join(''):'';
  const canRehab=isMyTeam&&injured&&(G.league.currentRound-(team.lastRehabRound||-10))>=5, rehabCost=Math.min(3,p.injury?p.injury.gamesLeft:0);
  const goalHtml=p.seasonGoal?'<div class="profile-goal"><span>🎯 '+p.seasonGoal.description+'</span><b>'+(p.seasonGoal.achieved===true?'ВЫПОЛНЕНО ✓':p.seasonGoal.achieved===false?'НЕ ВЫПОЛНЕНО':'В ПРОЦЕССЕ')+'</b></div>':'';
  return '<div class="modal-overlay profile-overlay" onclick="if(event.target===this){G.contractNegotiation=null;G.popupPlayerId=null;render();}"><div class="modal player-profile-modal"><button class="close-btn" onclick="G.contractNegotiation=null;G.popupPlayerId=null;render();">✕</button>'+
    '<div class="profile-hero"><div class="profile-hero-main"><span class="profile-eyebrow">ПРОФИЛЬ ХОККЕИСТА</span><div class="profile-name-line"><h1>'+p.name+'</h1><span class="char-badge '+char.cls+'">'+char.label+'</span></div><p>'+(team?team.name:'Свободный агент')+' · '+p.nationality+' · '+p.age+' лет</p><div class="profile-badges">'+badges.join('')+'</div></div><div class="profile-overall"><strong>'+p.ovr+'</strong><span>ОБЩИЙ РЕЙТИНГ</span><small>Потенциал '+p.pot+'</small></div></div>'+
    '<div class="profile-quick-stats"><div><span>ПОЗИЦИЯ</span><b>'+(isG?'Вратарь':p.position==='D'?'Защитник':'Нападающий')+'</b></div><div><span>ФОРМА</span><b>'+p.form+'/100</b></div><div><span>МОРАЛЬ</span><b>'+p.morale+'/100</b></div><div><span>ЭФФЕКТИВНЫЙ OVR</span><b>'+getEffectiveOvr(p)+'</b></div></div>'+
    '<div class="profile-columns"><div class="profile-column">'+
    '<section class="profile-section"><span class="profile-eyebrow">НАВЫКИ</span><h2>Игровые атрибуты</h2><div class="profile-attributes">'+attrRows+'</div></section>'+
    '<section class="profile-section"><span class="profile-eyebrow">ТЕКУЩИЙ СЕЗОН</span><h2>Регулярный чемпионат</h2>'+tileGrid(statTiles)+'<h2 class="profile-subheading">Плей-офф</h2>'+tileGrid(playoffTiles)+'</section>'+
    '<section class="profile-section"><span class="profile-eyebrow">КАРЬЕРА</span><h2>Суммарная статистика</h2>'+tileGrid(totals)+'</section>'+
    (sourceCareerTimeline ? '<section class="profile-section"><span class="profile-eyebrow">РЕАЛЬНАЯ КАРЬЕРА</span><h2>Сезоны до начала игры</h2>'+sourceCareerTimeline+'</section>' : '')+
    (sourceCareerSummary ? '<section class="profile-section"><span class="profile-eyebrow">ДРУГИЕ ЛИГИ</span><h2>Карьерные итоги без разбивки по сезонам</h2><p class="profile-note">Это подтверждённые общие итоги; сезонные строки для этих матчей пока не найдены.</p>'+sourceCareerSummary+'</section>' : '')+    '<section class="profile-section"><span class="profile-eyebrow">ПУТЬ ИГРОКА</span><h2>История сезонов</h2>'+timeline+'</section>'+
    '<section class="profile-section"><span class="profile-eyebrow">ПЕРЕМЕЩЕНИЯ</span><h2>История переходов</h2>'+transferHtml+'</section>'+
    '<section class="profile-section"><span class="profile-eyebrow">ДОСТИЖЕНИЯ</span><h2>Индивидуальные награды</h2>'+awardHtml+'</section></div>'+
    '<aside class="profile-side-column"><section class="profile-section profile-contract"><span class="profile-eyebrow">СОГЛАШЕНИЕ</span><h2>Контракт</h2><div class="profile-contract-value"><b>'+Number(contract.salary||0).toFixed(1)+'</b><span>млн ₽ / сезон</span></div><div class="profile-contract-row"><span>Срок</span><b>'+(contract.years||0)+' лет</b></div><div class="profile-contract-row"><span>Статус</span><b>'+(p.status==='contract'?'Действует':p.status==='ufa'?'Свободный агент':p.status)+'</b></div>'+
    (canExtend?'<div class="profile-action-group"><button class="btn" onclick="openPlayerContractNegotiation('+p.id+', \'renewal\')">Начать переговоры о продлении</button></div>':'')+
    (isFreeAgent?'<div class="profile-action-group"><button class="btn" onclick="openPlayerContractNegotiation('+p.id+', \'signing\')">Предложить контракт</button></div>':'')+
    (canRelease?'<div class="profile-action-group"><button class="btn danger" onclick="handleRelease('+p.id+')">Расторгнуть · '+releaseCost.toFixed(1)+' млн ₽</button></div>':'')+'</section>'+
    (isMyTeam?renderPlayerConversationPanel(p,team):'')+
    (G.contractNegotiation&&G.contractNegotiation.playerId===p.id?renderContractNegotiationPanel(p,team):'')+
    (goalHtml?'<section class="profile-section"><span class="profile-eyebrow">ЛИЧНАЯ ЦЕЛЬ</span><h2>Задача на сезон</h2>'+goalHtml+'</section>':'')+
    (mentor?'<section class="profile-section"><span class="profile-eyebrow">РАЗВИТИЕ</span><h2>Наставник</h2><p class="profile-mentor">🎓 '+mentor.name+'</p></section>':'')+
    (canIndTraining&&attrButtons?'<section class="profile-section"><span class="profile-eyebrow">ТРЕНИРОВКИ</span><h2>Индивидуальная работа</h2><p class="profile-muted">0,5 млн ₽ · раз в 5 туров</p><div class="profile-action-group profile-training-actions">'+attrButtons+'</div></section>':'')+
    (canRehab?'<section class="profile-section"><span class="profile-eyebrow">МЕДИЦИНА</span><h2>Реабилитация</h2><p class="profile-muted">Восстановление за '+rehabCost+' млн ₽</p><button class="btn" onclick="handleRehab('+p.id+',3)">🏥 Реабилитация</button></section>':'')+
    (canSendToYouth?'<section class="profile-section"><span class="profile-eyebrow">АКАДЕМИЯ</span><h2>Молодёжная команда</h2><div class="profile-action-group">'+youthTransferButtons+'</div></section>':'')+
    '</aside></div></div></div>';
}


function renderPlayerConversationPanel(player, team) {
  const state = getLockerRoomState(team);
  const pending = state.meetings.find(item => item.playerId === player.id);
  const cooldown = getPlayerTalkCooldown(player);
  const topics = Object.entries(LOCKER_ROOM_TOPICS);
  const delayControl = '<label class="locker-meeting-delay"><span>Запланировать на</span><select id="locker-delay-'+player.id+'"><option value="1">Следующий тур</option><option value="2">Через 2 тура</option><option value="3">Через 3 тура</option></select></label>';
  const topicRows = topics.map(([key, topic]) =>
    '<div class="locker-topic-row"><div class="locker-topic-copy"><b>'+topic.label+'</b><small>'+topic.description+'</small></div><div class="locker-topic-actions">'+
    '<button class="btn small secondary" '+(cooldown || pending ? 'disabled' : '')+' onclick="talkToPlayer('+player.id+', \''+key+'\')">Поговорить</button>'+
    '<button class="btn small" '+(cooldown || pending ? 'disabled' : '')+' onclick="schedulePlayerMeeting('+player.id+',\''+key+'\',Number(document.getElementById(\'locker-delay-'+player.id+'\').value))">Назначить</button></div></div>'
  ).join('');
  const meetingInfo = pending
    ? '<p class="locker-meeting-status">Встреча назначена на тур '+(pending.scheduledRound+1)+'. Тема: '+LOCKER_ROOM_TOPICS[pending.topic].label+'.</p>'
    : cooldown
      ? '<p class="profile-muted">Следующий личный разговор доступен через '+cooldown+' тур.</p>'
      : delayControl;
  return '<section class="profile-section profile-contract locker-conversation"><span class="profile-eyebrow">РАЗДЕВАЛКА</span><h2>Личный разговор</h2>'+
    '<p class="profile-muted">Мораль '+player.morale+'/100 · форма '+player.form+'/100. Повторный разговор — не чаще одного раза в 3 тура.</p>'+
    '<div class="locker-topic-list">'+topicRows+'</div>'+meetingInfo+'</section>';
}
function renderLockerRoom() {
  const team = getLockerRoomTeam();
  if (!team) return '<div class="subtitle">Команда не найдена.</div>';
  const state = getLockerRoomState(team);
  const averageMorale = team.roster.length ? Math.round(team.roster.reduce((sum, player) => sum + (Number(player.morale)||0), 0) / team.roster.length) : 0;
  const lowMorale = team.roster.slice().sort((a,b) => (a.morale||0)-(b.morale||0)).slice(0,8);
  const meetings = state.meetings.slice().sort((a,b) => a.scheduledRound-b.scheduledRound);
  const requests = state.requests.filter(item => item.status === 'pending').sort((a,b) => a.deadlineRound-b.deadlineRound);
  const requestRows = requests.length ? requests.map(request => {
    const definition = LOCKER_ROOM_REQUESTS[request.type];
    const player = team.roster.find(item => item.id === request.playerId);
    const other = team.roster.find(item => item.id === request.otherPlayerId);
    const title = definition?.title || 'Обращение игрока';
    const names = [player?.name || request.playerName, other?.name || request.otherPlayerName].filter(Boolean).join(' и ');
    const buttons = Object.entries(definition?.choices || {}).map(([decision,label]) =>
      '<button class="btn small secondary" onclick="resolveLockerRoomRequest('+request.id+',\''+decision+'\')">'+label+'</button>'
    ).join('');
    return '<article class="finance-card locker-request-card"><div class="fc-title">'+title+'</div><div class="fc-sub">'+names+' · ответить до тура '+(request.deadlineRound+1)+'</div><div class="profile-action-group">'+buttons+'</div></article>';
  }).join('') : '<div class="subtitle">Новых обращений нет. Игроки могут сами попросить о встрече, поддержке или пересмотре своей роли.</div>';
  const meetingRows = meetings.length ? meetings.map(meeting => {
    const player = team.roster.find(item => item.id === meeting.playerId);
    return '<div class="dev-row"><div class="dr-info"><div class="dr-name">'+(player?.name||meeting.playerName)+'</div><div class="dr-meta">'+LOCKER_ROOM_TOPICS[meeting.topic].label+' · тур '+(meeting.scheduledRound+1)+'</div></div><button class="btn small danger" onclick="cancelPlayerMeeting('+meeting.id+')">Отменить</button></div>';
  }).join('') : '<div class="subtitle">Назначенных встреч пока нет. Открой профиль хоккеиста, чтобы запланировать беседу.</div>';
  const eventCooldown = Math.max(0, 5-(G.league.currentRound-state.lastTeamEventRound));
  const eventCards = Object.entries(LOCKER_ROOM_TEAM_EVENTS).map(([key,event]) => {
    const cooldown = event.cooldown-(G.league.currentRound-state.lastTeamEventRound);
    const locked = cooldown>0 || (event.requiresPsychologist&&!team.staff?.psychologist) || team.finance.balance<event.cost;
    const note = event.requiresPsychologist&&!team.staff?.psychologist ? 'Нужен психолог в штабе' : cooldown>0 ? 'Доступно через '+cooldown+' тур.' : event.cost ? 'Стоимость: '+event.cost.toFixed(1)+' млн ₽' : 'Бесплатно';
    return '<article class="finance-card locker-event-card"><div class="fc-title">'+event.label+'</div><div class="fc-sub">'+event.description+'</div><div class="fc-sub">'+note+'</div><button class="btn small" '+(locked?'disabled':'')+' onclick="holdLockerRoomEvent(\''+key+'\')">Провести</button></article>';
  }).join('');
  const playerRows = lowMorale.map(player => '<div class="dev-row"><div class="dr-info"><div class="dr-name"><a class="locker-attention-link" href="#" onclick="event.preventDefault();G.popupPlayerId='+player.id+';render();">'+player.name+'</a></div><div class="dr-meta">'+player.position+' · '+player.age+' лет · форма '+player.form+'/100</div></div><b class="'+(player.morale<45?'danger-text':player.morale<60?'warning-text':'')+'">☺ '+player.morale+'</b></div>').join('');
  const lastEvent = state.lastTeamEvent ? '<p class="subtitle">Последнее мероприятие: '+(LOCKER_ROOM_TEAM_EVENTS[state.lastTeamEvent.key]?.label||state.lastTeamEvent.key)+' · тур '+(state.lastTeamEvent.round+1)+'</p>' : '';
  return '<div class="locker-room-page"><h2>Раздевалка команды</h2>'+
    '<div class="finance-grid"><div class="finance-card"><div class="fc-title">Средняя мораль</div><div class="fc-value">'+averageMorale+'/100</div><div class="fc-sub">В составе '+team.roster.length+' хоккеистов</div></div><div class="finance-card"><div class="fc-title">Запланированные встречи</div><div class="fc-value">'+meetings.length+'</div><div class="fc-sub">Личные беседы с игроками</div></div><div class="finance-card"><div class="fc-title">Командные мероприятия</div><div class="fc-value">'+(eventCooldown>0?'Через '+eventCooldown+' тур.':'Доступно')+'</div><div class="fc-sub">Пауза между мероприятиями</div></div></div>'+
    '<h2>Обращения игроков</h2><div class="finance-grid">'+requestRows+'</div>'+
    '<h2>Личные встречи</h2><div class="dev-list">'+meetingRows+'</div>'+
    '<h2>Командные мероприятия</h2><div class="finance-grid">'+eventCards+'</div>'+lastEvent+
    '<h2>Кому нужно внимание</h2><div class="dev-list">'+(playerRows||'<div class="subtitle">Состав пуст.</div>')+'</div>'+
    '<p class="profile-muted">Личные разговоры доступны в профиле каждого хоккеиста. Результат зависит от его формы, морали, роли и характера. Повторные разговоры и мероприятия ограничены по времени.</p></div>';
}
function renderContractNegotiationPanel(player, team) {
  const state = G.contractNegotiation;
  if (!state || state.playerId !== player.id) return '';
  const mode = state.mode === 'renewal' ? 'Продление контракта' : 'Предложение свободному агенту';
  const negotiationTeam = G.league?.teams?.find(item => item.id === G.playerTeamId) || team;
  const demand = getPlayerContractDemand(player, negotiationTeam, state.mode);
  const result = state.lastResult;
  const preferences = demand.preferences || getPlayerContractPreferences(player);
  const priorities = [
    ['Зарплата', preferences.money], ['Игровая роль', preferences.role],
    ['Борьба за титулы', preferences.winning], ['Верность клубу', preferences.loyalty],
    ['Долгосрочная стабильность', preferences.security]
  ].sort((a,b) => b[1]-a[1]).slice(0,3).map(item => item[0]).join(' · ');
  const resultHtml = result
    ? '<div class="profile-contract-row"><span>Ответ игрока</span><b>' + (result.message || 'Получен ответ') + '</b></div>' +
      (result.counteroffer ? '<div class="profile-contract-row"><span>Встречное предложение</span><b>' + result.counteroffer.salary.toFixed(1) + ' млн ₽ · ' + result.counteroffer.years + ' лет</b></div>' : '')
    : '';
  const counterButton = result && result.decision === 'counter' && !state.completed
    ? '<button class="btn" onclick="acceptPlayerCounterOffer()">Принять встречные условия</button>' : '';
  const roundLabel = '<p class="profile-muted">Раунд ' + (Number(state.round)||0) + ' из ' + (Number(state.maxRounds)||3) + ' · приоритеты игрока: ' + priorities + '</p>';
  const controls = state.completed
    ? '<p class="profile-muted">Соглашение оформлено.</p>'
    : state.closed
      ? '<p class="profile-muted">Игрок завершил переговоры и пока не готов возвращаться к обсуждению.</p>'
      : (Number(state.round)||0) >= (Number(state.maxRounds)||3)
        ? '<p class="profile-muted">Последнее встречное предложение игрока. Его можно принять или завершить переговоры.</p><div class="profile-action-group">' + counterButton + '</div>'
        : '<label class="profile-contract-row"><span>Зарплата, млн ₽ за сезон</span><input type="number" min="0.5" max="99" step="0.1" value="' + state.offer.salary.toFixed(1) + '" onchange="updatePlayerContractOffer(\'salary\',this.value)"></label>' +
          '<label class="profile-contract-row"><span>' + (state.mode === 'renewal' ? 'Добавить лет' : 'Срок контракта, лет') + '</span><select onchange="updatePlayerContractOffer(\'years\',this.value)">' +
          [1,2,3,4,5].filter(years => state.mode !== 'renewal' || years <= Math.max(1,5-(Number(player.contract?.years)||0))).map(years => '<option value="' + years + '"' + (Number(state.offer.years) === years ? ' selected' : '') + '>' + years + '</option>').join('') +
          '</select></label>' +
          '<div class="profile-action-group"><button class="btn" onclick="submitPlayerContractNegotiation()">Отправить предложение</button>' + counterButton + '</div>';
  return '<section class="profile-section profile-contract"><span class="profile-eyebrow">ПЕРЕГОВОРЫ</span><h2>' + mode + '</h2>' +
    '<p class="profile-muted">Ожидания игрока: около ' + demand.salary.toFixed(1) + ' млн ₽ за сезон · желаемый срок ' + demand.years + ' лет</p>' + roundLabel +
    controls + resultHtml +
    '<div class="profile-action-group"><button class="btn secondary" onclick="closePlayerContractNegotiation()">Закрыть переговоры</button></div></section>';
}

function handleExtend(playerId, years) { const r = extendContract(playerId, years); if (r.success) showToast(`Продлено! ЗП: ${r.salary} млн на ${years} лет`); else if (r.reason === 'contract too long') showToast('Контракт длинный'); else showToast(`Отказ. Запрос: ${r.salary} млн`); render(); }
function handleRehab(playerId, games) { const r = rehabPlayer(playerId, games); if (r.success) showToast(`Реабилитация: ${r.gamesSkipped} игр. Стоимость: ${r.cost} млн`); else showToast('Ошибка: ' + r.error); render(); }
function handleIndTraining(playerId, attr) { const r = individualTraining(playerId, attr); if (r.success) showToast(`+1 к ${ATTR_LABELS[r.attr]}`); else showToast('Ошибка: ' + r.error); render(); }
function handleRelease(playerId) { if (!confirm('Точно разорвать контракт? Компенсация 50% остатка зарплаты.')) return; const r = releasePlayer(playerId); if (r.success) showToast(`Расторгнуто. Компенсация: ${r.cost} млн`); else showToast('Ошибка: ' + r.error); G.popupPlayerId = null; render(); }
function handleSendToYouth(playerId, youthTeamId = null) {
  const team = G.league.teams.find(item => item.id === G.playerTeamId);
  const result = sendSeniorPlayerToYouth(team, playerId, youthTeamId);
  if (!result.success) { showToast(result.error); return; }
  G.popupPlayerId = null;
  showToast(result.player.name + ' переведён в ' + result.youthTeam.name, 'success');
  render();
}
function extendContract(playerId, years) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, reason: 'not found' };
  if (p.contract.years > 1) return { success: false, reason: 'contract too long' };
  const marketSalary = contractFor(p.ovr, p.age).salary;
  const offeredSalary = Math.max(p.contract.salary, marketSalary);
  const moraleFactor = (p.morale - 40) / 100;
  const ageFactor = p.age > 33 ? -0.2 : 0.1;
  if (rng() < clamp(0.5 + moraleFactor * 0.5 + ageFactor, 0.05, 0.95)) {
    p.contract.years += years; p.contract.salary = Math.round(offeredSalary * 10) / 10;
    p.morale = Math.min(100, p.morale + 3);
    return { success: true, salary: p.contract.salary, years };
  }
  p.morale = Math.max(20, p.morale - 5);
  return { success: false, salary: offeredSalary };
}

/* ============================================================
   МОДАЛКА КОМАНДЫ
   ============================================================ */
function getTeamHistoricalRows(team) {
  // Здесь перечислены подтверждённые исторические идентификаторы клубов.
  // Динамо СПб остаётся отдельным клубом; история Динамо МО не смешивается с ним.
  // История СКА-ВМФ включает ХК ВМФ, ВМФ-Карелию, СКА-Карелию и СКА-Неву.
  const historicalIdsBySlug = {
    akm: ['akm-tula'],
    bars: ['bars-kazan'],
    buran: ['buran-voronezh'],
    gornyak: ['gornyak-uchaly'],
    dizel: ['dizel-penza'],
    'dinamo-spb': ['dynamo-spb', 'dynamo-saint-petersburg'],
    'dinamo-altai': ['dynamo-altai'],
    zauralye: ['zauralye-kurgan'],
    zvezda: ['zvezda-chekhov', 'zvezda-moscow'],
    izhstal: ['izhstal-izhevsk'],
    kristall: ['kristall-saratov'],
    magnitka: ['magnitka-magnitogorsk'],
    metallurg: ['metallurg-novokuznetsk'],
    molot: ['molot-perm', 'molot-prikamye-perm'],
    neftyanik: ['neftyanik-almetyevsk'],
    norilsk: ['norilsk'],
    olimpiya: ['olimpiya-kirovo-chepetsk'],
    'omskie-krylya': ['omskie-krylya-omsk'],
    rubin: ['rubin-tyumen'],
    'ryazan-vdv': ['ryazan', 'hk-ryazan'],
    'ska-vmf': ['khk-vmf', 'vmf-karelia', 'ska-karelia-kondopoga', 'ska-neva', 'ska-vmf'],
    sokol: ['sokol-krasnoyarsk'],
    tambov: ['tambov'],
    toros: ['toros-neftekamsk'],
    khimik: ['khimik-voskresensk'],
    'csk-vvs': ['csk-vvs-samara'],
    chelmet: ['mechel-chelyabinsk', 'chelmet-chelyabinsk'],
    yugra: ['yugra-khanty-mansiysk'],
    'yuzhny-ural': ['yuzhny-ural', 'yuzhny-ural-orsk']
  };
  const ids = historicalIdsBySlug[team.slug] || [];
  const seasons = Array.isArray(window.VHL_SEASON_RESULTS) ? window.VHL_SEASON_RESULTS : [];
  const archivedRows = [];
  for (const seasonData of seasons) {
    for (const row of (seasonData.teams || [])) {
      if (!ids.includes(row.historicalId)) continue;
      archivedRows.push({
        season: seasonData.season,
        clubName: row.clubName,
        place: row.regularPlace,
        w: row.wins + row.overtimeWins + row.shootoutWins,
        l: row.losses,
        otl: row.overtimeLosses + row.shootoutLosses,
        pts: row.points,
        gf: row.goalsFor,
        ga: row.goalsAgainst,
        playoff: row.playoffStage,
        playoffOpponent: row.playoffOpponent || null,
        seriesScore: row.seriesScore || null,
        seasonAward: row.seasonAward || null,
        source: 'archive'
      });
    }
  }
  const archivedSeasons = new Set(archivedRows.map(row => row.season));
  const careerRows = (Array.isArray(team.history) ? team.history : [])
    .filter(row => !archivedSeasons.has(row.season))
    .map(row => ({ ...row, clubName: team.name, source: 'career' }));
  return archivedRows.concat(careerRows).sort((a, b) => String(b.season).localeCompare(String(a.season)));
}

function getTeamPlayoffLabel(row) {
  const seasonAwards = {
    winner: '🥇 победитель Всероссийского соревнования',
    silver: '🥈 серебряный призёр Всероссийского соревнования',
    bronze: '🥉 бронзовый призёр Всероссийского соревнования'
  };
  if (seasonAwards[row.seasonAward]) {
    const stopped = row.playoff === 'quarterfinal_unfinished' ? '; плей-офф остановлен на стадии 1/4 финала' : '';
    return seasonAwards[row.seasonAward] + stopped;
  }
  const labels = {
    champion: '🏆 обладатель Кубка Петрова',
    finalist: 'финалист',
    semifinal: '1/2 финала',
    championship_semifinal: '1/2 финала',
    quarterfinal: '1/4 финала',
    championship_quarterfinal: '1/4 финала',
    conference_finalist: 'финал конференции',
    conference_semifinal: '1/2 финала конференции',
    conference_quarterfinal: '1/4 финала конференции',
    round16: '1/8 финала',
    quarterfinal_unfinished: '1/4 финала — сезон остановлен',
    playoff_participant: 'участник плей-офф',
    missed: 'не вышел в плей-офф',
    season_winner: 'победитель сезона',
    season_silver: 'серебряный призёр сезона'
  };
  return labels[row.playoff] || '—';
}

function renderTeamModal() {
  if (!G.viewTeamId) return '';
  const team = G.league.teams.find(t => t.id === G.viewTeamId);
  if (!team) { G.viewTeamId = null; return ''; }
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const hasScout = myTeam && !!myTeam.staff.scout;
  const canSeeExtra = hasScout || team.id === G.playerTeamId;
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const totalSalary = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const r = getTeamRatings(team);
  const trendDef = { up: { icon: '↗', label: 'Растёт', color: '#4ade80' }, down: { icon: '↘', label: 'Падает', color: '#ef4444' }, stable: { icon: '→', label: 'Стабильно', color: '#9aa3b8' }, newcomer: { icon: '🆕', label: 'Новичок лиги', color: '#60a5fa' } };
  const trend = trendDef[team.trend] || trendDef.stable;
  const initials = getInitials(team.name);
  const logoHtml = team.logo
    ? `<img src="${team.logo}" class="team-logo-big" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="team-logo-fallback" style="display:none">${initials}</div>`
    : `<div class="team-logo-fallback">${initials}</div>`;
  const historicalRows = getTeamHistoricalRows(team);
  const historyRows = historicalRows.length
    ? historicalRows.map(h => `<tr><td>${h.season}</td><td>${h.clubName || team.name}</td><td style="font-weight:700">${h.place ?? '—'}</td><td>${h.w ?? '—'}-${h.l ?? '—'}-${h.otl ?? '—'}</td><td>${h.pts ?? '—'}</td><td>${h.gf ?? '—'}:${h.ga ?? '—'}</td><td>${getTeamPlayoffLabel(h)}${h.playoffOpponent ? `<div class="subtitle" style="font-size:11px">соперник: ${h.playoffOpponent}${h.seriesScore ? ` (${h.seriesScore})` : ''}</div>` : ''}</td></tr>`).join('')
    : `<tr><td colspan="7" style="color:#7a8299">История клуба пока отсутствует в архиве ВХЛ</td></tr>`;
  const trophyRow = (label, arr) => arr && arr.length ? `<div class="attr-row"><span>${label}</span><span style="color:#fbbf24">${arr.join(', ')}</span></div>` : `<div class="attr-row"><span>${label}</span><span style="color:#7a8299">—</span></div>`;
  const trophiesHtml = `<div class="attr-grid">${trophyRow('🏆 Главный трофей ВХЛ', team.trophies.petrov)}${trophyRow('🥇 Регулярка', team.trophies.regular)}${trophyRow('🏅 Победитель сезона', team.trophies.seasonWins)}${trophyRow('🥈 Серебряный призёр сезона', team.trophies.seasonSilvers)}${trophyRow('🥉 Бронзовый призёр сезона', team.trophies.seasonBronzes)}${trophyRow('⚡ Матч Открытия', team.trophies.opening)}${trophyRow('🥈 Финалы', team.trophies.finals)}</div>`;
  let topPlayersHtml = `<div class="subtitle" style="font-size:12px">Нет данных</div>`;
  if (G.league.allTimeLeaders && G.league.allTimeLeaders.skaters) {
    const all = Object.values(G.league.allTimeLeaders.skaters);
    const top = all.filter(p => !p.isG).sort((a, b) => b.points - a.points).slice(0, 5);
    if (top.length) topPlayersHtml = `<table><thead><tr><th>#</th><th>Игрок</th><th>И</th><th>О</th></tr></thead><tbody>${top.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td class="stat-cell">${e.gp}</td><td class="stat-cell" style="color:#ff6b35;font-weight:700">${e.points}</td></tr>`).join('')}</tbody></table>`;
  }
  const rivalsHtml = team.rivals && team.rivals.length ? team.rivals.map(name => `<span class="status-badge" style="margin-right:6px;margin-bottom:4px">${name}</span>`).join('') : `<span class="tag">Исторических соперников нет</span>`;
  const talentHtml = `<div class="attr-grid"><div class="attr-row"><span>Talent (состав)</span><span style="color:#4ade80;font-weight:700">${(team.talent || 70).toFixed(1)}</span></div><div class="attr-row"><span>Prestige (репутация)</span><span style="color:#fbbf24;font-weight:700">${team.prestige || 50}</span></div><div class="attr-row"><span>ATT</span><span>${r.att}</span></div><div class="attr-row"><span>DEF</span><span>${r.def}</span></div><div class="attr-row"><span>GK</span><span>${r.gk}</span></div><div class="attr-row"><span>ST</span><span>${r.st}</span></div></div>`;
  const financeHtml = canSeeExtra ? `<h2>Финансы</h2><div class="attr-grid"><div class="attr-row"><span>Бюджет</span><span>${team.finance.seasonBudget} млн ₽</span></div><div class="attr-row"><span>ЗП игроков</span><span>${Math.round(totalSalary)} млн ₽</span></div><div class="attr-row"><span>Потолок</span><span>${team.finance.salaryCap} млн ₽</span></div><div class="attr-row"><span>Арена</span><span>${team.finance.arenaCapacity.toLocaleString()}</span></div><div class="attr-row"><span>Фанбаза</span><span>${(team.finance.fanBase * 100).toFixed(0)}%</span></div><div class="attr-row"><span>Ур. арены</span><span>${team.arenaLevel}/5</span></div></div>` : `<div class="subtitle" style="margin-top:12px">💡 Найми скаута, чтобы видеть финансы соперника</div>`;
  const playerRow = (p) => {
    const s = ensureStats(p); const isG = p.position === 'G';
    const sv = s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—';
    const gaa = s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const statsCells = isG ? `<td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.wins}</td><td class="stat-cell">${sv}</td><td class="stat-cell">${gaa}</td>` : `<td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.goals}</td><td class="stat-cell">${s.assists}</td><td class="stat-cell">${s.points}</td>`;
    const health = (p.injury && p.injury.gamesLeft > 0) ? ' 🚑' : '';
    return `<tr><td><span class="pos ${isG ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}${health} <span class="char-badge ${char.cls}">${char.label}</span></td><td>${p.age}</td><td class="ovr ${p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'}">${p.ovr}</td>${statsCells}</tr>`;
  };
  const skaters = team.roster.filter(p => p.position !== 'G').sort((a,b) => b.ovr - a.ovr);
  const goalies = team.roster.filter(p => p.position === 'G').sort((a,b) => b.ovr - a.ovr);
  const rosterHtml = canSeeExtra ? `<h2>Состав (${skaters.length} + ${goalies.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>Г/В</th><th>А/SV%</th><th>О/КН</th></tr></thead><tbody>${skaters.slice(0, 12).map(playerRow).join('')}${goalies.map(playerRow).join('')}</tbody></table>` : '';
  return `<div class="modal-overlay" onclick="if(event.target===this){G.viewTeamId=null; render();}">
    <div class="modal">
      <button class="close-btn" onclick="G.viewTeamId=null; render();">✕</button>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
        ${logoHtml}
        <div style="flex:1">
          <h1 style="font-size:24px;margin-bottom:4px">${team.name}</h1>
          <div class="subtitle" style="margin-bottom:8px">${team.city} · ${team.region} · #${rank} в таблице</div>
          <span class="trend-badge" style="background:${trend.color}22;color:${trend.color}">${trend.icon} ${trend.label}</span>
        </div>
      </div>
      <h2>Сила</h2>${talentHtml}
      ${financeHtml}
      <h2>История выступлений</h2>
      <table><thead><tr><th>Сезон</th><th>Название клуба</th><th>Место</th><th>В-П-ПО</th><th>Очки</th><th>Шайбы</th><th>Плей-офф</th></tr></thead><tbody>${historyRows}</tbody></table>
      <h2>Трофеи</h2>${trophiesHtml}
      <h2>Лучшие игроки (всего)</h2>${topPlayersHtml}
      <h2>Исторические соперники</h2><div>${rivalsHtml}</div>
      ${rosterHtml}
    </div>
  </div>`;
}

/* ============================================================
   МОДАЛКИ: ПРЕСС / ТРАВМЫ / МАТЧ ОТКРЫТИЯ
   ============================================================ */
function renderPressConferenceModal() {
  if (!G.pressConference) return '';
  const pc = G.pressConference; const q = pc.questions[pc.current];
  if (!q) { G.pressConference = null; return ''; }
  return `<div class="modal-overlay"><div class="modal"><h1 style="font-size:20px">📰 Пресс-конференция</h1><div class="subtitle">Вопрос ${pc.current + 1} из ${pc.questions.length}</div><div class="press-question"><div class="pq-text">${q.q}</div>${q.answers.map((a, i) => `<button class="press-answer" onclick="answerPressQuestion(${pc.current}, ${i})">${a.label}</button>`).join('')}</div></div></div>`;
}
function renderPlayoffInjuryModal() {
  if (!G.playoffInjuryPrompt) return '';
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.playoffInjuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  return `<div class="modal-overlay"><div class="modal"><h1 style="font-size:20px">🚑 Травмы перед серией</h1><div style="display:flex;flex-direction:column;gap:10px">${injured.map(p => `<div class="press-question"><div class="pq-text">${p.name} (${p.position}, ${p.ovr}) — ${p.injury.gamesLeft} игр</div><button class="press-answer" onclick="playoffInjuryChoice(${p.id}, true)">🩹 Играть через боль</button><button class="press-answer" onclick="playoffInjuryChoice(${p.id}, false)">🛌 Отдохнуть</button></div>`).join('')}</div><div style="margin-top:14px"><button class="btn" onclick="confirmPlayoffInjury()">Готово</button></div></div></div>`;
}
function playoffInjuryChoice(playerId, playThrough) {
  if (!G.playoffInjuryPrompt) return;
  if (!G.playoffInjuryPrompt.choices) G.playoffInjuryPrompt.choices = {};
  G.playoffInjuryPrompt.choices[playerId] = playThrough; render();
}
function confirmPlayoffInjury() {
  if (!G.playoffInjuryPrompt) return;
  resolvePlayoffInjury(G.playoffInjuryPrompt.choices || {});
}
function renderInjuryPromptModal() {
  if (!G.injuryPrompt) return '';
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.injuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  const choices = G.injuryPrompt.choices || {};
  return `<div class="modal-overlay">
    <div class="modal">
      <h1 style="font-size:20px;margin-bottom:8px">🚑 Травмированные в составе</h1>
      <div class="subtitle">Выберите действие для каждого. Политика запомнится для этого игрока.</div>
      ${injured.map(p => {
        const c = choices[p.id];
        return `<div class="press-question">
          <div class="pq-text">${p.name} (${p.position}, ${p.ovr}) — травма ${p.injury.gamesLeft} игр</div>
          <button class="press-answer ${c === 'once' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'once')">🔁 Заменить только на этот матч</button>
          <button class="press-answer ${c === 'period' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'period')">📅 Заменить до конца травмы</button>
          <button class="press-answer ${c === 'pain' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'pain')">🩹 Через боль (−15% OVR, риск)</button>
        </div>`;
      }).join('')}
      <div style="margin-top:14px">
        <label class="no-fire-checkbox"><input type="checkbox" ${G.skipInjuryPrompt ? 'checked' : ''} onchange="G.skipInjuryPrompt=this.checked;"> Больше не спрашивать (по умолчанию «до конца травмы»)</label>
      </div>
      <div style="margin-top:14px"><button class="btn" onclick="applyInjuryPolicies()">Готово</button></div>
    </div>
  </div>`;
}
function renderOpeningCupModal() {
  if (!G.openingCupModal) return '';
  const m = G.openingCupModal;
  const highlight = m.isMyTeam ? `<div style="color:#4ade80;font-weight:700;margin-top:8px">🏆 Вы выиграли Матч Открытия! +5 млн ₽</div>` : `<div style="color:#ef4444;font-weight:700;margin-top:8px">Поражение в Матче Открытия</div>`;
  return `<div class="modal-overlay" onclick="if(event.target===this){G.openingCupModal=null; render();}">
    <div class="modal">
      <h1 style="font-size:22px;margin-bottom:12px">⚡ Матч Открытия</h1>
      <div class="champion" style="font-size:18px;padding:16px">${m.teamA.name} ${m.hgA}:${m.hgB} ${m.teamB.name}${m.ot ? ' (ОТ)' : ''}</div>
      <div style="text-align:center;color:#c0c7d8;margin-top:12px">Победитель: <b style="color:#4ade80">${m.winner.name}</b></div>
      ${highlight}
      <div style="margin-top:20px;text-align:center"><button class="btn" onclick="G.openingCupModal=null; render();">Продолжить</button></div>
    </div>
  </div>`;
}



/* ============================================================
   ГЛАВНЫЙ ЭКРАН КЛУБА — DASHBOARD
   ============================================================ */
function renderOverview() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return '<div class="subtitle">Клуб не найден.</div>';
  const sorted = standingsSorted();
  const rank = sorted.findIndex(t => t.id === team.id) + 1;
  const played = team.record.w + team.record.l + team.record.otl;
  const total = G.league.schedule.length;
  const progress = total ? Math.round(G.league.currentRound / total * 100) : 0;
  const seasonDone = G.league.currentRound >= total;
  const scheduleMeta = ensureScheduleCalendar(G.league);
  let nextGameIndex = G.league.currentRound;
  let fixture = null;
  while (nextGameIndex < G.league.schedule.length && !fixture) {
    fixture = (G.league.schedule[nextGameIndex] || []).find(([h, a]) => h === team.id || a === team.id) || null;
    if (!fixture) nextGameIndex++;
  }
  const nextDate = scheduleMeta[nextGameIndex]?.date || null;
  const nextDateLabel = nextDate
    ? new Date(nextDate + 'T00:00:00Z').toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: 'long', timeZone: 'UTC' })
    : 'Дата не назначена';
  const isHome = fixture ? fixture[0] === team.id : false;
  const opponent = fixture ? G.league.teams.find(t => t.id === (isHome ? fixture[1] : fixture[0])) : null;
  const recent = (G.league.results || []).filter(r => r.homeId === team.id || r.awayId === team.id).slice(-5).reverse();
  const injuries = team.roster.filter(p => p.injury && p.injury.gamesLeft > 0);
  const leaders = team.roster.slice().sort((a, b) => (ensureStats(b).points || 0) - (ensureStats(a).points || 0)).slice(0, 3);
  const diff = team.record.gf - team.record.ga;
  const pct = played ? Math.round(team.record.pts / (played * 2) * 100) : 0;
  const matchAction = nextGameIndex === G.league.currentRound
    ? '<button class="btn" onclick="startMyLiveMatch()">▶ Играть матч</button>'
    : '<button class="btn" onclick="advanceToMyNextMatch()">⏩ Перейти к матчу</button>';
  const nextMatch = opponent
    ? '<div class="dashboard-matchup"><div class="dashboard-match-team"><span class="dashboard-match-label">' + (isHome ? 'ДОМА' : 'В ГОСТЯХ') + '</span><strong>' + logoHeader(team) + (team.shortName || team.name) + '</strong></div><div class="dashboard-vs"><span>VS</span><small>ДЕНЬ ' + (nextGameIndex + 1) + ' · ' + nextDateLabel + '</small></div><div class="dashboard-match-team opponent"><span class="dashboard-match-label">' + (isHome ? 'СОПЕРНИК' : 'ХОЗЯЕВА') + '</span><strong>' + logoHeader(opponent) + (opponent.shortName || opponent.name) + '</strong></div></div><div class="dashboard-match-actions">' + matchAction + '<button class="btn secondary" onclick="G.activeTab=\'calendar\';render()">Календарь</button></div>'
    : seasonDone
      ? '<div class="dashboard-empty-state"><strong>Регулярный чемпионат завершён</strong><span>' + (G.league.playoffs ? 'Плей-офф уже сформирован — время бороться за Кубок Петрова.' : 'Можно подвести итоги сезона и перейти к следующему.') + '</span><button class="btn" onclick="' + (G.league.playoffs ? "G.activeTab='playoffs';render()" : 'endSeason()') + '">' + (G.league.playoffs ? 'Открыть плей-офф' : 'Перейти к новому сезону') + '</button></div>'
      : '<div class="dashboard-empty-state"><strong>Следующий матч пока не определён</strong><span>Открой календарь, чтобы посмотреть расписание.</span><button class="btn secondary" onclick="G.activeTab=\'calendar\';render()">Открыть календарь</button></div>';
  const form = recent.length ? recent.map(r => {
    const home = r.homeId === team.id;
    const gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg;
    const won = gf > ga;
    return '<span class="dashboard-form-dot ' + (won ? 'win' : gf === ga ? 'draw' : 'loss') + '" title="' + (won ? 'Победа' : gf === ga ? 'Ничья' : 'Поражение') + ' ' + gf + ':' + ga + '">' + (won ? 'В' : gf === ga ? 'Н' : 'П') + '<small>' + gf + ':' + ga + '</small></span>';
  }).join('') : '<span class="dashboard-muted">Матчей ещё не было</span>';
  const playerCards = leaders.map((p, i) => {
    const st = ensureStats(p);
    return '<div class="dashboard-player"><span class="dashboard-player-rank">0' + (i + 1) + '</span><div><strong>' + p.name + '</strong><small>' + p.position + ' · OVR ' + p.ovr + '</small></div><b>' + (st.points || 0) + '<small>ОЧКОВ</small></b></div>';
  }).join('');
  const streak = team.streak && team.streak.count >= 2 ? '<span class="dashboard-streak ' + (team.streak.type === 'w' ? 'hot' : 'cold') + '">' + (team.streak.type === 'w' ? '🔥' : '❄️') + ' Серия: ' + team.streak.count + '</span>' : '';
  return '<section class="club-dashboard">' +
    '<div class="dashboard-welcome"><div><span class="dashboard-eyebrow">ЦЕНТР УПРАВЛЕНИЯ КЛУБОМ · ' + G.league.season + '</span><h2>Добро пожаловать в штаб, ' + team.name + '</h2><p>' + team.city + ' · ' + team.region + ' ' + streak + '</p></div><div class="dashboard-rank"><span>МЕСТО В ЛИГЕ</span><strong>#' + rank + '</strong><small>из ' + G.league.teams.length + ' клубов</small></div></div>' +
    '<div class="dashboard-kpis">' +
    '<article class="dashboard-kpi"><span>ОЧКИ</span><strong>' + team.record.pts + '</strong><small>' + played + ' матчей сыграно</small></article>' +
    '<article class="dashboard-kpi"><span>ПОБЕДЫ · ПОРАЖЕНИЯ · ПО</span><strong>' + team.record.w + '–' + team.record.l + '–' + team.record.otl + '</strong><small>' + pct + '% набранных очков</small></article>' +
    '<article class="dashboard-kpi"><span>ШАЙБЫ</span><strong>' + team.record.gf + ' : ' + team.record.ga + '</strong><small class="' + (diff >= 0 ? 'positive' : 'negative') + '">' + (diff > 0 ? '+' : '') + diff + ' разница</small></article>' +
    '<article class="dashboard-kpi"><span>БЮДЖЕТ КЛУБА</span><strong class="' + (team.finance.balance >= 0 ? 'positive' : 'negative') + '">' + Math.round(team.finance.balance) + ' млн ₽</strong><small>из ' + team.finance.seasonBudget + ' млн ₽ на сезон</small></article></div>' +
    '<div class="dashboard-main-grid">' +
    '<section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="dashboard-eyebrow">БЛИЖАЙШЕЕ СОБЫТИЕ</span><h3>' + (opponent ? 'Следующий матч' : 'Календарь сезона') + '</h3></div><button class="dashboard-link" onclick="G.activeTab=\'calendar\';render()">Весь календарь →</button></div>' + nextMatch + '</section>' +
    '<section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="dashboard-eyebrow">СЕЗОН ' + G.league.season + '</span><h3>Путь по чемпионату</h3></div><strong>' + progress + '%</strong></div><div class="dashboard-progress"><span style="width:' + progress + '%"></span></div><div class="dashboard-progress-meta"><span>Турнирная дистанция</span><b>' + G.league.currentRound + ' / ' + total + ' игровых дат</b></div><div class="dashboard-form-heading">Последние результаты <span>последние ' + recent.length + ' матчей</span></div><div class="dashboard-form">' + form + '</div><button class="btn secondary dashboard-wide-btn" onclick="G.activeTab=\'standings\';render()">Открыть турнирную таблицу</button></section>' +
    '<section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="dashboard-eyebrow">КОМАНДА</span><h3>Лидеры состава</h3></div><button class="dashboard-link" onclick="G.activeTab=\'roster\';render()">Весь состав →</button></div><div class="dashboard-player-list">' + (playerCards || '<span class="dashboard-muted">Нет данных по игрокам</span>') + '</div><div class="dashboard-injury-note ' + (injuries.length ? 'has-injuries' : '') + '">' + (injuries.length ? '🚑 В лазарете: ' + injuries.length + ' игроков' : '✓ Нет травмированных игроков') + '</div></section>' +
    '<section class="dashboard-panel"><div class="dashboard-panel-heading"><div><span class="dashboard-eyebrow">БЫСТРЫЙ ДОСТУП</span><h3>Управление клубом</h3></div></div><div class="dashboard-actions">' +
    '<button onclick="G.activeTab=\'lines\';render()"><span>▤</span><b>Звенья</b><small>Состав и сочетания</small></button><button onclick="G.activeTab=\'tactics\';render()"><span>⌁</span><b>Тактика</b><small>Стиль игры</small></button><button onclick="G.activeTab=\'market\';render()"><span>＋</span><b>Трансферы</b><small>Усиление команды</small></button><button onclick="G.activeTab=\'finance\';render()"><span>₽</span><b>Финансы</b><small>Доходы и расходы</small></button><button onclick="G.activeTab=\'inbox\';render()"><span>✉</span><b>Почта</b><small>' + unreadInboxCount() + ' непрочитанных</small></button><button onclick="G.activeTab=\'news\';render()"><span>▣</span><b>Новости</b><small>Лента лиги</small></button></div></section></div></section>';
}
