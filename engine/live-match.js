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
const LIVE_XG_MULTIPLIER = 0.96; // LIVE-калибровка к средней результативности обычной симуляции
const LIVE_PP_BOOST = 1.8;       // умеренное усиление атаки в большинстве
const LIVE_PK_NERF  = 0.70;      // умеренное снижение атаки команды в меньшинстве
const LIVE_PENALTY_RATE = 0.00195; // вероятность штрафа на тик для каждой стороны
const LIVE_SHOT_RATE = 0.093;    // вероятность отдельного броска на тик без гола/штрафа

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
  // Новый визуальный seed не расходует и не изменяет игровой RNG.
  window.GAME_RNG.setVisualSeed(Date.now());
  advanceInjuries(home); advanceInjuries(away);
  const homeLineup = getLineup(home), awayLineup = getLineup(away);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM, homeLineup, awayLineup);
  const liveXgH = xgH * LIVE_XG_MULTIPLIER;
  const liveXgA = xgA * LIVE_XG_MULTIPLIER;

  const visualRng = window.GAME_RNG.visualRng;
  const initialPossessionSide = visualRng() < 0.5 ? 'home' : 'away';
  const positions = {
    home: [], away: [],
    puck: {
      x: 100, y: 50, vx: 0, vy: 0,
      possessionSide: initialPossessionSide,
      carrierIndex: 3 + Math.floor(visualRng() * 3),
      actionFrames: 80 + Math.floor(visualRng() * 70),
      looseFrames: 0,
    },
  };
  const formHome = buildFormation('home', homeLineup);
  const formAway = buildFormation('away', awayLineup);
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
    shots: { home: 0, away: 0 }, // броски в створ, учитываемые в статистике вратарей
    shotAttempts: { home: 0, away: 0 }, // все попытки, включая мимо и штанги
    shootout: false,
    shootoutAttempts: { home: 0, away: 0 },
    shootoutWinner: null,
    xgTotal: { home: liveXgH, away: liveXgA },
    xgCurrent: { home: liveXgH, away: liveXgA },
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

function buildFormation(side, lineup = null) {
  const x = (a) => side === 'home' ? a : 200 - a;
  const slots = [
    // Goalie starts almost on the goal line, inside the crease.
    { x: x(12), y: 50, role: 'goalie' },
    { x: x(58), y: 34, role: 'D' },
    { x: x(58), y: 66, role: 'D' },
    { x: x(98), y: 24, role: 'F' },
    { x: x(108), y: 50, role: 'C' },
    { x: x(98), y: 76, role: 'F' },
  ];
  const defenders = lineup?.defense || (lineup?.skaters || []).filter(p => p.position === 'D');
  const forwards = lineup?.forwards || (lineup?.skaters || []).filter(p => p.position !== 'D');
  const assigned = [lineup?.goalie || null, defenders[0] || null, defenders[1] || null,
    forwards[0] || null, forwards[1] || null, forwards[2] || null];
  return slots.map((slot, i) => ({
    ...slot, idx: i, playerId: assigned[i]?.id || null,
    playerName: assigned[i]?.name || '', position: assigned[i]?.position || slot.role,
    baseX: slot.x, baseY: slot.y, x: slot.x, y: slot.y, vx: 0, vy: 0,
  }));
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
      livePenalty('home', tNow);
    } else if (rPen < LIVE_PENALTY_RATE * 4) {
      livePenalty('away', tNow);
    } else {
      const rShot = rng();
      if (rShot < LIVE_SHOT_RATE) {
        const side = rng() < 0.5 ? 'home' : 'away';
        const lineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
        const defendingSide = side === 'home' ? 'away' : 'home';
        if (lineup.skaters.length) {
          const p = pickWeighted(lineup.skaters, shotWeight);
          const outcome = pick(['сейв','сейв','сейв','мимо','штанга']);
          lm.shotAttempts ||= { home: 0, away: 0 };
          lm.shotAttempts[side]++;
          // Только бросок в створ засчитывается вратарю и личную статистику бросков.
          if (outcome === 'сейв') {
            lm.shots[side]++;
            lm.goalieStats[defendingSide].shots++;
            const isPlayoff = lm.isPlayoff;
            (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++;
          }
          const puck = lm.positions?.puck;
          if (puck) {
            puck.possessionSide = side;
            puck.carrierIndex = null;
            puck.targetX = side === 'home' ? 195 : 5;
            puck.targetY = 50;
            puck.looseFrames = 26;
            puck.nextPossessionSide = outcome === 'сейв' ? defendingSide : side;
          }
          const sideName = side === 'home' ? homeTeamNameShort() : awayTeamNameShort();
          livePushEvent({
            type: 'shot', side,
            text: `${p.name} (${p.position}) [${sideName}] бросает — ${outcome}.`,
            time: liveFmtTime(lm.timeLeft), period: lm.period,
          });
        }
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
  lm.shotAttempts ||= { home: 0, away: 0 };
  lm.shotAttempts[side]++;
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
  const onIceConceding = new Set();
  while (onIceConceding.size < 5 && onIceConceding.size < concedingLineup.skaters.length) onIceConceding.add(pickWeighted(concedingLineup.skaters, x => x.ovr).id);
  for (const p of scoringLineup.skaters) if (onIceScoring.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus++;
  for (const p of concedingLineup.skaters) if (onIceConceding.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus--;

  lm.scorers[scorer.id] = (lm.scorers[scorer.id] || 0) + 1;
  for (const a of assisters) lm.assisters[a.id] = (lm.assisters[a.id] || 0) + 1;

  const assistNames = assisters.map(a => a.name).join(', ');
  const sideName = side === 'home' ? G.league.teams.find(t => t.id === lm.homeId).name : G.league.teams.find(t => t.id === lm.awayId).name;
  const txt = `ГОЛ! ${scorer.name} (${scorer.position})${assisters.length ? ` — ассист: ${assistNames}` : ''} [${sideName}]`;
  livePushEvent({ type: 'goal', side, text: txt, time: liveFmtTime(lm.timeLeft), period: lm.period });

  const goalX = side === 'home' ? 195 : 5;
  lm.positions.puck.x = goalX;
  lm.positions.puck.y = 50;
  lm.positions.puck.carrierIndex = null;
  lm.positions.puck.targetX = 100;
  lm.positions.puck.targetY = 50;
  lm.positions.puck.looseFrames = 48;
  lm.positions.puck.nextPossessionSide = side === 'home' ? 'away' : 'home';

  // ⚙️ ФИКС #2: sudden death в ОТ — гол немедленно завершает матч
  if (lm.period === 4) {
    lm.isFinished = true;
    if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
    finishLiveMatch();
    return;
  }
}

function livePenalty(side, startedAt = null) {
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
    endsAt: (Number.isFinite(startedAt) ? startedAt : lm.totalSecPlayed) + duration,
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
    if (lm.period === 4) {
      runLiveShootout();
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
  // Обновляем блок управления: вместо паузы игрок должен увидеть кнопку продолжения периода.
  render();
}


function runLiveShootout() {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished || lm.shootout) return;
  lm.shootout = true;
  lm.ot = true;
  lm.period = 5;
  lm.timeLeft = 0;
  livePushEvent({ type: 'period', text: 'Буллитная серия', time: 'БС', period: 5 });
  lm.pbp.push({ period: 5, time: '—', type: 'period', text: 'Буллитная серия' });

  const teams = {
    home: G.league.teams.find(t => t.id === lm.homeId),
    away: G.league.teams.find(t => t.id === lm.awayId),
  };
  const lineups = { home: lm.homeLineup, away: lm.awayLineup };
  const attempts = { home: 0, away: 0 };
  const goals = { home: 0, away: 0 };
  const attempt = (side) => {
    const lineup = lineups[side];
    const shooters = lineup.skaters || [];
    const goalie = lineups[side === 'home' ? 'away' : 'home'].goalie;
    if (!shooters.length) return false;
    const shooter = pickWeighted(shooters, scorerWeight);
    const chance = clamp(0.32 + ((shooter.ovr || 60) - 60) * 0.003, 0.18, 0.48);
    const scored = rng() < chance;
    attempts[side]++;
    lm.shootoutAttempts[side]++;
    const teamName = teams[side] ? (teams[side].shortName || teams[side].name) : side;
    const goalieName = goalie ? goalie.name : 'вратарь';
    const text = scored
      ? `Буллит реализован: ${shooter.name} (${teamName}) переигрывает ${goalieName}.`
      : `Буллит не реализован: ${shooter.name} (${teamName}) — ${goalieName} отражает бросок.`;
    if (scored) goals[side]++;
    livePushEvent({ type: 'shootout', side, text, time: `БС ${attempts[side]}`, period: 5 });
  };

  // Три обязательные попытки каждой команды, затем серии до первого преимущества.
  for (let i = 0; i < 3; i++) {
    attempt('home');
    attempt('away');
  }
  let rounds = 0;
  while (goals.home === goals.away && rounds < 50) {
    attempt('home');
    attempt('away');
    rounds++;
  }
  if (goals.home === goals.away) {
    // Защита от бесконечного цикла при крайне маловероятной длинной серии.
    const winner = rng() < 0.5 ? 'home' : 'away';
    goals[winner]++;
  }
  const winner = goals.home > goals.away ? 'home' : 'away';
  lm.shootoutWinner = winner;
  // Решающий буллит отражается в итоговом счёте матча, но не в личной статистике.
  if (winner === 'home') lm.hg++; else lm.ag++;
  livePushEvent({
    type: 'shootout', side: winner,
    text: `Победа ${teams[winner] ? (teams[winner].shortName || teams[winner].name) : winner} в буллитной серии ${goals.home}:${goals.away}.`,
    time: 'БС', period: 5,
  });
  lm.isFinished = true;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
  finishLiveMatch();
}

function liveResumeFromBreak() {
  const lm = G.liveMatch;
  if (!lm) return;
  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);
  lm.xgCurrent.home = xgH * LIVE_XG_MULTIPLIER;
  lm.xgCurrent.away = xgA * LIVE_XG_MULTIPLIER;
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
    hg: lm.hg, ag: lm.ag, ot: lm.ot, shootout: !!lm.shootout,
    pbp: lm.pbp.slice(),
    round: G.league.currentRound,
  };

  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const isPlayoff = lm.isPlayoff;
  if (lm.awayLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.awayLineup.goalie) : ensureStats(lm.awayLineup.goalie);
    const goalsAgainst = lm.hg - (lm.shootoutWinner === 'home' ? 1 : 0);
    s.gp++; s.shotsAgainst += lm.shots.home; s.goalsAgainst += goalsAgainst; s.saves += Math.max(0, lm.shots.home - goalsAgainst);
    if (!lm.shootout && goalsAgainst === 0) s.shutouts++;
    if (lm.shootoutWinner === 'away' || (!lm.shootoutWinner && lm.hg < lm.ag)) s.wins++;
    else if (lm.shootoutWinner === 'home' || lm.hg > lm.ag) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.homeLineup.goalie) : ensureStats(lm.homeLineup.goalie);
    const goalsAgainst = lm.ag - (lm.shootoutWinner === 'away' ? 1 : 0);
    s.gp++; s.shotsAgainst += lm.shots.away; s.goalsAgainst += goalsAgainst; s.saves += Math.max(0, lm.shots.away - goalsAgainst);
    if (!lm.shootout && goalsAgainst === 0) s.shutouts++;
    if (lm.shootoutWinner === 'home' || (!lm.shootoutWinner && lm.ag < lm.hg)) s.wins++;
    else if (lm.shootoutWinner === 'away' || lm.ag > lm.hg) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) updateGoalieStatus(home, lm.homeLineup.goalie, lm.ag - (lm.shootoutWinner === 'away' ? 1 : 0), lm.shots.away);
  if (lm.awayLineup.goalie) updateGoalieStatus(away, lm.awayLineup.goalie, lm.hg - (lm.shootoutWinner === 'home' ? 1 : 0), lm.shots.home);
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
  lm.shotAttempts ||= { home: 0, away: 0 };
  lm.shotAttempts.home += addH;
  lm.shotAttempts.away += addA;

  // Если после регуляки всё ещё ничья — ОТ (или буллиты, если ОТ не помог)
  if (lm.hg === lm.ag && periodNow < 4) {
    lm.ot = true;
    const otH = poisson(hXg * (300 / 3600));
    const otA = poisson(aXg * (300 / 3600));
    lm.hg += otH; lm.ag += otA;
    lm.shots.home += otH;
    lm.shots.away += otA;
    lm.shotAttempts ||= { home: 0, away: 0 };
    lm.shotAttempts.home += otH;
    lm.shotAttempts.away += otA;
  }
  if (lm.hg === lm.ag) {
    runLiveShootout();
    return;
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
  // Вратарские площади делают геометрию площадки более узнаваемой.
  const creaseR = Math.min(vx(9) - vx(0), vy(18) - vy(0));
  ctx.strokeStyle = 'rgba(37,99,235,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(vx(10), vy(50), creaseR, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(vx(190), vy(50), creaseR, Math.PI / 2, Math.PI * 1.5); ctx.stroke();

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

  const homeJersey = window.getTeamJersey ? window.getTeamJersey(homeTeam, 'home') : { base:'#A71930', secondary:'#171717', accent:'#FFFFFF', pattern:'stripe' };
  const awayJersey = window.getTeamJersey ? window.getTeamJersey(awayTeam, 'away') : { base:'#F4F6F8', secondary:'#334155', accent:'#94A3B8', pattern:'stripe' };

  // Рисуем маленькую хоккейную майку сверху: корпус, рукава, ворот и клубный рисунок.
  const drawPlayer = (p, side) => {
    const x = vx(p.x), y = vy(p.y);
    const r = Math.max(5, Math.round(W / 100));
    const jersey = side === 'home' ? homeJersey : awayJersey;
    const puckState = lm.positions.puck;
    const isCarrier = puckState && !(puckState.looseFrames > 0)
      && puckState.possessionSide === side && puckState.carrierIndex === p.idx;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 7, r / 7);

    const silhouette = () => {
      ctx.beginPath();
      ctx.moveTo(-3.5, -6.5);
      ctx.lineTo(-7.5, -4.2);
      ctx.lineTo(-10, 1.2);
      ctx.lineTo(-6.1, 3.1);
      ctx.lineTo(-4.5, 0.7);
      ctx.lineTo(-4.2, 7);
      ctx.lineTo(4.2, 7);
      ctx.lineTo(4.5, 0.7);
      ctx.lineTo(6.1, 3.1);
      ctx.lineTo(10, 1.2);
      ctx.lineTo(7.5, -4.2);
      ctx.lineTo(3.5, -6.5);
      ctx.lineTo(1.8, -4.4);
      ctx.lineTo(-1.8, -4.4);
      ctx.closePath();
    };

    silhouette();
    ctx.fillStyle = jersey.base;
    ctx.fill();
    ctx.save();
    silhouette();
    ctx.clip();

    const pattern = jersey.pattern || 'stripe';
    if (pattern === 'yoke') {
      ctx.fillStyle = jersey.secondary;
      ctx.fillRect(-11, -7, 22, 4.4);
      ctx.fillStyle = jersey.accent;
      ctx.fillRect(-11, -2.5, 22, 0.9);
    } else if (pattern === 'shoulders') {
      ctx.fillStyle = jersey.secondary;
      ctx.beginPath();
      ctx.moveTo(-11, -6); ctx.lineTo(-3, -6); ctx.lineTo(-1, -2);
      ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(11, -6); ctx.lineTo(3, -6); ctx.lineTo(1, -2);
      ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = jersey.accent;
      ctx.fillRect(-11, -1.2, 22, 0.8);
    } else if (pattern === 'diagonal') {
      ctx.strokeStyle = jersey.secondary;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(-11, 6); ctx.lineTo(10, -6); ctx.stroke();
      ctx.strokeStyle = jersey.accent;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-9, 7); ctx.lineTo(12, -5); ctx.stroke();
    } else if (pattern === 'hoops') {
      ctx.fillStyle = jersey.secondary;
      ctx.fillRect(-11, -2.8, 22, 1.7);
      ctx.fillRect(-11, 2.2, 22, 1.7);
      ctx.fillStyle = jersey.accent;
      ctx.fillRect(-11, -0.8, 22, 0.6);
    } else {
      ctx.fillStyle = jersey.secondary;
      ctx.fillRect(-11, -1.8, 22, 2.2);
      ctx.fillStyle = jersey.accent;
      ctx.fillRect(-11, 0.8, 22, 0.8);
    }

    // Полосы на рукавах связывают боковые части формы с основным рисунком.
    ctx.fillStyle = jersey.secondary;
    ctx.fillRect(-10, 0.1, 4.2, 1.1);
    ctx.fillRect(5.8, 0.1, 4.2, 1.1);
    ctx.restore();

    // Ворот и контур остаются видимыми поверх рисунка.
    ctx.strokeStyle = 'rgba(8,12,20,0.9)';
    ctx.lineWidth = 1.35;
    silhouette();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1.7, -5.3); ctx.lineTo(0, -3.7); ctx.lineTo(1.7, -5.3);
    ctx.strokeStyle = jersey.accent;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    if (p.role === 'goalie') {
      ctx.strokeStyle = jersey.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 8.6, 0, Math.PI * 2); ctx.stroke();
    }

    const label = p.position === 'G' || p.role === 'goalie' ? 'В' : p.position === 'D' || p.role === 'D' ? 'З' : 'Н';
    ctx.fillStyle = side === 'away' ? '#172033' : '#FFFFFF';
    ctx.font = 'bold 5.5px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1.1);
    ctx.restore();

    if (isCarrier) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  for (const p of lm.positions.home) drawPlayer(p, 'home');
  for (const p of lm.positions.away) drawPlayer(p, 'away');

  const puckX = vx(lm.positions.puck.x);
  const puckY = vy(lm.positions.puck.y);
  ctx.save();
  ctx.shadowColor = '#111827';
  ctx.shadowBlur = Math.max(3, Math.round(W / 180));
  ctx.beginPath();
  ctx.arc(puckX, puckY, Math.max(3, Math.round(W / 160)), 0, Math.PI * 2);
  ctx.fillStyle = '#0f1117';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

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
    let txt = lm.period === 5 ? 'Буллитная серия' : lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`;
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
      const sideCls = ev.side === 'home' ? 'side-home' : ev.side === 'away' ? 'side-away' : '';
      return `<div class="live-feed-item ${cls} ${sideCls}"><span class="lfi-time">[${ev.time || '—'}]</span>${ev.text}</div>`;
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
  if (!lm || !lm.positions) return;
  const puck = lm.positions.puck;
  if (!puck) return;
  const visualRng = window.GAME_RNG.visualRng;
  const sides = ['home', 'away'];

  // Loose puck: players react to the destination; possession resumes after the puck settles.
  if ((puck.looseFrames || 0) > 0) {
    puck.x += ((puck.targetX ?? 100) - puck.x) * 0.18;
    puck.y += ((puck.targetY ?? 50) - puck.y) * 0.18;
    puck.looseFrames--;
    if (puck.looseFrames === 0) {
      puck.possessionSide = puck.nextPossessionSide || puck.possessionSide || 'home';
      puck.carrierIndex = 3 + Math.floor(visualRng() * 3);
      puck.actionFrames = 70 + Math.floor(visualRng() * 80);
      puck.targetX = null;
      puck.targetY = null;
      puck.nextPossessionSide = null;
    }
  } else {
    puck.actionFrames = (puck.actionFrames || 0) - 1;
    if (puck.actionFrames <= 0) {
      // Visual-only pass/turnover. It never consumes the gameplay RNG stream.
      if (visualRng() < 0.18) puck.possessionSide = puck.possessionSide === 'home' ? 'away' : 'home';
      puck.carrierIndex = 3 + Math.floor(visualRng() * 3);
      puck.actionFrames = 70 + Math.floor(visualRng() * 80);
    }
  }

  const possessionSide = puck.possessionSide || 'home';
  const directionFor = side => side === 'home' ? 1 : -1;
  for (const side of sides) {
    const players = lm.positions[side] || [];
    const direction = directionFor(side);
    const ownGoalX = side === 'home' ? 10 : 190;
    const hasPuck = side === possessionSide;
    const carrier = hasPuck ? players[puck.carrierIndex] : null;
    let closestSkater = null;
    let closestDistance = Infinity;

    for (const player of players) {
      if (player.role === 'goalie') continue;
      const distance = Math.hypot(puck.x - player.x, puck.y - player.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSkater = player;
      }
    }

    for (const player of players) {
      const isGoalie = player.role === 'goalie';
      const isCarrier = !!carrier && player === carrier;
      const isDefender = player.role === 'D';
      let targetX = player.baseX;
      let targetY = player.baseY;

      if (isGoalie) {
        // Goalie stays in the crease and tracks the puck laterally.
        const puckInOwnZone = (puck.x - ownGoalX) * direction < 58;
        targetX = ownGoalX + direction * (puckInOwnZone ? 5 : 2);
        targetY = clamp(50 + (puck.y - 50) * 0.16, 42, 58);
      } else if (hasPuck) {
        if (isCarrier) {
          // Puck carrier drives toward the attacking end instead of orbiting a fixed slot.
          targetX = puck.x + direction * 8;
          targetY = puck.y;
        } else if (isDefender) {
          // Defencemen support the attack from behind the puck and keep two lanes.
          targetX = puck.x - direction * (player.idx === 1 ? 24 : 18);
          targetY = puck.y + (player.idx === 1 ? -19 : 19);
        } else {
          // Forwards spread across the lanes; the centre trails slightly as a passing option.
          const lane = player.idx === 3 ? -19 : player.idx === 4 ? 0 : 19;
          targetX = puck.x + direction * (player.idx === 4 ? -11 : 13);
          targetY = puck.y + lane;
        }
      } else if (player === closestSkater) {
        // The nearest forechecker pressures the puck; the rest retain defensive shape.
        targetX = puck.x;
        targetY = puck.y;
      } else if (isDefender) {
        // One defender protects the slot while the other shades toward the puck.
        targetX = ownGoalX + direction * 29;
        targetY = clamp(puck.y + (player.idx === 1 ? -17 : 17), 27, 73);
      } else {
        // Forwards backcheck between the puck and their own goal.
        const lane = player.idx === 3 ? -17 : player.idx === 4 ? 0 : 17;
        targetX = puck.x - direction * 18;
        targetY = clamp(puck.y + lane, 14, 86);
      }

      if (!isGoalie) {
        targetX = clamp(targetX, 12, 188);
        targetY = clamp(targetY, 10, 90);
      }

      // Small visual variation prevents robotic movement without making players drift.
      const jitter = isGoalie ? 0.0015 : 0.004;
      const response = isGoalie ? 0.055 : 0.035;
      const maxSpeed = isGoalie ? 0.24 : isDefender ? 0.78 : 0.9;
      player.vx = (player.vx || 0) * 0.78 + (targetX - player.x) * response
        + (visualRng() - 0.5) * jitter;
      player.vy = (player.vy || 0) * 0.78 + (targetY - player.y) * response
        + (visualRng() - 0.5) * jitter;
      player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
      player.vy = clamp(player.vy, -maxSpeed, maxSpeed);
      player.x = clamp(player.x + player.vx, 5, 195);
      player.y = clamp(player.y + player.vy, 5, 95);
    }
  }

  if ((puck.looseFrames || 0) <= 0) {
    const carrier = (lm.positions[possessionSide] || [])[puck.carrierIndex];
    if (carrier) {
      const puckOffset = directionFor(possessionSide) * 3.2;
      puck.x += (carrier.x + puckOffset - puck.x) * 0.34;
      puck.y += (carrier.y - puck.y) * 0.34;
    }
  }
}

function liveAnimationLoop() {
  const lm = G.liveMatch;
  // Не держим постоянный animation frame, когда матч остановлен или уже завершён.
  if (!lm || lm.paused || lm.isBreak || lm.isFinished) {
    _liveRafId = null;
    return;
  }
  liveUpdatePositions();
  drawLiveCanvas();
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function startLiveAnimation() {
  if (_liveRafId) return;
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function stopLiveAnimation() {
  if (_liveRafId) { cancelAnimationFrame(_liveRafId); _liveRafId = null; }
}
