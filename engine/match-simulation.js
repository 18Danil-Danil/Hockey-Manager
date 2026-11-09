/* ============================================================
   СИМУЛЯЦИЯ МАТЧА (быстрая, без LIVE)
   ============================================================ */
function scorerWeight(p) { const base = p.position === 'D' ? 0.35 : 1.0; const egoBonus = p.character === 'egoist' ? 1.05 : 1.0; return base * egoBonus * (p.attrs.shooting * 0.7 + p.attrs.skating * 0.3) * (0.5 + p.form / 100); }
function assistWeight(p) { return (p.attrs.passing * 0.7 + p.attrs.iq * 0.3) * (0.5 + p.form / 100); }
function shotWeight(p) { return p.attrs.shooting * (0.5 + p.form / 100); }
function simulateGoalEvent(scoringLineup, concedingLineup, period, isPlayoff) {
  const scorer = pickWeighted(scoringLineup.skaters, scorerWeight);
  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  const numAssists = rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assistPool = scoringLineup.skaters.filter(p => p.id !== scorer.id); const assisters = [];
  for (let i = 0; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }
  const onIceScoring = new Set([scorer.id, ...assisters.map(a => a.id)]);
  while (onIceScoring.size < 5 && onIceScoring.size < scoringLineup.skaters.length) onIceScoring.add(pickWeighted(scoringLineup.skaters, x => x.ovr).id);
  const onIceConceding = new Set();
  while (onIceConceding.size < 5 && onIceConceding.size < concedingLineup.skaters.length) onIceConceding.add(pickWeighted(concedingLineup.skaters, x => x.ovr).id);
  for (const p of scoringLineup.skaters) if (onIceScoring.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus++;
  for (const p of concedingLineup.skaters) if (onIceConceding.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus--;
  const assistNames = assisters.map(a => a.name).join(', ');
  return { type: 'goal', player: scorer, pbp: { period: period || randInt(1, 3), time: randomTime(), type: 'goal', text: `ГОЛ! ${scorer.name} (${scorer.position})${assisters.length ? ` — ассист: ${assistNames}` : ''}.` } };
}
function updateGoalieStatus(team, playedGoalie, ga, shotsAgainst) {
  for (const p of team.roster) {
    if (p.position !== 'G') continue;
    if (playedGoalie && p.id === playedGoalie.id) {
      p.goalieStreak = (p.goalieStreak || 0) + 1;
      const sv = shotsAgainst > 0 ? (shotsAgainst - ga) / shotsAgainst : 1;
      p.lastGameBad = ga >= 4 || sv < 0.85;
    } else { p.goalieStreak = 0; p.lastGameBad = false; }
  }
}

/* Быстрый расчёт xG на матч (не для LIVE). Упрощённые штрафы per-period. */
function computeXG(home, away, hTM, aTM) {
  const hAtt = teamAttackRating(home), aAtt = teamAttackRating(away);
  const hDef = teamDefenseRating(home), aDef = teamDefenseRating(away);
  const hLineMods = teamLineMods(home), aLineMods = teamLineMods(away);
  let xgH = clamp(2.8 + (hAtt - aDef) * 0.08 + 0.3, 0.4, 7.5);
  let xgA = clamp(2.8 + (aAtt - hDef) * 0.08, 0.4, 7.5);
  const homeAdvantage = home.finance.fanBase > 0.80 ? 1.05 : home.finance.fanBase < 0.30 ? 0.95 : 1.0;
  xgH = clamp(xgH * homeAdvantage * (1 + hTM.atkMod - aTM.defMod + hLineMods.atk - aLineMods.def), 0.4, 7.5);
  xgA = clamp(xgA * (1 + aTM.atkMod - hTM.defMod + aLineMods.atk - hLineMods.def), 0.4, 7.5);
  return { xgH, xgA, hAtt, aAtt, hDef, aDef };
}

function simGame(homeId, awayId, isPlayoff = false) {
  const home = G.league.teams.find(t => t.id === homeId), away = G.league.teams.find(t => t.id === awayId);
  advanceInjuries(home); advanceInjuries(away);
  const homeLineup = getLineup(home), awayLineup = getLineup(away);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);
  let hg = poisson(xgH), ag = poisson(xgA), ot = false, otWinner = null;
  if (hg === ag) { ot = true; if (rng() < clamp(0.5 + (teamAttackRating(home) + teamDefenseRating(home) - teamAttackRating(away) - teamDefenseRating(away)) * 0.005, 0.3, 0.7)) { hg++; otWinner = 'h'; } else { ag++; otWinner = 'a'; } }
  const hShots = Math.max(hg, Math.round(poisson(24))), aShots = Math.max(ag, Math.round(poisson(22)));
  const allEvents = [];
  for (let i = 0; i < hg; i++) { const isOt = otWinner === 'h' && i === hg - 1; allEvents.push(simulateGoalEvent(homeLineup, awayLineup, isOt ? 4 : null, isPlayoff).pbp); }
  for (let i = 0; i < ag; i++) { const isOt = otWinner === 'a' && i === ag - 1; allEvents.push(simulateGoalEvent(awayLineup, homeLineup, isOt ? 4 : null, isPlayoff).pbp); }
  for (let i = 0; i < hShots - hg; i++) { const p = pickWeighted(homeLineup.skaters, shotWeight); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++; allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'shot', text: `${p.name} (${p.position}) бросает — сейв.` }); }
  for (let i = 0; i < aShots - ag; i++) { const p = pickWeighted(awayLineup.skaters, shotWeight); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++; allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'shot', text: `${p.name} (${p.position}) бросает — сейв.` }); }
  const basePens = randInt(3, 5), hPenExtra = Math.round(hTM.penRisk * 2), aPenExtra = Math.round(aTM.penRisk * 2);
  for (let i = 0; i < basePens + hPenExtra + aPenExtra; i++) {
    const isHome = rng() < 0.5; const lineup = isHome ? homeLineup : awayLineup;
    const p = pick(lineup.skaters); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).pim += 2;
    allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'penalty', text: `2 мин: ${p.name} (${p.position}) — ${pick(['задержка','подножка','грубость','толчок','удар соперника'])}.` });
  }
  for (let i = 0; i < 2; i++) allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'faceoff', text: 'Вбрасывание.' });
  allEvents.sort((a, b) => a.period !== b.period ? a.period - b.period : timeToSec(a.time) - timeToSec(b.time));
  const pbp = []; const maxPeriod = ot ? 4 : 3; let cur = 0;
  for (const ev of allEvents) { while (cur < ev.period) { cur++; pbp.push({ period: cur, time: '—', type: 'period', text: cur === 4 ? 'Овертайм' : `Период ${cur}` }); } pbp.push(ev); }
  while (cur < maxPeriod) { cur++; pbp.push({ period: cur, time: '—', type: 'period', text: cur === 4 ? 'Овертайм' : `Период ${cur}` }); }
  if (awayLineup.goalie) { const s = isPlayoff ? ensurePlayoffStats(awayLineup.goalie) : ensureStats(awayLineup.goalie); s.gp++; s.shotsAgainst += hShots; s.goalsAgainst += hg; s.saves += hShots - hg; if (hg === 0) s.shutouts++; if (hg < ag) s.wins++; else if (hg > ag) { if (ot) s.otl++; else s.losses++; } }
  if (homeLineup.goalie) { const s = isPlayoff ? ensurePlayoffStats(homeLineup.goalie) : ensureStats(homeLineup.goalie); s.gp++; s.shotsAgainst += aShots; s.goalsAgainst += ag; s.saves += aShots - ag; if (ag === 0) s.shutouts++; if (ag < hg) s.wins++; else if (ag > hg) { if (ot) s.otl++; else s.losses++; } }
  if (homeLineup.goalie) updateGoalieStatus(home, homeLineup.goalie, ag, aShots);
  if (awayLineup.goalie) updateGoalieStatus(away, awayLineup.goalie, hg, hShots);
  for (const p of homeLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  for (const p of awayLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  checkInjuries(home, homeLineup); checkInjuries(away, awayLineup);
  updateFatigue(home, homeLineup); updateFatigue(away, awayLineup);
  updateFormMorale(home, homeLineup, hg > ag); updateFormMorale(away, awayLineup, ag > hg);
  updateLineChemistry(home, hg > ag, homeLineup); updateLineChemistry(away, ag > hg, awayLineup);
  if (!isPlayoff) {
    updateFanbase(home, hg > ag); updateFanbase(away, ag > hg);
    const homeExpected = fanExpectation(home, away, true);
    const awayExpected = fanExpectation(away, home, false);
    applyFanExpectation(home, homeExpected, hg > ag, true);
    applyFanExpectation(away, awayExpected, ag > hg, false);
  }
  // ⚙️ ФИКС TRYOUT: сохраняем кто реально играл, чтобы processTryouts не списал просмотрщикам, сидящим на скамейке
  home._lastPlayedIds = [...homeLineup.skaters, homeLineup.goalie].filter(Boolean).map(p => p.id);
  away._lastPlayedIds = [...awayLineup.skaters, awayLineup.goalie].filter(Boolean).map(p => p.id);
  processTryouts(home); processTryouts(away);
  for (const team of [home, away]) if (team.staff.psychologist) for (const p of team.roster) p.morale = clamp(p.morale + 1, 20, 100);
  return { homeId, awayId, hg, ag, ot, pbp };
}
function processTryouts(team) {
  const tryouts = team.roster.filter(p => p.status === 'tryout');
  const playedIds = new Set(team._lastPlayedIds || []);
  for (const p of tryouts) {
    // ⚙️ ФИКС: списываем игру только если игрок реально выходил на лёд
    if (!playedIds.has(p.id)) continue;
    p.tryoutGames--;
    if (p.tryoutGames <= 0) {
      if (p.ovr >= 68 && rng() < 0.6) { p.status = 'contract'; p.contract = contractFor(p.ovr, p.age); }
      else { const idx = team.roster.indexOf(p); if (idx !== -1) team.roster.splice(idx, 1); }
    }
  }
}
