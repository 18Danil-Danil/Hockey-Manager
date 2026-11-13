/* ============================================================
   СТАТИСТИКА / ЗДОРОВЬЕ
   ============================================================ */
function ensureStats(p) {
  if (!p.stats) {
    if (p.position === 'G') p.stats = { gp: 0, wins: 0, losses: 0, otl: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 };
    else p.stats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, plusMinus: 0, pim: 0 };
  }
  return p.stats;
}
function resetAllStats(league) {
  league.teams.forEach(t => t.roster.forEach(p => { p.stats = null; p.playoffStats = null; ensureStats(p); ensurePlayoffStats(p); }));
}
function getEffectiveOvr(p) {
  if (p.injury && p.injury.gamesLeft > 0) {
    if (!p.playingThroughPain) return 0;
    let ovr = p.ovr;
    if (p.fatigue > 50) ovr -= Math.round((p.fatigue - 50) * 0.10);
    if (p.form >= 80) ovr += 2; else if (p.form < 50) ovr -= 2;
    if (p.morale < 40) ovr -= 2;
    return Math.max(20, Math.round(ovr * 0.85));
  }
  let ovr = p.ovr;
  if (p.fatigue > 50) ovr -= Math.round((p.fatigue - 50) * 0.10);
  if (p.form >= 80) ovr += 2; else if (p.form < 50) ovr -= 2;
  if (p.morale < 40) ovr -= 2;
  return Math.max(20, ovr);
}
function advanceInjuries(team) {
  for (const p of team.roster) if (p.injury && p.injury.gamesLeft > 0) { p.injury.gamesLeft--; if (p.injury.gamesLeft <= 0) { p.injury = null; p.playingThroughPain = false; p.injuryPolicy = null; } }
}
function checkInjuries(team, lineup) {
  for (const p of team.roster) {
    if (p.injury && p.injury.gamesLeft > 0) {
      if (p.playingThroughPain && rng() < 0.15) {
        p.injury.gamesLeft += randInt(3, 5);
        p.playingThroughPain = false;
        if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `Травма ${p.name} усугубилась`, `${p.name} играл через боль и усугубил повреждение. Пропустит ещё ${p.injury.gamesLeft} игр.`, []);
      }
      continue;
    }
    if (!lineup.skaters.includes(p) && lineup.goalie !== p) continue;
    const base = 0.018;
    const fatigueMod = p.fatigue > 70 ? 1.6 : p.fatigue > 50 ? 1.2 : 1.0;
    const medicalMod = 1 - (team.infrastructure.medical * 0.05) - ((team.staff.doctor?.level || 0) * 0.03);
    if (rng() < base * fatigueMod * Math.max(0.2, medicalMod)) {
      const severity = rng() < 0.7 ? 'minor' : 'major';
      const baseDur = severity === 'minor' ? randInt(1, 5) : randInt(8, 25);
      p.injury = { gamesLeft: Math.max(1, Math.round(baseDur * Math.max(0.4, medicalMod))), severity };
      p.injuryPolicy = null;
      if (p.ovr >= 78) addNews('injury', `${p.name} (${team.name}) получил ${severity === 'major' ? 'серьёзную' : 'лёгкую'} травму — ${p.injury.gamesLeft} игр`, 2);
      if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `${p.name} получил травму`, `Травма: ${severity === 'major' ? 'серьёзная' : 'лёгкая'}, пропустит ${p.injury.gamesLeft} игр.`, []);
    }
  }
}
function updateFatigue(team, lineup) {
  const physMod = 1 - ((team.staff.physicalCoach?.level || 0) * 0.05) - (team.infrastructure.training * 0.02);
  const benchSet = new Set(team.bench || []);
  for (const p of team.roster) {
    if (benchSet.has(p.id)) { p.fatigue = Math.max(0, p.fatigue - 8); continue; }
    const played = lineup.skaters.includes(p) || lineup.goalie === p;
    if (played) {
      let base = p.position === 'G' ? 3 : 4;
      if (p.character === 'worker') base *= 1.2;
      if (p.position !== 'G' && team.lines) {
        for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
          if (team.lines[key].players.includes(p.id)) {
            const role = LINE_ROLES[team.lines[key].role] || LINE_ROLES.energy;
            base *= role.fatigue;
            break;
          }
        }
      }
      p.fatigue = Math.min(100, p.fatigue + Math.max(1, Math.round(base * physMod)));
    }
    p.fatigue = Math.max(0, p.fatigue - 4);
  }
}
function updateFormMorale(team, lineup, won) {
  const leaders = team.roster.filter(p => p.character === 'leader');
  const hasEgoists = team.roster.filter(p => p.character === 'egoist').length;
  for (const p of team.roster) {
    const played = lineup.skaters.includes(p) || lineup.goalie === p;
    p.form += (70 - p.form) * 0.08;
    if (p.character === 'worker' && played) p.form += 2;
    if (p.character !== 'calm') {
      if (played) {
        p.form += won ? randInt(2, 6) : -randInt(2, 6);
        p.morale += won ? randInt(1, 3) : -randInt(1, 3);
      } else p.morale -= 1;
    } else {
      if (played) p.form += won ? randInt(1, 3) : -randInt(1, 3);
    }
    if (won && leaders.length) p.morale += leaders.length;
    if (!won && leaders.length) p.morale -= leaders.length;
    if (p.character === 'egoist' && !won) p.morale -= 2;
    if (hasEgoists >= 2 && rng() < 0.05) {
      const egoists = team.roster.filter(x => x.character === 'egoist');
      for (const e of egoists) e.morale -= 2;
    }
    p.form = clamp(Math.round(p.form), 30, 99);
    p.morale = clamp(Math.round(p.morale), 20, 100);
  }
}

/* ============================================================
   FANBASE / СЕРИИ / НОВОСТИ / ПОЧТА
   ============================================================ */
function updateFanbase(team, won) {
  if (!team.streak) team.streak = { type: null, count: 0 };
  let delta = won ? 0.02 : -0.02;
  if (team.finance.merchLevel && team.finance.merchLevel >= 3 && won) delta += 0.01;
  if (team.streak.type === 'w' && won) team.streak.count++;
  else if (team.streak.type === 'l' && !won) team.streak.count++;
  else { team.streak.type = won ? 'w' : 'l'; team.streak.count = 1; }
  if (team.streak.type === 'w' && team.streak.count === 5) { delta += 0.10; addNews('streak', `${team.name} одержал 5 побед подряд`, 3); }
  else if (team.streak.type === 'l' && team.streak.count === 5) { delta -= 0.10; addNews('streak', `${team.name} терпит 5 поражений подряд`, 3); }
  team.finance.fanBase = clamp(team.finance.fanBase + delta, 0.15, 1.0);
}
function addNews(type, text, importance = 1) {
  if (!G.league.news) G.league.news = [];
  G.league.news.push({ id: nextId(), type, text, importance, season: G.league.season, round: G.league.currentRound });
  if (G.league.news.length > 200) G.league.news = G.league.news.slice(-200);
}
function addInboxMessage(type, from, subject, body, actions = []) {
  if (!G.league.inbox) G.league.inbox = [];
  const msg = { id: nextId(), type, from, subject, body, actions: actions.map(a => ({ ...a })), read: false, season: G.league.season, round: G.league.currentRound };
  G.league.inbox.push(msg);
  if (G.league.inbox.length > 100) {
    const unread = G.league.inbox.filter(m => !m.read);
    const readOld = G.league.inbox.filter(m => m.read).slice(0, Math.max(0, 100 - unread.length - 1));
    G.league.inbox = [...readOld, ...unread, msg].slice(-100);
  }
  return msg;
}
function markInboxRead(id) { const m = G.league.inbox.find(x => x.id === id); if (m) m.read = true; }
function markAllInboxRead() { (G.league.inbox || []).forEach(m => m.read = true); render(); }
function unreadInboxCount() { return (G.league.inbox || []).filter(m => !m.read).length; }
function executeInboxAction(msgId, actionIdx) {
  const msg = (G.league.inbox || []).find(m => m.id === msgId);
  if (!msg) return;
  const action = msg.actions[actionIdx];
  if (!action) { msg.read = true; render(); return; }
  const a = action.action, p = action.payload || {};
  if (a === 'trade_accept') acceptAITradeOffer(p.offerId);
  else if (a === 'trade_decline') declineAITradeOffer(p.offerId);
  // #12: ветки extend_contract и rehab удалены — они не генерируются ни одной функцией.
  // Их роль выполняют кнопки в renderModal() (продление контракта и реабилитация).
  msg.read = true;
  msg.actions = [];
  render();
}
