/* ============================================================
   UI — ВЫБОР КЛУБА / ХЕДЕР / ТАБЫ
   ============================================================ */
function getInitials(name) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(); }
function getTeamRatings(team) { return team.ratings || { att: 70, def: 70, gk: 70, st: 70 }; }
function logoHeader(team) {
  const initials = getInitials(team.name);
  if (team.logo) return `<img src="${team.logo}" class="team-logo-header" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="team-logo-fallback-small" style="display:none">${initials}</span>`;
  return `<span class="team-logo-fallback-small">${initials}</span>`;
}
function logoTiny(team) {
  const initials = getInitials(team.name);
  if (team.logo) return `<img src="${team.logo}" class="team-logo-tiny" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="team-logo-fallback-tiny" style="display:none">${initials}</span>`;
  return `<span class="team-logo-fallback-tiny">${initials}</span>`;
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
    const logoImg = t.logo
      ? `<img src="${t.logo}" style="width:36px;height:36px;object-fit:contain;vertical-align:middle;margin-right:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span style="display:none;width:36px;height:36px;background:linear-gradient(135deg,#ff6b35,#fbbf24);color:#0f1117;border-radius:6px;align-items:center;justify-content:center;font-weight:900;font-size:12px;vertical-align:middle;margin-right:8px">${getInitials(t.name)}</span>`
      : `<span style="display:inline-flex;width:36px;height:36px;background:linear-gradient(135deg,#ff6b35,#fbbf24);color:#0f1117;border-radius:6px;align-items:center;justify-content:center;font-weight:900;font-size:12px;vertical-align:middle;margin-right:8px">${getInitials(t.name)}</span>`;
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
      G.league.teams.forEach(t => {
        t.finance.salaryCap = Math.round(t.finance.seasonBudget * G.difficulty.salaryCapPct);
      });
      G.injuryPrompt = null;
      G.skipInjuryPrompt = false;
      G.openingCupModal = null;
      G.tradeTargetTeamId = null;
      G.screen = 'game';
      initAISponsors();
      render();
    };
  });
}

function renderHeader() {
  if (!G.playerTeamId) {
    const rep = G.career?.reputation ?? 50;
    return `<div class="topbar"><div><h1>💼 Свободный агент</h1><div class="subtitle">Репутация: <b>${Math.round(rep)}/100</b>${G.career?.lastTeamName ? ` · Последний клуб: ${G.career.lastTeamName}` : ''}</div></div><div><button class="btn danger" onclick="if(confirm('Начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
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
  return `<div class="topbar"><div><h1 style="display:flex;align-items:center">${logoHeader(team)}${team.name}</h1><div class="subtitle">Сезон ${G.league.season} · ${diffLabel}${noFireTxt} · ${r.w}-${r.l}-${r.otl} · ${r.pts} очк. · #${myRank} · ЗП: ${Math.round(playerSal + staffSal)}/${team.finance.salaryCap} · Баланс: <b style="color:${bal >= 0 ? '#4ade80' : '#ef4444'}">${Math.round(bal)} млн ₽</b> · Реп: ${Math.round(rep)}/100${injured ? ` · 🚑 ${injured}` : ''}${offers ? ` · 💼 ${offers}` : ''}${unread ? ` · ✉ ${unread}` : ''}${streakTxt}</div></div><div><button class="btn secondary" onclick="if(confirm('Сбросить и начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
}
function renderTabs() {
  const unread = unreadInboxCount();
  const tabs = [
    { key: 'standings', label: 'Таблица' }, { key: 'games', label: 'Матчи' }, { key: 'calendar', label: 'Календарь' },
    { key: 'roster', label: 'Состав' }, { key: 'lines', label: 'Звенья' }, { key: 'stats', label: 'Статистика' },
    { key: 'market', label: 'Рынок' }, { key: 'trades', label: 'Обмены' }, { key: 'waivers', label: 'Драфт отказов' },
    { key: 'inbox', label: `📬 Почта${unread ? ` <span class="inbox-badge">${unread}</span>` : ''}` },
    { key: 'news', label: '📰 Новости' },
    { key: 'tactics', label: 'Тактика' }, { key: 'training', label: 'Тренировки' }, { key: 'staff', label: 'Штаб' },
    { key: 'infrastructure', label: 'Инфраструктура' }, { key: 'academy', label: 'Академия' }, { key: 'youth', label: 'Молодёжные лиги' },
    { key: 'finance', label: 'Финансы' }, { key: 'career', label: '💼 Карьера' },
    { key: 'playoffs', label: 'Плей-офф' }, { key: 'history', label: 'История' },
  ];
  return `<div id="tabs">${tabs.map(t => `<button class="tab ${G.activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}</div>`;
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
      <span class="score" style="min-width:76px;text-align:center;font-weight:800;color:${scoreColor}">${res.ag} : ${res.hg}${res.ot ? '<span class="ot-tag">ОТ</span>' : ''}</span>
      <span style="flex:1">${home.name}</span>
      ${isMe ? '<span class="tag" style="margin-left:6px">Ваш клуб</span>' : ''}
    </div>`;
  }).join('');
  return `<div class="modal-overlay" onclick="if(event.target===this) closeRoundResults();">
    <div class="modal" style="max-width:620px;max-height:85vh;overflow-y:auto">
      <button class="close-btn" onclick="closeRoundResults()">✕</button>
      <h1 style="font-size:22px;margin-bottom:6px">🏒 Итоги тура ${G.lastRoundNumber || ''}</h1>
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
    html += `<h2>${away.name} ${game.ag} : ${game.hg} ${home.name} ${game.ot ? '(ОТ)' : ''}</h2><div class="pbp-container">`;
    for (const ev of game.pbp || []) { if (ev.type === 'period') { html += `<div class="pbp-period">${ev.text}</div>`; continue; } const cls = ev.type === 'goal' ? 'pbp-goal' : ev.type === 'penalty' ? 'pbp-penalty' : ev.type === 'shot' ? 'pbp-shot' : 'pbp-faceoff'; html += `<div class="${cls}">[${ev.time}] ${ev.text}</div>`; }
    html += `</div>`; return html;
  }
  if (G.league.results.length === 0) return `<div class="subtitle">Матчей ещё не было.</div>`;
  const byRound = {}; G.league.results.forEach(r => (byRound[r.round] = byRound[r.round] || []).push(r));
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a); let html = '';
  rounds.forEach(r => {
    html += `<h2>Тур ${r + 1}</h2>`;
    byRound[r].forEach(res => {
      const home = G.league.teams.find(t => t.id === res.homeId); const away = G.league.teams.find(t => t.id === res.awayId);
      const isMe = res.homeId === G.playerTeamId || res.awayId === G.playerTeamId; const globalIdx = G.league.results.indexOf(res);
      html += `<div class="game-row ${isMe ? 'player-game' : ''}" onclick="G.selectedGamePbp=G.league.results[${globalIdx}]; render();"><span class="away">${away.name}</span><span class="score">${res.ag} : ${res.hg}${res.ot ? '<span class="ot-tag">ОТ</span>' : ''}</span><span>${home.name}</span></div>`;
    });
  });
  return html;
}

function renderCalendar() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const schedule = G.league.schedule;
  const myGames = [];
  schedule.forEach((round, idx) => {
    const game = round.find(([h, a]) => h === team.id || a === team.id); if (!game) return;
    const isHome = game[0] === team.id;
    const opp = G.league.teams.find(t => t.id === (isHome ? game[1] : game[0]));
    const result = G.league.results.find(r => r.round === idx && (r.homeId === team.id || r.awayId === team.id));
    myGames.push({ round: idx + 1, opp, isHome, result, isCurrent: idx === G.league.currentRound });
  });
  const blocks = []; for (let i = 0; i < myGames.length; i += 8) blocks.push(myGames.slice(i, i + 8));
  const monthNames = ['Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь', 'Январь', 'Февраль', 'Март', 'Апрель'];
  let html = `<h2>Календарь сезона ${G.league.season}</h2>`;
  blocks.forEach((block, bIdx) => {
    html += `<div class="season-card"><div class="head"><span class="season-num">${monthNames[bIdx] || 'Месяц ' + (bIdx + 1)}</span><span class="tag">Туры ${block[0].round}–${block[block.length - 1].round}</span></div>`;
    block.forEach(g => {
      const homeAway = g.isHome ? '🏠' : '✈️';
      const resultStr = g.result ? `${g.isHome ? g.result.hg : g.result.ag} : ${g.isHome ? g.result.ag : g.result.hg}${g.result.ot ? ' ОТ' : ''}` : '';
      let color = 'color:#7a8299';
      if (g.result) { const won = g.isHome ? g.result.hg > g.result.ag : g.result.ag > g.result.hg; color = won ? 'color:#4ade80' : 'color:#ef4444'; }
      const bg = g.isCurrent ? 'background:rgba(255,107,53,0.12)' : '';
      html += `<div class="game-row" style="${bg}"><span style="flex:0 0 60px;color:#7a8299">Тур ${g.round}</span><span style="flex:0 0 40px">${homeAway}</span><span style="flex:1">${g.opp.name}</span><span class="score" style="${color};flex:0 0 auto">${resultStr || '—'}</span></div>`;
    });
    html += `</div>`;
  });
  return html;
}

/* ============================================================
   СОСТАВ / ЗВЕНЬЯ
   ============================================================ */
function renderRoster() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const benchSet = new Set(team.bench || []);
  let skaters = team.roster.filter(p => p.position !== 'G' && !benchSet.has(p.id));
  let goalies = team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id));
  const benched = team.roster.filter(p => benchSet.has(p.id));
  const sort = G.rosterSort;
  const sortPlayers = (arr) => arr.slice().sort((a, b) => {
    const sa = ensureStats(a), sb = ensureStats(b);
    if (sort === 'ovr') return b.ovr - a.ovr; if (sort === 'age') return a.age - b.age;
    if (sort === 'points') return (sb.points || 0) - (sa.points || 0);
    if (sort === 'salary') return b.contract.salary - a.contract.salary;
    if (sort === 'health') { const ha = (a.injury && a.injury.gamesLeft > 0) ? 100 + a.injury.gamesLeft : a.fatigue; const hb = (b.injury && b.injury.gamesLeft > 0) ? 100 + b.injury.gamesLeft : b.fatigue; return hb - ha; }
    return 0;
  });
  skaters = sortPlayers(skaters); goalies = sortPlayers(goalies);
  const sortSelect = `<select onchange="G.rosterSort=this.value; render();" style="background:#1a1e2a;color:#e6e8ee;border:1px solid #2a3042;padding:6px 10px;border-radius:4px;margin-bottom:12px"><option value="ovr"${sort === 'ovr' ? ' selected' : ''}>По OVR</option><option value="age"${sort === 'age' ? ' selected' : ''}>По возрасту</option><option value="points"${sort === 'points' ? ' selected' : ''}>По очкам</option><option value="salary"${sort === 'salary' ? ' selected' : ''}>По зарплате</option><option value="health"${sort === 'health' ? ' selected' : ''}>По состоянию</option></select>`;
  const nameCell = (p) => {
    let badge = '';
    if (p.injury && p.injury.gamesLeft > 0) badge = p.playingThroughPain ? `<span style="color:#ef4444;font-size:11px"> 🩹${p.injury.gamesLeft}</span>` : `<span style="color:#ef4444;font-size:11px"> 🚑${p.injury.gamesLeft}</span>`;
    else if (p.fatigue > 80) badge = `<span> 🥵</span>`; else if (p.fatigue < 20) badge = `<span> ⚡</span>`;
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    return `<a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a>${badge} <span class="char-badge ${char.cls}">${char.label}</span> ${p.nationality !== 'Россия' ? '🌍' : ''}`;
  };
  const actionBtns = (p) => `<button class="btn small secondary" onclick="sendToBench(${p.id}); render();">🪑</button><button class="btn small danger" onclick="putOnWaivers(${p.id}); render();" title="Отказы (${team.waiversUsed || 0}/3)">📤</button>`;
  const skaterRows = skaters.map(p => {
    ensureStats(p); const group = p.position === 'D' ? 'D' : 'F'; const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo';
    const potTag = p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : ''; const s = p.stats;
    return `<tr><td><span class="pos ${group}">${p.position}</span></td><td>${nameCell(p)}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.goals}</td><td class="stat-cell">${s.assists}</td><td class="stat-cell" style="font-weight:700;color:#ff6b35">${s.points}</td><td>${actionBtns(p)}</td></tr>`;
  }).join('');
  const goalieRows = goalies.map(p => {
    ensureStats(p); const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo';
    const potTag = p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : ''; const s = p.stats;
    const svPct = s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—';
    const gaa = s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—';
    return `<tr><td><span class="pos G">G</span></td><td>${nameCell(p)}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.wins}</td><td class="stat-cell" style="font-weight:700">${svPct}</td><td class="stat-cell">${gaa}</td><td>${actionBtns(p)}</td></tr>`;
  }).join('');
  const benchHtml = benched.length ? `<div class="bench-section"><div class="bench-title">🪑 На скамейке (${benched.length})</div>${benched.map(p => `<div class="bench-row"><span>${nameCell(p)} <span class="tag">${p.position} · ${p.ovr}</span></span><button class="btn small" onclick="removeFromBench(${p.id}); render();">⬆️ Вернуть</button></div>`).join('')}</div>` : '';
  return `${sortSelect}<div class="subtitle">Драфт отказов: ${team.waiversUsed || 0}/3 за сезон</div>${benchHtml}<h2>Нападающие и защитники (${skaters.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>Г</th><th>А</th><th>О</th><th></th></tr></thead><tbody>${skaterRows}</tbody></table><h2>Вратари (${goalies.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>В</th><th>SV%</th><th>КН</th><th></th></tr></thead><tbody>${goalieRows}</tbody></table>`;
}

function renderLines() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team.lines) initLines(team);
  syncLines(team);
  const benchSet = new Set(team.bench || []);
  const poolFor = (isDef) => team.roster.filter(p => !benchSet.has(p.id) && (isDef ? p.position === 'D' : (p.position !== 'D' && p.position !== 'G'))).sort((a,b) => b.ovr - a.ovr);
  const block = (key, size, isDef) => {
    const line = team.lines[key]; const mods = lineMods(line);
    const chemColor = line.chemistry >= 70 ? '#4ade80' : line.chemistry >= 40 ? '#fbbf24' : '#ef4444';
    const pool = poolFor(isDef); const slots = [];
    for (let i = 0; i < size; i++) {
      const curId = line.players[i];
      const opts = pool.map(p => `<option value="${p.id}" ${p.id === curId ? 'selected' : ''}>${p.name} (${p.ovr})</option>`).join('');
      slots.push(`<select onchange="setLineSlot('${key}', ${i}, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;min-width:170px">${opts}</select>`);
    }
    const styleOpts = Object.entries(LINE_STYLES).map(([k,v]) => `<option value="${k}" ${line.style === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const roleOpts = Object.entries(LINE_ROLES).map(([k,v]) => `<option value="${k}" ${line.role === k ? 'selected' : ''}>${v.label}</option>`).join('');
    return `<div class="line-card"><div class="line-title"><b>${key.toUpperCase()}</b><span class="line-chem" style="color:${chemColor}">Химия ${Math.round(line.chemistry)}/100</span></div><div class="line-slots">${slots.join('')}</div><div class="line-footer"><span class="lbl">Роль:</span><select onchange="setLineRole('${key}', this.value)" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:3px 8px;border-radius:3px;font-size:11px">${roleOpts}</select><span class="lbl">Стиль:</span><select onchange="setLineStyle('${key}', this.value)" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:3px 8px;border-radius:3px;font-size:11px">${styleOpts}</select><span class="mods">Атака: ${mods.atk >= 0 ? '+' : ''}${Math.round(mods.atk*100)}% · Защита: ${mods.def >= 0 ? '+' : ''}${Math.round(mods.def*100)}%</span></div></div>`;
  };
  const gkOpts = (selId) => team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr).map(p => `<option value="${p.id}" ${p.id === selId ? 'selected' : ''}>${p.name} (${p.ovr})</option>`).join('');
  let html = `<h2>Звенья и пары</h2><div style="margin-bottom:12px"><button class="btn small" onclick="resetLinesToOvr()">🔄 Автосостав</button></div><h2>Форварды</h2>`;
  for (const key of ['f1','f2','f3','f4']) html += block(key, 3, false);
  html += `<h2>Защитники</h2>`;
  for (const key of ['d1','d2','d3']) html += block(key, 2, true);
  html += `<h2>Вратари</h2><div class="line-card"><div class="line-slots"><div><span class="lbl">Стартовый:</span><br><select onchange="setLineSlot('g', 0, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;margin-top:4px">${gkOpts(team.lines.g1)}</select></div><div><span class="lbl">Запасной:</span><br><select onchange="setLineSlot('g', 1, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;margin-top:4px">${gkOpts(team.lines.g2)}</select></div></div></div>`;
  return html;
}

/* ============================================================
   СТАТИСТИКА / ФИНАНСЫ
   ============================================================ */
function renderStats() {
  const mode = G.statsMode || 'regular';
  const leaders = leagueLeaders(G.league, mode);
  const findTeam = (p) => G.league.teams.find(t => t.roster.includes(p));
  const getStat = (p) => mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
  const toggle = `<div class="stat-toggle"><button class="${mode === 'regular' ? 'active' : ''}" onclick="G.statsMode='regular'; render();">Регулярка</button><button class="${mode === 'playoff' ? 'active' : ''}" onclick="G.statsMode='playoff'; render();">Плей-офф</button></div>`;
  const skaterTable = (title, players) => `<h2>${title}</h2><table><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>Г</th><th>А</th><th>О</th></tr></thead><tbody>${players.map((p, i) => { const t = findTeam(p); const st = getStat(p); const isMine = t && t.id === G.playerTeamId; return `<tr style="${isMine ? 'background:rgba(255,107,53,0.12)' : ''}"><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td style="${isMine ? 'color:#ff6b35;font-weight:700' : ''}">${t ? t.name : '—'}${isMine ? ' · Ваш клуб' : ''}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.goals}</td><td class="stat-cell">${st.assists}</td><td class="stat-cell" style="font-weight:700;color:#ff6b35">${st.points}</td></tr>`; }).join('')}</tbody></table>`;
  const goalieTable = `<h2>🧤 Вратари</h2><table><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>В</th><th>SV%</th><th>КН</th><th>Сух</th></tr></thead><tbody>${leaders.bySvPct.map((p, i) => { const t = findTeam(p); const st = getStat(p); const sv = st.shotsAgainst > 0 ? (st.saves / st.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'; const gaa = st.gp > 0 ? (st.goalsAgainst / st.gp).toFixed(2) : '—'; const isMine = t && t.id === G.playerTeamId; return `<tr style="${isMine ? 'background:rgba(255,107,53,0.12)' : ''}"><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td style="${isMine ? 'color:#ff6b35;font-weight:700' : ''}">${t ? t.name : '—'}${isMine ? ' · Ваш клуб' : ''}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.wins}</td><td class="stat-cell" style="font-weight:700">${sv}</td><td class="stat-cell">${gaa}</td><td class="stat-cell">${st.shutouts}</td></tr>`; }).join('')}</tbody></table>`;
  return `${toggle}<div class="subtitle">Строки вашего клуба выделены оранжевым.</div>${skaterTable('🎯 Снайперы', leaders.byGoals)}${skaterTable('🎁 Ассистенты', leaders.byAssists)}${skaterTable('⭐ Бомбардиры', leaders.byPoints)}${goalieTable}`;
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

function renderMarket() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const hasScout = !!team.staff.scout;
  const filtered = (G.league.freeAgents || []).filter(p => { if (G.marketFilter === 'all') return true; if (G.marketFilter === 'F') return p.position !== 'D' && p.position !== 'G'; if (G.marketFilter === 'D') return p.position === 'D'; if (G.marketFilter === 'G') return p.position === 'G'; return true; });
  const sorted = filtered.slice().sort((a, b) => b.ovr - a.ovr);
  const rows = sorted.map(p => {
    const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'; const foreign = p.nationality !== 'Россия';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const potTag = hasScout && p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : '';
    const graduateTag = p.youthGraduated ? '<span class="tag" title="Выпускник молодёжной лиги">🎓 Выпускник</span>' : '';
    return `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a> <span class="char-badge ${char.cls}">${char.label}</span> ${graduateTag} ${foreign ? '🌍' : ''}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="salary">${p.contract.salary.toFixed(1)}M</td><td><button class="btn small" onclick="signFreeAgent(G.league.teams.find(t=>t.id===G.playerTeamId), G.league.freeAgents.find(x=>x.id===${p.id})); render();">Подписать</button><button class="btn small secondary" onclick="offerTryout(G.league.teams.find(t=>t.id===G.playerTeamId), G.league.freeAgents.find(x=>x.id===${p.id})); render();">Просмотр</button></td></tr>`;
  }).join('');
  return `<div class="market-filters"><button class="${G.marketFilter === 'all' ? 'active' : ''}" onclick="G.marketFilter='all'; render();">Все</button><button class="${G.marketFilter === 'F' ? 'active' : ''}" onclick="G.marketFilter='F'; render();">Форварды</button><button class="${G.marketFilter === 'D' ? 'active' : ''}" onclick="G.marketFilter='D'; render();">Защитники</button><button class="${G.marketFilter === 'G' ? 'active' : ''}" onclick="G.marketFilter='G'; render();">Вратари</button></div><h2>Свободные агенты (${sorted.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>ЗП</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTrades() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const offers = G.league.aiTradeOffers || [];
  const deadline = isTradeDeadlinePassed();
  let html = `<h2>Обмены</h2>`;
  if (deadline) html += `<div class="trade-deadline-banner">🚫 Трансферный дедлайн закрыт. Обмены недоступны до конца сезона.</div>`;
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
  const tradePlayerRow = (p, side) => `<label class="trade-check-row"><input type="checkbox" class="trade-${side}-pick" value="${p.id}"><span><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span> ${p.name} (${p.ovr}) — ${tradeValue(p)}</span></label>`;
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
    html += '<tr><td>' + (index + 1) + '</td><td>' + team.name + '</td><td>' + r.gp + '</td><td>' + r.w + '</td><td>' + r.otw + '</td><td>' + r.otl + '</td><td>' + r.l + '</td><td><b>' + r.pts + '</b></td><td>' + r.gf + '</td><td>' + r.ga + '</td></tr>';
  });
  html += '</tbody></table>';
  const rosterTeam = league.teams.find(team => String(team.id) === String(G.youthRosterTeamId)) || table[0] || league.teams[0];
  if (rosterTeam) {
    html += '<h2>Игроки команды</h2><div class="inbox-filter"><select onchange="G.youthRosterTeamId=this.value;render()" style="max-width:100%">' + table.map(team => '<option value="' + team.id + '" ' + (team.id === rosterTeam.id ? 'selected' : '') + '>' + team.name + '</option>').join('') + '</select></div>' +
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
  const icons = { injury: '🚑', signing: '✍️', trade: '🔄', milestone: '⭐', streak: '🔥', retirement: '👋', academy: '🎓', event: '📰', release: '📤', career: '💼', firing: '🚫', opening_cup: '⚡', trade_deadline: '🚫', season_upset: '🎉', season_flop: '📉', upset: '🎉', disappointment: '📉' };
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
  const gameStr = series.games.map(g => { const aIsHome = g.homeId === series.aId; return `${aIsHome ? g.hg : g.ag}-${aIsHome ? g.ag : g.hg}${g.ot ? 'ОТ' : ''}`; }).join(', ');
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
function renderHistory() {
  const hist = G.league.history;
  if (hist.length === 0) return `<div class="subtitle">История пуста.</div>`;
  const allTime = allTimeTeamRecords(hist);
  let html = `<h2>🏆 Сводная таблица</h2><table><thead><tr><th>#</th><th>Команда</th><th>Сезонов</th><th>В</th><th>П</th><th>Очки</th><th>🥇</th><th>🏆</th></tr></thead><tbody>${allTime.map((r, i) => `<tr><td style="color:#7a8299">${i + 1}</td><td>${r.name}</td><td>${r.seasons}</td><td>${r.w}</td><td>${r.l}</td><td style="font-weight:700">${r.pts}</td><td>${r.regular > 0 ? '🥇'.repeat(Math.min(r.regular, 3)) : '—'}</td><td>${r.cups > 0 ? '🏆'.repeat(Math.min(r.cups, 5)) : '—'}</td></tr>`).join('')}</tbody></table>`;
  html += renderAllTimeLeaders();
  hist.slice().reverse().forEach(h => {
    html += `<div class="season-card"><div class="head"><span class="season-num">Сезон ${h.season}</span><span class="champ">🥇 ${h.regularChampionName} · 🏆 ${h.championName}${h.openingCupWinnerName ? ` · ⚡ ${h.openingCupWinnerName}` : ''}</span></div>`;
    html += `<details><summary>Награды</summary>${renderAwards(h.awards)}</details>`;
    html += `<details><summary>Таблица</summary><table><thead><tr><th>#</th><th>Команда</th><th>В</th><th>П</th><th>О</th></tr></thead><tbody>${h.standings.map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.w}</td><td>${t.l}</td><td>${t.pts}</td></tr>`).join('')}</tbody></table></details>`;
    html += `</div>`;
  });
  return html;
}

/* ============================================================
   МОДАЛКА ИГРОКА (с кнопкой реабилитации — фиксы #4/#13)
   ============================================================ */
function renderModal() {
  if (!G.popupPlayerId) return '';
  let foundPlayer = null, foundTeam = null;
  for (const t of G.league.teams) { const p = t.roster.find(x => x.id === G.popupPlayerId); if (p) { foundPlayer = p; foundTeam = t; break; } }
  if (!foundPlayer) foundPlayer = (G.league.freeAgents || []).find(x => x.id === G.popupPlayerId);
  if (!foundPlayer) { G.popupPlayerId = null; return ''; }
  const p = foundPlayer, isG = p.position === 'G', attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const s = ensureStats(p); const ps = ensurePlayoffStats(p);
  const onBench = foundTeam && (foundTeam.bench || []).includes(p.id);
  const isMyTeam = foundTeam && foundTeam.id === G.playerTeamId;
  const mentor = isMyTeam ? getMentor(foundTeam, p.id) : null;
  const char = CHARACTERS[p.character] || CHARACTERS.calm;
  const healthBadges = [];
  if (onBench) healthBadges.push(`<span class="status-badge bench">🪑 Скамейка</span>`);
  if (p.injury && p.injury.gamesLeft > 0) {
    if (p.playingThroughPain) healthBadges.push(`<span class="status-badge pain">🩹 Боль (${p.injury.gamesLeft})</span>`);
    else healthBadges.push(`<span class="status-badge injured">🚑 Травма (${p.injury.gamesLeft})</span>`);
  } else if (p.fatigue > 80) healthBadges.push(`<span class="status-badge tired">😴 ${p.fatigue}/100</span>`);
  else if (p.fatigue < 20) healthBadges.push(`<span class="status-badge fresh">⚡ ${p.fatigue}/100</span>`);
  const attrRows = attrs.map(a => `<div class="attr-row"><span>${ATTR_LABELS[a]}</span><span>${p.attrs[a]} <span style="color:#7a8299;font-size:11px">/ ${p.attrPot[a]}</span></span></div>`).join('');
  const goalHtml = p.seasonGoal ? `<div class="attr-row"><span>🎯 ${p.seasonGoal.description}</span><span style="color:${p.seasonGoal.achieved === true ? '#4ade80' : p.seasonGoal.achieved === false ? '#ef4444' : '#fbbf24'}">${p.seasonGoal.achieved === true ? '✓' : p.seasonGoal.achieved === false ? '✗' : '⏳'}</span></div>` : '';
  const statsReg = isG ? `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${s.gp}</span></div><div class="attr-row"><span>Победы</span><span>${s.wins}</span></div><div class="attr-row"><span>SV%</span><span>${s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'}</span></div><div class="attr-row"><span>КН</span><span>${s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—'}</span></div></div>` : `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${s.gp}</span></div><div class="attr-row"><span>Голы</span><span>${s.goals}</span></div><div class="attr-row"><span>Передачи</span><span>${s.assists}</span></div><div class="attr-row"><span>Очки</span><span>${s.points}</span></div></div>`;
  const statsPo = isG ? `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${ps.gp}</span></div><div class="attr-row"><span>Победы</span><span>${ps.wins}</span></div><div class="attr-row"><span>SV%</span><span>${ps.shotsAgainst > 0 ? (ps.saves / ps.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'}</span></div></div>` : `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${ps.gp}</span></div><div class="attr-row"><span>Голы</span><span>${ps.goals}</span></div><div class="attr-row"><span>Очки</span><span>${ps.points}</span></div></div>`;
  const canExtend = isMyTeam && p.contract.years <= 1 && p.status === 'contract';
  const canRelease = isMyTeam && p.status === 'contract';
  const remainingSalary = p.contract.salary * Math.max(0, p.contract.years);
  const releaseCost = Math.round(remainingSalary * 0.5 * 10) / 10;
  const ownYouth = isMyTeam && p.age >= YOUTH_RULES.minAge && p.age <= YOUTH_RULES.maxAge ? getOwnYouthTeam(foundTeam) : null;
  const canSendToYouth = !!ownYouth && p.status === 'contract';
  const canIndTraining = isMyTeam && (G.league.currentRound - (p.lastIndTraining || -10)) >= 5;
  const attrButtons = canIndTraining ? attrs.filter(a => p.attrs[a] < p.attrPot[a]).map(a => `<button class="btn small secondary" onclick="handleIndTraining(${p.id}, '${a}')">${ATTR_LABELS[a]}</button>`).join('') : '';
  // ⚙️ ФИКС #4/#13: кнопка реабилитации для травмированного игрока моей команды
  const canRehab = isMyTeam && p.injury && p.injury.gamesLeft > 0
    && (G.league.currentRound - (foundTeam.lastRehabRound || -10)) >= 5;
  const rehabCost = Math.min(3, p.injury ? p.injury.gamesLeft : 0) * 1;
  return `<div class="modal-overlay" onclick="if(event.target===this){G.popupPlayerId=null; render();}">
    <div class="modal">
      <button class="close-btn" onclick="G.popupPlayerId=null; render();">✕</button>
      <h1 style="font-size:22px;margin-bottom:4px">${p.name} <span class="char-badge ${char.cls}">${char.label}</span></h1>
      <div class="subtitle">${p.position} · ${p.age} лет · ${p.nationality} · ${foundTeam ? foundTeam.name : 'Свободный агент'}</div>
      <div style="margin:12px 0">${healthBadges.join(' ')}</div>
      ${mentor ? `<div style="font-size:12px;color:#4ade80">🎓 Наставник: ${mentor.name}</div>` : ''}
      <div class="tag" style="margin:6px 0">${char.desc}</div>
      <h2>Атрибуты</h2><div class="attr-grid">${attrRows}</div>
      ${canIndTraining && attrButtons ? `<div style="margin-top:8px;background:#0f1117;padding:8px;border-radius:5px"><div class="tag" style="margin-bottom:6px">💪 Индивидуальная тренировка (0.5 млн ₽, раз в 5 туров)</div>${attrButtons}</div>` : ''}
      <h2>Форма и мораль</h2><div class="attr-grid"><div class="attr-row"><span>OVR</span><span>${p.ovr} (эфф. ${getEffectiveOvr(p)})</span></div><div class="attr-row"><span>Форма</span><span>${p.form}</span></div><div class="attr-row"><span>Мораль</span><span>${p.morale}</span></div></div>
      ${goalHtml ? `<h2>Цель</h2>${goalHtml}` : ''}
      <h2>Сезон (регулярка)</h2>${statsReg}
      <h2>Сезон (плей-офф)</h2>${statsPo}
      <h2>Контракт</h2><div class="attr-grid"><div class="attr-row"><span>Зарплата</span><span>${p.contract.salary.toFixed(1)} млн</span></div><div class="attr-row"><span>Лет</span><span>${p.contract.years}</span></div></div>
      ${canExtend ? `<div style="margin-top:12px"><button class="btn" onclick="handleExtend(${p.id}, 1)">Продлить на 1</button><button class="btn" onclick="handleExtend(${p.id}, 2)">Продлить на 2</button></div>` : ''}
      ${canRehab ? `<div style="margin-top:12px"><button class="btn" onclick="handleRehab(${p.id}, 3)">🏥 Реабилитация (3 игры, ${rehabCost} млн)</button></div>` : ''}
      ${canRelease ? `<div style="margin-top:12px"><button class="btn danger" onclick="handleRelease(${p.id})">🗑 Разорвать контракт (${releaseCost} млн)</button></div>` : ''}
      ${canSendToYouth ? `<div style="margin-top:12px"><button class="btn secondary" onclick="handleSendToYouth(${p.id})">🎓 Перевести в ${ownYouth.team.name} (${ownYouth.league.id})</button></div>` : ''}
    </div>
  </div>`;
}
function handleExtend(playerId, years) { const r = extendContract(playerId, years); if (r.success) showToast(`Продлено! ЗП: ${r.salary} млн на ${years} лет`); else if (r.reason === 'contract too long') showToast('Контракт длинный'); else showToast(`Отказ. Запрос: ${r.salary} млн`); render(); }
function handleRehab(playerId, games) { const r = rehabPlayer(playerId, games); if (r.success) showToast(`Реабилитация: ${r.gamesSkipped} игр. Стоимость: ${r.cost} млн`); else showToast('Ошибка: ' + r.error); render(); }
function handleIndTraining(playerId, attr) { const r = individualTraining(playerId, attr); if (r.success) showToast(`+1 к ${ATTR_LABELS[r.attr]}`); else showToast('Ошибка: ' + r.error); render(); }
function handleRelease(playerId) { if (!confirm('Точно разорвать контракт? Компенсация 50% остатка зарплаты.')) return; const r = releasePlayer(playerId); if (r.success) showToast(`Расторгнуто. Компенсация: ${r.cost} млн`); else showToast('Ошибка: ' + r.error); G.popupPlayerId = null; render(); }
function handleSendToYouth(playerId) {
  const team = G.league.teams.find(item => item.id === G.playerTeamId);
  const result = sendSeniorPlayerToYouth(team, playerId);
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
  const historyRows = (team.history && team.history.length)
    ? team.history.map(h => `<tr><td>${h.season}</td><td style="font-weight:700">${h.place}</td><td>${h.pts}</td><td>${h.playoff === 'champion' ? '🏆 чемпион' : h.playoff === 'finalist' ? 'финалист' : h.playoff === 'semifinal' ? '1/2' : h.playoff === 'quarterfinal' ? '1/4' : h.playoff === 'round16' ? '1/8' : '—'}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:#7a8299">История клуба начинается с текущего сезона</td></tr>`;
  const trophyRow = (label, arr) => arr && arr.length ? `<div class="attr-row"><span>${label}</span><span style="color:#fbbf24">${arr.join(', ')}</span></div>` : `<div class="attr-row"><span>${label}</span><span style="color:#7a8299">—</span></div>`;
  const trophiesHtml = `<div class="attr-grid">${trophyRow('🏆 Кубок Петрова', team.trophies.petrov)}${trophyRow('🥇 Регулярка', team.trophies.regular)}${trophyRow('⚡ Матч Открытия', team.trophies.opening)}</div>`;
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
      <h2>История (5 сезонов)</h2>
      <table><thead><tr><th>Сезон</th><th>Место</th><th>Очки</th><th>Плей-офф</th></tr></thead><tbody>${historyRows}</tbody></table>
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
