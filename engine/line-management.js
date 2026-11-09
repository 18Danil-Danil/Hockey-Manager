/* ============================================================
   ЗВЕНЬЯ / ХИМИЯ / СТИЛИ / РОЛИ
   ============================================================ */
const LINE_STYLES = {
  balanced:   { label: 'Сбалансированное', atk: 0, def: 0 },
  aggressive: { label: 'Атакующее', atk: 0.08, def: -0.05 },
  defensive:  { label: 'Оборонительное', atk: -0.05, def: 0.08 },
};
const LINE_ROLES = {
  top6:     { label: 'Топ-6',       atk: 0.10, def: -0.05, fatigue: 1.3, develop: 0 },
  checking: { label: 'Чек-лайн',     atk: -0.05, def: 0.15, fatigue: 1.0, develop: 0 },
  energy:   { label: 'Энерджайзер',  atk: 0.00, def: 0.00, fatigue: 0.8, develop: 0 },
  youth:    { label: 'Молодёжное',   atk: -0.10, def: -0.05, fatigue: 0.6, develop: 0.3 },
};
function initLines(team) {
  const benchSet = new Set(team.bench || []);
  const fwd = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const def = team.roster.filter(p => p.position === 'D' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const gk = team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  team.lines = {
    f1: { players: fwd.slice(0,3).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    f2: { players: fwd.slice(3,6).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    f3: { players: fwd.slice(6,9).map(p => p.id), chemistry: 50, style: 'balanced', role: 'checking' },
    f4: { players: fwd.slice(9,12).map(p => p.id), chemistry: 50, style: 'balanced', role: 'youth' },
    d1: { players: def.slice(0,2).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    d2: { players: def.slice(2,4).map(p => p.id), chemistry: 50, style: 'balanced', role: 'checking' },
    d3: { players: def.slice(4,6).map(p => p.id), chemistry: 50, style: 'balanced', role: 'energy' },
    g1: gk[0]?.id || null, g2: gk[1]?.id || null,
  };
}
function syncLines(team) {
  if (!team.lines) { initLines(team); return; }
  const benchSet = new Set(team.bench || []);
  const ids = new Set(team.roster.map(p => p.id));
  const assigned = new Set();
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    team.lines[key].players = team.lines[key].players.filter(id => {
      if (!ids.has(id) || assigned.has(id) || benchSet.has(id)) return false;
      assigned.add(id); return true;
    });
    if (!team.lines[key].role) team.lines[key].role = 'energy';
    if (!team.lines[key].style) team.lines[key].style = 'balanced';
  }
  if (team.lines.g1 && (!ids.has(team.lines.g1) || assigned.has(team.lines.g1) || benchSet.has(team.lines.g1))) team.lines.g1 = null; else if (team.lines.g1) assigned.add(team.lines.g1);
  if (team.lines.g2 && (!ids.has(team.lines.g2) || assigned.has(team.lines.g2) || benchSet.has(team.lines.g2))) team.lines.g2 = null; else if (team.lines.g2) assigned.add(team.lines.g2);
  const freeFwd = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const freeDef = team.roster.filter(p => p.position === 'D' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const freeGk = team.roster.filter(p => p.position === 'G' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  for (const key of ['f1','f2','f3','f4']) while (team.lines[key].players.length < 3 && freeFwd.length) { const p = freeFwd.shift(); team.lines[key].players.push(p.id); assigned.add(p.id); }
  for (const key of ['d1','d2','d3']) while (team.lines[key].players.length < 2 && freeDef.length) { const p = freeDef.shift(); team.lines[key].players.push(p.id); assigned.add(p.id); }
  if (!team.lines.g1 && freeGk.length) team.lines.g1 = freeGk.shift().id;
  if (!team.lines.g2 && freeGk.length) team.lines.g2 = freeGk.shift().id;
}
function lineMods(line) {
  const chemBonus = (line.chemistry - 50) / 500;
  const style = LINE_STYLES[line.style] || LINE_STYLES.balanced;
  const role = LINE_ROLES[line.role] || LINE_ROLES.energy;
  return { atk: chemBonus + style.atk + role.atk, def: chemBonus + style.def + role.def };
}
function teamLineMods(team) {
  if (!team.lines) initLines(team);
  const f1 = lineMods(team.lines.f1), f2 = lineMods(team.lines.f2), f3 = lineMods(team.lines.f3), f4 = lineMods(team.lines.f4);
  const fAtk = f1.atk * 0.3 + f2.atk * 0.3 + f3.atk * 0.22 + f4.atk * 0.18;
  const fDef = f1.def * 0.3 + f2.def * 0.3 + f3.def * 0.22 + f4.def * 0.18;
  const d1 = lineMods(team.lines.d1), d2 = lineMods(team.lines.d2), d3 = lineMods(team.lines.d3);
  const dAtk = d1.atk * 0.4 + d2.atk * 0.4 + d3.atk * 0.2;
  const dDef = d1.def * 0.4 + d2.def * 0.4 + d3.def * 0.2;
  return { atk: fAtk * 0.6 + dAtk * 0.4, def: fDef * 0.5 + dDef * 0.5 };
}
function updateLineChemistry(team, won, playedLineup) {
  if (!team.lines) return;
  const playedIds = new Set(playedLineup.skaters.map(p => p.id));
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const line = team.lines[key];
    if (line.players.length === 0 || !line.players.every(id => playedIds.has(id))) continue;
    line.chemistry = clamp(line.chemistry + (won ? 1.2 : -0.6), 0, 100);
  }
}
function getYouthLineBonus(team, playerId) {
  if (!team.lines) return 0;
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const line = team.lines[key];
    if (line.role === 'youth' && line.players.includes(playerId)) return LINE_ROLES.youth.develop;
  }
  return 0;
}
function getMentor(team, youngId) {
  const young = team.roster.find(p => p.id === youngId);
  if (!young || young.age > 23 || !team.lines) return null;
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    if (team.lines[key].players.includes(youngId)) {
      for (const otherId of team.lines[key].players) {
        if (otherId === youngId) continue;
        const other = team.roster.find(p => p.id === otherId);
        if (other && other.age >= 30 && other.ovr >= 78) return other;
      }
    }
  }
  return null;
}
function findPlayerLine(team, id) {
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const idx = team.lines[key].players.indexOf(id);
    if (idx !== -1) return { lineKey: key, slotIdx: idx };
  }
  if (id === team.lines.g1) return { lineKey: 'g', slotIdx: 0 };
  if (id === team.lines.g2) return { lineKey: 'g', slotIdx: 1 };
  return null;
}
function setLineSlot(lineKey, slotIdx, playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.lines) return;
  if (lineKey === 'g') {
    const oldId = slotIdx === 0 ? team.lines.g1 : team.lines.g2;
    if (oldId === playerId) { render(); return; }
    const other = findPlayerLine(team, playerId);
    if (other && other.lineKey === 'g') {
      if (slotIdx === 0) { team.lines.g1 = playerId; team.lines.g2 = oldId; }
      else { team.lines.g2 = playerId; team.lines.g1 = oldId; }
    } else if (other) { render(); return; }
    else { if (slotIdx === 0) team.lines.g1 = playerId; else team.lines.g2 = playerId; }
    render(); return;
  }
  const line = team.lines[lineKey];
  const oldId = line.players[slotIdx];
  if (oldId === playerId) { render(); return; }
  const other = findPlayerLine(team, playerId);
  if (other && other.lineKey !== 'g') team.lines[other.lineKey].players[other.slotIdx] = oldId;
  line.players[slotIdx] = playerId; render();
}
function setLineStyle(lineKey, style) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (team && team.lines && team.lines[lineKey]) { team.lines[lineKey].style = style; render(); } }
function setLineRole(lineKey, role) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (team && team.lines && team.lines[lineKey]) { team.lines[lineKey].role = role; render(); } }
function resetLinesToOvr() { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return; team.lines = null; initLines(team); render(); }
function ensureAllLines() { if (!G.league) return; for (const t of G.league.teams) { if (!t.lines) initLines(t); else syncLines(t); if (!t.bench) t.bench = []; if (!t.streak) t.streak = { type: null, count: 0 }; } }
function sendToBench(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return;
  if (!team.bench) team.bench = [];
  if (team.bench.includes(playerId)) return;
  team.bench.push(playerId);
  team.lines = null; initLines(team); render();
}
function removeFromBench(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.bench) return;
  team.bench = team.bench.filter(id => id !== playerId);
  team.lines = null; initLines(team); render();
}
