/* ============================================================
   LIVE MATCH — состояние, движок, штрафы, PP
   ------------------------------------------------------------
   Логика:
   • Период = 1200 игровых секунд, тик = 5 игровых секунд
   • Скорость умножает, сколько игровых секунд проходит за 100мс реального
   • На каждом тике считаем prob(гол) из xG и PP-модификатора
   • На каждом тике независимо считаем prob(штраф)
   • 2 мин PP: если забивают — PP заканчивается
   • 5 мин мажор: играется до конца, даже если забили (но PP-модификатор снимается)
   • На перерыве можно менять тактику → xG пересчитывается для оставшихся периодов
   • ОТ — sudden death: гол в ОТ немедленно завершает матч
   ============================================================ */

const LIVE_PERIOD_SEC = 1200;   // 20 минут = 1200 сек
const LIVE_TICK_SEC = 5;         // 5 игровых секунд за тик
const LIVE_TICK_MS = 80;         // 80 мс реального времени на тик при 1x
const LIVE_PP_BOOST = 2.6;       // xG атакующей в PP × 2.6
const LIVE_PK_NERF  = 0.55;      // xG обороняющейся в PK × 0.55
const LIVE_PENALTY_RATE = 0.0065; // вероятность штрафа на тик на команду (~5.6 штрафов/матч)

function isMyGameInRound() {
  if (!G.playerTeamId) return null;
  if (G.league.currentRound >= G.league.schedule.length) return null;
  const round = G.league.schedule[G.league.currentRound];
  return round.find(([h, a]) => h === G.playerTeamId || a === G.playerTeamId) || null;
}

function startMyLiveMatch() {
  const myGame = isMyGameInRound();
  if (!myGame) { showToast('В этом туре у твоей команды нет матча'); return; }
  if (G.liveMatch) return;
  startLiveMatch(myGame[0], myGame[1], false);
}

function startLiveMatch(homeId, awayId, isPlayoff) {
  const home = G.league.teams.find(t => t.id === homeId);
  const away = G.league.teams.find(t => t.id === awayId);
  if (!home || !away) return;
  advanceInjuries(home); advanceInjuries(away);
  const homeLineup = getLineup(home), awayLineup = getLineup(away);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);

  const positions = { home: [], away: [], puck: { x: 100, y: 50, vx: 0, vy: 0 } };
  const formHome = buildFormation('home');
  const formAway = buildFormation('away');
  positions.home = formHome;
  positions.away = formAway;

  G.liveMatch = {
    homeId, awayId, isPlayoff: !!isPlayoff,
    hg: 0, ag: 0,
    period: 1,
    timeLeft: LIVE_PERIOD_SEC,
    totalSecPlayed: 0,
    paused: false,
    speed: 1,
    events: [],
    pbp: [],
    penalties: { home: [], away: [] },
    shots: { home: 0, away: 0 },
    xgTotal: { home: xgH, away: xgA },
    xgCurrent: { home: xgH, away: xgA },
    homeLineup, awayLineup, hTM, aTM,
    scorers: {},
    assisters: {},
    goalieStats: {
      home: { shots: 0, goals: 0 },
      away: { shots: 0, goals: 0 },
    },
    positions,
    isBreak: false,
    isFinished: false,
    ot: false,
    periodStarts: [0],
    lastGoalSide: null,
    goalFlashUntil: 0,
    intervalId: null,
  };

  livePushEvent({ type: 'period', text: `Период 1`, time: '20:00', period: 1 });
  G.liveMatch.pbp.push({ period: 1, time: '—', type: 'period', text: 'Период 1' });

  G.liveMatch.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  render();
}

function buildFormation(side) {
  const x = (a) => side === 'home' ? a : 200 - a;
  const slots = [
    { x: x(35),  y: 50, role: 'goalie' },
    { x: x(70),  y: 30, role: 'D' },
    { x: x(70),  y: 70, role: 'D' },
    { x: x(130), y: 25, role: 'F' },
    { x: x(140), y: 50, role: 'C' },
    { x: x(130), y: 75, role: 'F' },
  ];
  return slots.map((s, i) => ({ ...s, idx: i, baseX: s.x, baseY: s.y, x: s.x, y: s.y, vx: 0, vy: 0 }));
}

function livePushEvent(ev) {
  if (!G.liveMatch) return;
  G.liveMatch.events.unshift(ev);
  if (G.liveMatch.events.length > 80) G.liveMatch.events.pop();
  if (ev.type !== 'period' && ev.type !== 'shot') {
    G.liveMatch.pbp.push({ period: ev.period, time: ev.time, type: ev.type, text: ev.text });
  } else if (ev.type === 'shot' || ev.type === 'goal') {
    G.liveMatch.pbp.push({ period: ev.period, time: ev.time, type: ev.type, text: ev.text });
  }
}

function liveFmtTime(secLeft) {
  const m = Math.floor(secLeft / 60);
  const s = secLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function liveGetActivePenalties(side) {
  if (!G.liveMatch) return [];
  const t = G.liveMatch.totalSecPlayed;
  return G.liveMatch.penalties[side].filter(p => p.endsAt > t);
}

function liveIsPP(side) {
  const opp = side === 'home' ? 'away' : 'home';
  return liveGetActivePenalties(opp).length > 0;
}

function liveTick() {
  const lm = G.liveMatch;
  if (!lm || lm.paused || lm.isBreak || lm.isFinished) return;
  const tickSec = LIVE_TICK_SEC * lm.speed;
  let remaining = tickSec;
  while (remaining > 0 && !lm.isFinished && !lm.isBreak) {
    const step = Math.min(LIVE_TICK_SEC, remaining);
    remaining -= step;
    liveAdvance(step);
    if (lm.isFinished || lm.isBreak) break;
  }
  if (typeof drawLiveCanvas === 'function') drawLiveCanvas();
  if (typeof updateLiveClock === 'function') updateLiveClock();
}

function liveAdvance(stepSec) {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const tBefore = lm.totalSecPlayed;
  const tNow = tBefore + stepSec;
  for (const side of ['home', 'away']) {
    lm.penalties[side] = lm.penalties[side].filter(p => p.endsAt > tNow);
  }

  const homePP = liveIsPP('home');
  const awayPP = liveIsPP('away');

  const hXg = lm.xgCurrent.home;
  const aXg = lm.xgCurrent.away;

  let hMod = 1, aMod = 1;
  if (homePP) { hMod *= LIVE_PP_BOOST; aMod *= LIVE_PK_NERF; }
  if (awayPP) { aMod *= LIVE_PP_BOOST; hMod *= LIVE_PK_NERF; }

  const pH = hXg * hMod * (stepSec / 3600);
  const pA = aXg * aMod * (stepSec / 3600);

  const rGoal = rng();
  if (rGoal < pH) { liveGoal('home'); if (lm.isFinished) return; }
  else if (rGoal < pH + pA) { liveGoal('away'); if (lm.isFinished) return; }
  else {
    const rPen = rng();
    if (rPen < LIVE_PENALTY_RATE * 2) {
      livePenalty('home');
    } else if (rPen < LIVE_PENALTY_RATE * 4) {
      livePenalty('away');
    } else {
      const rShot = rng();
      if (rShot < 0.6) {
        lm.shots.home++;
        lm.goalieStats.away.shots++;
        const p = pickWeighted(lm.homeLineup.skaters, shotWeight);
        const isPlayoff = lm.isPlayoff;
        (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++;
        livePushEvent({ type: 'shot', text: `${p.name} (${p.position}) бросает — ${pick(['сейв','сейв','сейв','мимо','штанга'])}.`, time: liveFmtTime(lm.timeLeft), period: lm.period });
      }
    }
  }

  lm.timeLeft -= stepSec;
  lm.totalSecPlayed = tNow;
  if (lm.timeLeft <= 0) {
    liveEndPeriod();
  }
}

function liveGoal(side) {
  const lm = G.liveMatch;
  if (!lm) return;
  const scoringLineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
  const concedingLineup = side === 'home' ? lm.awayLineup : lm.homeLineup;
  const isPlayoff = lm.isPlayoff;
  const scorer = pickWeighted(scoringLineup.skaters, scorerWeight);

  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) {
    addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  }

  const numAssists = rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assistPool = scoringLineup.skaters.filter(p => p.id !== scorer.id);
  const assisters = [];
  for (let i = 0; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }

  if (side === 'home') lm.hg++; else lm.ag++;
  lm.goalieStats[side === 'home' ? 'away' : 'home'].goals++;
  lm.shots[side]++;
  lm.goalieStats[side === 'home' ? 'away' : 'home'].shots++;
  lm.lastGoalSide = side;
  lm.goalFlashUntil = Date.now() + 1200;

  if (liveIsPP(side)) {
    const oppSide = side === 'home' ? 'away' : 'home';
    for (const p of lm.penalties[oppSide]) {
      if (p.endsAt > lm.totalSecPlayed && p.type === '2' && !p.scoredDuringPP) {
        p.endsAt = lm.totalSecPlayed;
      } else if (p.type === '5') {
        p.scoredDuringPP = true;
      }
    }
    lm.penalties[oppSide] = lm.penalties[oppSide].filter(p => p.endsAt > lm.totalSecPlayed);
  }

  const onIceScoring = new Set([scorer.id, ...assisters.map(a => a.id)]);
  while (onIceScoring.size < 5 && onIceScoring.size < scoringLineup.skaters.length) onIceScoring.add(pickWeighted(scoringLineup.skaters, x => x.ovr).id);
  for (const p of scoringLineup.skaters) if (onIceScoring.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus++;
  for (const p of concedingLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus--;

  lm.scorers[scorer.id] = (lm.scorers[scorer.id] || 0) + 1;
  for (const a of assisters) lm.assisters[a.id] = (lm.assisters[a.id] || 0) + 1;

  const assistNames = assisters.map(a => a.name).join(', ');
  const sideName = side === 'home' ? G.league.teams.find(t => t.id === lm.homeId).name : G.league.teams.find(t => t.id === lm.awayId).name;
  const txt = `ГОЛ! ${scorer.name} (${scorer.position})${assisters.length ? ` — ассист: ${assistNames}` : ''} [${sideName}]`;
  livePushEvent({ type: 'goal', side, text: txt, time: liveFmtTime(lm.timeLeft), period: lm.period });

  const goalX = side === 'home' ? 195 : 5;
  lm.positions.puck.x = goalX;
  lm.positions.puck.y = 50;

  // ⚙️ ФИКС #2: sudden death в ОТ — гол немедленно завершает матч
  if (lm.period === 4) {
    lm.isFinished = true;
    if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
    finishLiveMatch();
    return;
  }
}

function livePenalty(side) {
  const lm = G.liveMatch;
  const lineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
  if (!lineup.skaters.length) return;
  const p = pick(lineup.skaters);
  const isMajor = rng() < 0.12;
  const duration = isMajor ? 300 : 120;
  const type = isMajor ? '5' : '2';
  const isPlayoff = lm.isPlayoff;
  (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).pim += isMajor ? 5 : 2;
  lm.penalties[side].push({
    playerId: p.id, playerName: p.name,
    endsAt: lm.totalSecPlayed + duration,
    type,
    scoredDuringPP: false,
  });
  const reason = isMajor ? pick(['удар в голову','драка','атака вратаря']) : pick(['задержка','подножка','грубость','толчок','удар соперника']);
  const sideName = side === 'home' ? G.league.teams.find(t => t.id === lm.homeId).name : G.league.teams.find(t => t.id === lm.awayId).name;
  livePushEvent({
    type: 'penalty',
    side,
    text: `${isMajor ? '5 мин (мажор)' : '2 мин'}: ${p.name} (${p.position}) [${sideName}] — ${reason}.`,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });
}

function liveEndPeriod() {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const isLast = lm.period >= 3;
  const tied = lm.hg === lm.ag;
  if (isLast && !tied) {
    lm.isFinished = true;
    finishLiveMatch();
    return;
  }
  if (isLast && tied) {
    // ⚙️ ФИКС #2: если ОТ уже сыгран и снова ничья — финиш (в реальности буллиты)
    if (lm.period === 4) {
      lm.isFinished = true;
      finishLiveMatch();
      return;
    }
    lm.period = 4;
    lm.timeLeft = 300;
    lm.ot = true;
    livePushEvent({ type: 'period', text: 'Овертайм', time: '05:00', period: 4 });
    lm.pbp.push({ period: 4, time: '—', type: 'period', text: 'Овертайм' });
    lm.periodStarts.push(lm.totalSecPlayed);
    return;
  }
  lm.isBreak = true;
  lm.paused = true;
  // ⚙️ ФИКС #14: чистим интервал на перерыве (не жечь CPU)
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
}

function liveResumeFromBreak() {
  const lm = G.liveMatch;
  if (!lm) return;
  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);
  lm.xgCurrent.home = xgH;
  lm.xgCurrent.away = xgA;
  lm.hTM = hTM; lm.aTM = aTM;
  lm.period++;
  lm.timeLeft = lm.period === 4 ? 300 : LIVE_PERIOD_SEC;
  lm.periodStarts.push(lm.totalSecPlayed);
  lm.isBreak = false;
  lm.paused = false;
  // ⚙️ ФИКС #14: перезапускаем интервал
  if (!lm.intervalId && !lm.isFinished) {
    lm.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  }
  livePushEvent({ type: 'period', text: lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`, time: lm.period === 4 ? '05:00' : '20:00', period: lm.period });
  lm.pbp.push({ period: lm.period, time: '—', type: 'period', text: lm.period === 4 ? 'Овертайм' : `Период ${lm.period}` });
  render();
}

function finishLiveMatch() {
  const lm = G.liveMatch;
  if (!lm) return;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
  lm.isFinished = true;

  const res = {
    homeId: lm.homeId, awayId: lm.awayId,
    hg: lm.hg, ag: lm.ag, ot: lm.ot,
    pbp: lm.pbp.slice(),
    round: G.league.currentRound,
  };

  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const isPlayoff = lm.isPlayoff;
  if (lm.awayLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.awayLineup.goalie) : ensureStats(lm.awayLineup.goalie);
    s.gp++; s.shotsAgainst += lm.shots.home; s.goalsAgainst += lm.hg; s.saves += Math.max(0, lm.shots.home - lm.hg);
    if (lm.hg === 0) s.shutouts++;
    if (lm.hg < lm.ag) s.wins++; else if (lm.hg > lm.ag) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.homeLineup.goalie) : ensureStats(lm.homeLineup.goalie);
    s.gp++; s.shotsAgainst += lm.shots.away; s.goalsAgainst += lm.ag; s.saves += Math.max(0, lm.shots.away - lm.ag);
    if (lm.ag === 0) s.shutouts++;
    if (lm.ag < lm.hg) s.wins++; else if (lm.ag > lm.hg) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) updateGoalieStatus(home, lm.homeLineup.goalie, lm.ag, lm.shots.away);
  if (lm.awayLineup.goalie) updateGoalieStatus(away, lm.awayLineup.goalie, lm.hg, lm.shots.home);
  for (const p of lm.homeLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  for (const p of lm.awayLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;

  checkInjuries(home, lm.homeLineup); checkInjuries(away, lm.awayLineup);
  updateFatigue(home, lm.homeLineup); updateFatigue(away, lm.awayLineup);
  updateFormMorale(home, lm.homeLineup, lm.hg > lm.ag); updateFormMorale(away, lm.awayLineup, lm.ag > lm.hg);
  updateLineChemistry(home, lm.hg > lm.ag, lm.homeLineup); updateLineChemistry(away, lm.ag > lm.hg, lm.awayLineup);

  if (!isPlayoff) {
    updateFanbase(home, lm.hg > lm.ag); updateFanbase(away, lm.ag > lm.hg);
    const homeExpected = fanExpectation(home, away, true);
    const awayExpected = fanExpectation(away, home, false);
    applyFanExpectation(home, homeExpected, lm.hg > lm.ag, true);
    applyFanExpectation(away, awayExpected, lm.ag > lm.hg, false);
  }

  home._lastPlayedIds = [...lm.homeLineup.skaters, lm.homeLineup.goalie].filter(Boolean).map(p => p.id);
  away._lastPlayedIds = [...lm.awayLineup.skaters, lm.awayLineup.goalie].filter(Boolean).map(p => p.id);
  processTryouts(home); processTryouts(away);
  for (const team of [home, away]) if (team.staff.psychologist) for (const p of team.roster) p.morale = clamp(p.morale + 1, 20, 100);

  applyResult(res);
  G.league.results.push(res);

  if (!isPlayoff) {
    const round = G.league.schedule[G.league.currentRound];
    const others = round.filter(([h, a]) => !(h === lm.homeId && a === lm.awayId) && !(h === lm.awayId && a === lm.homeId));
    others.forEach(([h, a]) => {
      if (h === G.playerTeamId || a === G.playerTeamId) return;
      const r = simGame(h, a, false); r.round = G.league.currentRound; applyResult(r); G.league.results.push(r);
    });
    G.league.currentRound++;
    G.league.teams.forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); });
    if (G.league.currentRound % 10 === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
    if (G.league.currentRound % 3 === 0) processWaivers();
    if (G.league.currentRound % 4 === 0) runAIActions();
    if (G.league.currentRound % 8 === 0) updateStaffPool();
    if (G.league.currentRound % 3 === 0 && rng() < 0.3) generateRandomEvent();
    G.league.teams.forEach(t => checkScoutMission(t));
    generateBoardMessage();
    checkTradeDeadlineNews();
    if (G.league.currentRound === 15 && !G.league.retroMatch) triggerRetroMatch();
    if (G.league.currentRound === G.league.schedule.length) createPlayoffs();
    maybeStartPressConference();
    if (G.playerTeamId) {
      if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; G.liveMatch = null; render(); return; } }
      else { if (maybeFirePlayer()) { G.activeTab = 'career'; G.liveMatch = null; render(); return; } }
    }
  }

  render();
}

function exitLiveMatchEarly() {
  const lm = G.liveMatch;
  if (!lm) return;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }

  // ⚙️ ФИКС #3: корректный расчёт остатка времени
  // — если в ОТ: только остаток текущего ОТ
  // — если в регуляке: остаток текущего периода + все оставшиеся периоды
  const remInCurrent = Math.max(0, lm.timeLeft);
  const periodNow = lm.period;
  let totalRemSec;
  if (periodNow === 4) {
    totalRemSec = remInCurrent;
  } else {
    totalRemSec = remInCurrent + (3 - periodNow) * LIVE_PERIOD_SEC;
  }

  const hXg = lm.xgCurrent.home, aXg = lm.xgCurrent.away;
  const addH = poisson(hXg * totalRemSec / 3600);
  const addA = poisson(aXg * totalRemSec / 3600);
  lm.hg += addH; lm.ag += addA;
  // добавляем броски пропорционально голам, чтобы не сломать SV% совсем уж грубо
  lm.shots.home += addH;
  lm.shots.away += addA;

  // Если после регуляки всё ещё ничья — ОТ (или буллиты, если ОТ не помог)
  if (lm.hg === lm.ag && periodNow < 4) {
    lm.ot = true;
    const otH = poisson(hXg * (300 / 3600));
    const otA = poisson(aXg * (300 / 3600));
    lm.hg += otH; lm.ag += otA;
    lm.shots.home += otH;
    lm.shots.away += otA;
    if (lm.hg === lm.ag) {
      if (rng() < 0.5) lm.hg++; else lm.ag++;
    }
  }

  finishLiveMatch();
}

function closeLiveMatchModal() {
  if (!G.liveMatch) return;
  if (G.liveMatch.intervalId) { clearInterval(G.liveMatch.intervalId); G.liveMatch.intervalId = null; }
  G.liveMatch = null;
  render();
}

/* ============================================================
   LIVE — CANVAS RENDER + UI SCREEN
   ============================================================ */
let _liveCanvasEl = null;
let _liveRafId = null;

function drawLiveCanvas() {
  const lm = G.liveMatch;
  if (!lm) return;
  let canvas = document.getElementById('live-canvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (wrap && wrap.clientWidth > 0) {
    const targetW = wrap.clientWidth - 24;
    const targetH = Math.round(targetW * 0.5);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);

  const vx = (x) => (x / 200) * W;
  const vy = (y) => (y / 100) * H;

  ctx.fillStyle = '#e8eef8';
  ctx.fillRect(vx(3), vy(3), vx(197) - vx(3), vy(97) - vy(3));

  ctx.strokeStyle = '#b8c4d8';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(vx(100), vy(3)); ctx.lineTo(vx(100), vy(97)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(vx(60), vy(3)); ctx.lineTo(vx(60), vy(97)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx(140), vy(3)); ctx.lineTo(vx(140), vy(97)); ctx.stroke();
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
  const faceCircles = [
    { x: 30, y: 30 }, { x: 30, y: 70 }, { x: 70, y: 30 }, { x: 70, y: 70 },
    { x: 130, y: 30 }, { x: 130, y: 70 }, { x: 170, y: 30 }, { x: 170, y: 70 },
  ];
  for (const c of faceCircles) {
    ctx.beginPath();
    ctx.arc(vx(c.x), vy(c.y), Math.min(vx(8) - vx(0), vy(16) - vy(0)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(vx(100), vy(50), Math.min(vx(10) - vx(0), vy(20) - vy(0)), 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(vx(2), vy(42), vx(6) - vx(2), vy(58) - vy(42));
  ctx.fillRect(vx(194), vy(42), vx(198) - vx(194), vy(58) - vy(42));
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
  ctx.strokeRect(vx(3), vy(3), vx(197) - vx(3), vy(97) - vy(3));

  ctx.fillStyle = 'rgba(15,17,23,0.15)';
  ctx.font = `bold ${Math.max(10, Math.round(W / 60))}px -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  const homeTeam = G.league.teams.find(t => t.id === lm.homeId);
  const awayTeam = G.league.teams.find(t => t.id === lm.awayId);
  if (homeTeam) ctx.fillText(homeTeam.shortName || homeTeam.name, vx(8), vy(12));
  ctx.textAlign = 'right';
  if (awayTeam) ctx.fillText(awayTeam.shortName || awayTeam.name, vx(192), vy(12));

  const drawPlayer = (p, side) => {
    const x = vx(p.x), y = vy(p.y);
    const r = Math.max(5, Math.round(W / 100));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (p.role === 'goalie') {
      ctx.fillStyle = side === 'home' ? '#ff6b35' : '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = '#0f1117';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = side === 'home' ? '#ff6b35' : '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = '#0f1117';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  for (const p of lm.positions.home) drawPlayer(p, 'home');
  for (const p of lm.positions.away) drawPlayer(p, 'away');

  const puckX = vx(lm.positions.puck.x);
  const puckY = vy(lm.positions.puck.y);
  ctx.beginPath();
  ctx.arc(puckX, puckY, Math.max(3, Math.round(W / 160)), 0, Math.PI * 2);
  ctx.fillStyle = '#0f1117';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (lm.goalFlashUntil > Date.now()) {
    const alpha = clamp((lm.goalFlashUntil - Date.now()) / 1200, 0, 1);
    ctx.fillStyle = `rgba(74,222,128,${alpha * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(15,17,23,0.4)';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(10, Math.round(W / 70))}px -apple-system, sans-serif`;
  ctx.fillText(`Период ${lm.period}`, vx(100), vy(95));
}

function updateLiveClock() {
  const lm = G.liveMatch;
  if (!lm) return;
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = liveFmtTime(Math.max(0, Math.ceil(lm.timeLeft)));
  const periodEl = document.getElementById('live-period-info');
  if (periodEl) {
    let txt = lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`;
    if (lm.isBreak) txt += ' — перерыв';
    if (lm.isFinished) txt += ' — матч завершён';
    periodEl.textContent = txt;
  }
  const homeScoreEl = document.getElementById('live-score-home');
  const awayScoreEl = document.getElementById('live-score-away');
  if (homeScoreEl) homeScoreEl.textContent = lm.hg;
  if (awayScoreEl) awayScoreEl.textContent = lm.ag;

  const ppEl = document.getElementById('live-pp-banner');
  if (ppEl) {
    const hp = liveGetActivePenalties('home');
    const ap = liveGetActivePenalties('away');
    const parts = [];
    if (hp.length) parts.push(`${awayTeamNameShort()} в большинстве (${hp.map(p => p.type + ' мин').join(', ')})`);
    if (ap.length) parts.push(`${homeTeamNameShort()} в большинстве (${ap.map(p => p.type + ' мин').join(', ')})`);
    if (parts.length) { ppEl.textContent = '⚠ ' + parts.join(' · '); ppEl.style.display = 'block'; }
    else ppEl.style.display = 'none';
  }

  const feedEl = document.getElementById('live-feed');
  if (feedEl) {
    const html = lm.events.slice(0, 30).map(ev => {
      const cls = ev.type === 'goal' ? 'goal' : ev.type === 'penalty' ? 'penalty' : ev.type === 'period' ? 'period' : 'shot';
      return `<div class="live-feed-item ${cls}"><span class="lfi-time">[${ev.time || '—'}]</span>${ev.text}</div>`;
    }).join('');
    if (feedEl.dataset.sig !== String(lm.events.length) + '|' + (lm.events[0]?.text || '')) {
      feedEl.innerHTML = html;
      feedEl.dataset.sig = String(lm.events.length) + '|' + (lm.events[0]?.text || '');
    }
  }
}

function homeTeamNameShort() {
  if (!G.liveMatch) return '';
  const t = G.league.teams.find(x => x.id === G.liveMatch.homeId);
  return t ? (t.shortName || t.name) : '';
}
function awayTeamNameShort() {
  if (!G.liveMatch) return '';
  const t = G.league.teams.find(x => x.id === G.liveMatch.awayId);
  return t ? (t.shortName || t.name) : '';
}

function liveUpdatePositions() {
  const lm = G.liveMatch;
  if (!lm) return;
  const puck = lm.positions.puck;
  const drift = (p) => {
    p.vx += (rng() - 0.5) * 0.3;
    p.vy += (rng() - 0.5) * 0.3;
    p.vx += (p.baseX - p.x) * 0.02;
    p.vy += (p.baseY - p.y) * 0.02;
    const dx = puck.x - p.x, dy = puck.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 40 && p.role !== 'goalie') {
      p.vx += dx * 0.02;
      p.vy += dy * 0.02;
    }
    p.vx = clamp(p.vx, -1.2, 1.2);
    p.vy = clamp(p.vy, -1.2, 1.2);
    p.x += p.vx;
    p.y += p.vy;
    p.x = clamp(p.x, 5, 195);
    p.y = clamp(p.y, 5, 95);
  };
  lm.positions.home.forEach(drift);
  lm.positions.away.forEach(drift);
  puck.x += (100 - puck.x) * 0.01;
  puck.y += (50 - puck.y) * 0.01;
}

function liveAnimationLoop() {
  if (!G.liveMatch) { _liveRafId = null; return; }
  const lm = G.liveMatch;
  if (!lm.paused && !lm.isBreak && !lm.isFinished) {
    liveUpdatePositions();
    drawLiveCanvas();
  }
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function startLiveAnimation() {
  if (_liveRafId) return;
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function stopLiveAnimation() {
  if (_liveRafId) { cancelAnimationFrame(_liveRafId); _liveRafId = null; }
}
