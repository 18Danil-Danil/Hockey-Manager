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
  const shiftPlans = {
    home: buildLiveShiftPlan(home, homeLineup),
    away: buildLiveShiftPlan(away, awayLineup),
  };
  const playerStamina = {
    home: Object.fromEntries(homeLineup.skaters.map(player => [player.id,
      clamp(100 - (player.fatigue || 0) * 0.45, 35, 100)])),
    away: Object.fromEntries(awayLineup.skaters.map(player => [player.id,
      clamp(100 - (player.fatigue || 0) * 0.45, 35, 100)])),
  };
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
    shiftPlans,
    shiftState: {
      home: { forwardIndex: 0, defenseIndex: 0, elapsed: 0, pending: false, changes: 0 },
      away: { forwardIndex: 0, defenseIndex: 0, elapsed: 0, pending: false, changes: 0 },
    },
    playerStamina,
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

function buildLiveShiftPlan(team, lineup) {
  const byId = new Map((lineup?.skaters || []).map(player => [player.id, player]));
  const buildGroups = (keys, pool, size) => {
    const used = new Set();
    const groups = keys.map(key => (team?.lines?.[key]?.players || [])
      .map(id => byId.get(id)).filter(player => {
        if (!player || used.has(player.id)) return false;
        used.add(player.id);
        return true;
      }));
    const extras = (pool || []).filter(player => player && !used.has(player.id));
    for (const group of groups) {
      while (group.length < size && extras.length) {
        const player = extras.shift();
        group.push(player);
        used.add(player.id);
      }
    }
    return groups.filter(group => group.length);
  };
  let forwards = buildGroups(['f1', 'f2', 'f3', 'f4'], lineup?.forwards, 3);
  let defense = buildGroups(['d1', 'd2', 'd3'], lineup?.defense, 2);
  if (!forwards.length && lineup?.forwards?.length) {
    forwards = [];
    for (let i = 0; i < lineup.forwards.length; i += 3) forwards.push(lineup.forwards.slice(i, i + 3));
  }
  if (!defense.length && lineup?.defense?.length) {
    defense = [];
    for (let i = 0; i < lineup.defense.length; i += 2) defense.push(lineup.defense.slice(i, i + 2));
  }
  return { forwards, defense };
}

function applyLiveShift(lm, side) {
  const plan = lm.shiftPlans?.[side];
  const state = lm.shiftState?.[side];
  const positions = lm.positions?.[side];
  if (!plan || !state || !positions || !plan.forwards.length || !plan.defense.length) return false;
  const nextForwardIndex = (state.forwardIndex + 1) % plan.forwards.length;
  const nextDefenseIndex = (state.defenseIndex + 1) % plan.defense.length;
  const selected = [
    ...plan.defense[nextDefenseIndex].slice(0, 2),
    ...plan.forwards[nextForwardIndex].slice(0, 3),
  ];
  if (selected.length < 5) return false;
  state.forwardIndex = nextForwardIndex;
  state.defenseIndex = nextDefenseIndex;
  for (let i = 0; i < 5; i++) {
    const slot = positions[i + 1];
    const player = selected[i];
    if (!slot || !player) continue;
    slot.playerId = player.id;
    slot.playerName = player.name || '';
    slot.jerseyNumber = player.jerseyNumber ?? null;
    slot.number = player.number ?? null;
    slot.position = player.position || (i < 2 ? 'D' : 'F');
    slot.role = i < 2 ? 'D' : 'F';
    slot.vx = 0;
    slot.vy = 0;
    slot.stamina = lm.playerStamina?.[side]?.[player.id] ?? 100;
  }
  const extraSlot = positions[6];
  if (extraSlot) {
    const pulled = !!lm.goaliePulled?.[side];
    const penalized = new Set((lm.penalties?.[side] || [])
      .filter(penalty => penalty.endsAt > lm.totalSecPlayed).map(penalty => penalty.playerId));
    const extra = pulled
      ? (lm[side + 'Lineup']?.skaters || []).find(player =>
          !selected.some(active => active.id === player.id) && !penalized.has(player.id))
      : null;
    extraSlot.onIce = !!extra;
    extraSlot.playerId = extra?.id || null;
    extraSlot.playerName = extra?.name || '';
    extraSlot.jerseyNumber = extra?.jerseyNumber ?? null;
    extraSlot.number = extra?.number ?? null;
    extraSlot.position = extra?.position || 'F';
    extraSlot.role = 'F';
    extraSlot.stamina = extra ? (lm.playerStamina?.[side]?.[extra.id] ?? 100) : 100;
    extraSlot.vx = 0;
    extraSlot.vy = 0;
  }
  state.elapsed = 0;
  state.pending = false;
  state.changes = (state.changes || 0) + 1;
  return true;
}

function getLiveManpowerState(lm) {
  const activeCount = side => (lm?.penalties?.[side] || [])
    .filter(penalty => penalty.endsAt > lm.totalSecPlayed).length;
  const homePenalties = activeCount('home');
  const awayPenalties = activeCount('away');
  const homeAdvantage = Math.max(0, homePenalties - awayPenalties);
  const awayAdvantage = Math.max(0, awayPenalties - homePenalties);
  const base = {
    home: 5 - Math.min(2, homeAdvantage),
    away: 5 - Math.min(2, awayAdvantage),
  };
  return {
    home: { skaters: Math.min(6, base.home + (lm?.goaliePulled?.home ? 1 : 0)), advantage: homeAdvantage, goaliePulled: !!lm?.goaliePulled?.home },
    away: { skaters: Math.min(6, base.away + (lm?.goaliePulled?.away ? 1 : 0)), advantage: awayAdvantage, goaliePulled: !!lm?.goaliePulled?.away },
  };
}

function liveGetOnIceSkaters(lm, side) {
  const lineup = lm?.[side + 'Lineup'];
  const positions = lm?.positions?.[side] || [];
  const activeIds = new Set(positions.slice(1)
    .filter(position => position.onIce !== false)
    .map(position => position.playerId).filter(Boolean));
  const active = (lineup?.skaters || []).filter(player => activeIds.has(player.id));
  return positions.length > 1 ? active : (lineup?.skaters || []);
}

function reconcileLiveManpower(lm) {
  if (!lm?.positions || !lm?.penalties) return;
  const manpower = getLiveManpowerState(lm);
  const puck = lm.positions.puck;
  const previousCarrierId = puck && Number.isInteger(puck.carrierIndex)
    ? (lm.positions[puck.possessionSide || 'home'] || [])[puck.carrierIndex]?.playerId : null;
  for (const side of ['home', 'away']) {
    const lineup = lm[side + 'Lineup'];
    const slots = (lm.positions[side] || []).slice(1);
    if (!lineup || !slots.length) continue;
    const penalizedIds = new Set((lm.penalties[side] || [])
      .filter(penalty => penalty.endsAt > lm.totalSecPlayed)
      .map(penalty => penalty.playerId));
    const currentIds = new Set(slots.filter(slot => slot.onIce !== false)
      .map(slot => slot.playerId).filter(Boolean));
    const roster = lineup.skaters || [];
    const current = roster.filter(player => currentIds.has(player.id) && !penalizedIds.has(player.id));
    const candidates = [...current];
    for (const player of roster) {
      if (!penalizedIds.has(player.id) && !candidates.some(item => item.id === player.id)) candidates.push(player);
    }
    const desired = manpower[side].skaters;
    const defenseCount = desired >= 4 ? 2 : 1;
    const forwardsCount = desired - defenseCount;
    const defenders = candidates.filter(player => player.position === 'D');
    const forwards = candidates.filter(player => player.position !== 'D');
    const selected = [...defenders.slice(0, defenseCount), ...forwards.slice(0, forwardsCount)];
    for (const player of candidates) {
      if (selected.length >= desired) break;
      if (!selected.some(item => item.id === player.id)) selected.push(player);
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const player = selected[i];
      slot.onIce = !!player && i < desired;
      if (!slot.onIce) {
        slot.playerId = null;
        slot.playerName = '';
        slot.vx = 0;
        slot.vy = 0;
        continue;
      }
      slot.playerId = player.id;
      slot.playerName = player.name || '';
      slot.jerseyNumber = player.jerseyNumber ?? null;
      slot.number = player.number ?? null;
      slot.position = player.position || (i < defenseCount ? 'D' : 'F');
      slot.role = player.position === 'D' ? 'D' : 'F';
      slot.stamina = lm.playerStamina?.[side]?.[player.id] ?? 100;
      slot.vx = 0;
      slot.vy = 0;
    }
  }
  if (puck && Number.isInteger(puck.carrierIndex)) {
    const side = puck.possessionSide || 'home';
    const carrier = (lm.positions[side] || [])[puck.carrierIndex];
    if (carrier && (carrier.onIce === false || (previousCarrierId && carrier.playerId !== previousCarrierId))) {
      const nextCarrier = (lm.positions[side] || []).findIndex((player, index) =>
        index > 0 && player.onIce !== false && player.playerId
      );
      puck.carrierIndex = null;
      puck.looseFrames = Math.max(puck.looseFrames || 0, 4);
      puck.targetX = puck.x;
      puck.targetY = puck.y;
      puck.nextPossessionSide = side;
      puck.nextCarrierIndex = nextCarrier > 0 ? nextCarrier : 3;
    }
  }
}

function updateLiveShifts(lm, stepSec) {
  if (!lm || !lm.shiftPlans || !lm.playerStamina || !lm.positions) return;
  const puck = lm.positions.puck || {};
  for (const side of ['home', 'away']) {
    const lineup = lm[side + 'Lineup'];
    const positions = lm.positions[side] || [];
    const state = lm.shiftState[side];
    const stamina = lm.playerStamina[side];
    if (!lineup || !state || !stamina) continue;
    const activeIds = new Set(positions.slice(1).filter(player => player.onIce !== false).map(player => player.playerId).filter(Boolean));
    for (const player of lineup.skaters || []) {
      if (!Object.prototype.hasOwnProperty.call(stamina, player.id)) {
        stamina[player.id] = clamp(100 - (player.fatigue || 0) * 0.45, 35, 100);
      }
      stamina[player.id] = activeIds.has(player.id)
        ? Math.max(0, stamina[player.id] - stepSec * 0.7)
        : Math.min(100, stamina[player.id] + stepSec * 0.55);
    }
    for (const player of positions.slice(1)) {
      if (player.playerId) player.stamina = stamina[player.playerId] ?? 100;
    }
    state.elapsed += stepSec;
    if (state.elapsed >= 45) state.pending = true;
    if (!state.pending || puck.shotAnimation || puck.battle) continue;
    const puckLoose = (puck.looseFrames || 0) > 0;
    const puckFarFromOwnGoal = side === 'home' ? puck.x > 125 : puck.x < 75;
    const safeChange = puckLoose || (puck.possessionSide !== side && puckFarFromOwnGoal);
    if (safeChange && applyLiveShift(lm, side)) reconcileLiveManpower(lm);
  }
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
    { x: x(112), y: 88, role: 'F', extra: true },
  ];
  const defenders = lineup?.defense || (lineup?.skaters || []).filter(p => p.position === 'D');
  const forwards = lineup?.forwards || (lineup?.skaters || []).filter(p => p.position !== 'D');
  const assigned = [lineup?.goalie || null, defenders[0] || null, defenders[1] || null,
    forwards[0] || null, forwards[1] || null, forwards[2] || null,
    (lineup?.skaters || []).find(p => ![...defenders.slice(0, 2), ...forwards.slice(0, 3)].some(existing => existing.id === p.id)) || null];
  return slots.map((slot, i) => ({
    ...slot, idx: i, playerId: assigned[i]?.id || null,
    playerName: assigned[i]?.name || '', onIce: i === 0 || i <= 5 ? true : false,
    jerseyNumber: assigned[i]?.jerseyNumber ?? null,
    number: assigned[i]?.number ?? null,
    position: assigned[i]?.position || slot.role,
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
  const state = getLiveManpowerState(G.liveMatch);
  const opp = side === 'home' ? 'away' : 'home';
  return state[side].skaters > state[opp].skaters;
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

function getLiveSituationModifiers(lm, side) {
  const ownScore = side === 'home' ? Number(lm?.hg) || 0 : Number(lm?.ag) || 0;
  const opponentScore = side === 'home' ? Number(lm?.ag) || 0 : Number(lm?.hg) || 0;
  const scoreDiff = ownScore - opponentScore;
  const isLateRegulation = lm?.period === 3 && Number(lm?.timeLeft) <= 300;
  const deficit = Math.max(0, -scoreDiff);
  const lead = Math.max(0, scoreDiff);

  if (deficit > 0) {
    const urgency = clamp((isLateRegulation ? 0.34 : 0.10) + Math.min(deficit - 1, 2) * 0.08, 0.08, 0.50);
    return {
      state: 'chasing', urgency, protectLead: 0, lateGame: isLateRegulation,
      attack: 1 + urgency * 0.42,
      defense: 1 - urgency * 0.10,
    };
  }
  if (lead > 0 && isLateRegulation) {
    const protectLead = clamp(0.12 + Math.min(lead - 1, 2) * 0.045, 0.12, 0.21);
    return {
      state: 'protecting', urgency: 0, protectLead, lateGame: true,
      attack: 1 - protectLead * 0.24,
      defense: 1 + protectLead * 0.34,
    };
  }
  return {
    state: 'balanced', urgency: 0, protectLead: 0, lateGame: isLateRegulation,
    attack: 1, defense: 1,
  };
}

function updateLiveGoaliePulls(lm) {
  if (!lm || lm.isFinished || lm.isBreak || lm.period !== 3 || lm.timeLeft <= 0) return;
  lm.goaliePulled ||= { home: false, away: false };
  const puck = lm.positions?.puck;
  for (const side of ['home', 'away']) {
    const ownScore = side === 'home' ? lm.hg : lm.ag;
    const opponentScore = side === 'home' ? lm.ag : lm.hg;
    const deficit = opponentScore - ownScore;
    const threshold = deficit >= 2 ? 150 : deficit === 1 ? 90 : 0;
    const shouldPull = threshold > 0 && lm.timeLeft <= threshold;
    const goalieSlot = lm.positions?.[side]?.[0];
    if (!lm.goaliePulled[side] && shouldPull) {
      lm.goaliePulled[side] = true;
      if (goalieSlot) goalieSlot.onIce = false;
      livePushEvent({
        type: 'goalie_pull', side,
        text: 'Вратарь снят — команда играет в шесть полевых',
        time: liveFmtTime(lm.timeLeft), period: lm.period,
      });
    } else if (lm.goaliePulled[side] && deficit <= 0) {
      lm.goaliePulled[side] = false;
      if (goalieSlot) goalieSlot.onIce = true;
      livePushEvent({
        type: 'goalie_return', side,
        text: 'Вратарь возвращается в ворота',
        time: liveFmtTime(lm.timeLeft), period: lm.period,
      });
    } else if (lm.goaliePulled[side] && puck) {
      const ownGoalX = side === 'home' ? 10 : 190;
      const puckInOwnZone = side === 'home' ? puck.x < 58 : puck.x > 142;
      if (puckInOwnZone && puck.possessionSide !== side && (puck.looseFrames || 0) === 0) {
        lm.goaliePulled[side] = false;
        if (goalieSlot) goalieSlot.onIce = true;
        livePushEvent({
          type: 'goalie_return', side,
          text: 'Вратарь возвращается в ворота — соперник закрепился в зоне',
          time: liveFmtTime(lm.timeLeft), period: lm.period,
        });
      }
    }
  }
}

function liveAdvance(stepSec) {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const tBefore = lm.totalSecPlayed;
  const tNow = tBefore + stepSec;
  updateLiveGoaliePulls(lm);
  updateLiveShifts(lm, stepSec);
  for (const side of ['home', 'away']) {
    lm.penalties[side] = lm.penalties[side].filter(p => p.endsAt > tNow);
  }
  reconcileLiveManpower(lm);

  const homePP = liveIsPP('home');
  const awayPP = liveIsPP('away');

  // Score/time context affects the actual match probabilities, not only animation.
  lm.situation = {
    home: getLiveSituationModifiers(lm, 'home'),
    away: getLiveSituationModifiers(lm, 'away'),
  };
  const hXg = lm.xgCurrent.home;
  const aXg = lm.xgCurrent.away;

  let hMod = 1, aMod = 1;
  if (homePP) { hMod *= LIVE_PP_BOOST; aMod *= LIVE_PK_NERF; }
  if (awayPP) { aMod *= LIVE_PP_BOOST; hMod *= LIVE_PK_NERF; }
  // An empty net raises the opponent's scoring chance; the six-skater side
  // already receives its manpower advantage through the PP modifier above.
  if (lm.goaliePulled?.away) hMod *= 1.35;
  if (lm.goaliePulled?.home) aMod *= 1.35;

  const pH = hXg * hMod * lm.situation.home.attack * lm.situation.away.defense * (stepSec / 3600);
  const pA = aXg * aMod * lm.situation.away.attack * lm.situation.home.defense * (stepSec / 3600);

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
        const activeIds = new Set((lm.positions?.[side] || []).slice(1).filter(player => player.onIce !== false).map(player => player.playerId));
        const activeSkaters = lineup.skaters.filter(player => activeIds.has(player.id));
        const shooters = activeSkaters.length ? activeSkaters : lineup.skaters;
        if (shooters.length) {
          const p = pickWeighted(shooters, shotWeight);
          const outcome = pick(['сейв','сейв','сейв','мимо','штанга']);
          lm.shotAttempts ||= { home: 0, away: 0 };
          lm.shotAttempts[side]++;
          // Только бросок в створ засчитывается вратарю и личную статистику бросков.
          if (outcome === 'сейв') {
            lm.shots[side]++;
            const goalieOnIce = lm.positions?.[defendingSide]?.[0]?.onIce !== false;
            if (goalieOnIce) lm.goalieStats[defendingSide].shots++;
            const isPlayoff = lm.isPlayoff;
            (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++;
          }
          const puck = lm.positions?.puck;
          if (puck) {
            const shooterPositions = lm.positions[side] || [];
            const shooterIndex = shooterPositions.findIndex(position => position.playerId === p.id);
            const shooterPosition = shooterPositions[shooterIndex >= 0 ? shooterIndex : 3];
            const defendingGoalie = (lm.positions[defendingSide] || []).find(position => position.role === 'goalie');
            const attackingGoalX = side === 'home' ? 190 : 10;
            const shotTargetY = clamp(puck.y + (outcome === 'штанга' ? (puck.y < 50 ? -7 : 7) : 0), 43, 57);
            puck.possessionSide = side;
            puck.carrierIndex = null;
            puck.shotAnimation = {
              side, outcome, defendingSide,
              startX: shooterPosition ? shooterPosition.x : puck.x,
              startY: shooterPosition ? shooterPosition.y : puck.y,
              targetX: outcome === 'сейв' && defendingGoalie ? defendingGoalie.x : attackingGoalX,
              targetY: shotTargetY,
              frames: 12, totalFrames: 12,
            };
            puck.x = puck.shotAnimation.startX;
            puck.y = puck.shotAnimation.startY;
            puck.looseFrames = 0;
            puck.nextPossessionSide = null;
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
  const onIceScorers = liveGetOnIceSkaters(lm, side);
  const onIceConcedingPlayers = liveGetOnIceSkaters(lm, side === 'home' ? 'away' : 'home');
  const scorer = pickWeighted(onIceScorers, scorerWeight);

  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) {
    addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  }

  const numAssists = rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assistPool = onIceScorers.filter(p => p.id !== scorer.id);
  const assisters = [];
  for (let i = 0; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }

  if (side === 'home') lm.hg++; else lm.ag++;
  const defendingSide = side === 'home' ? 'away' : 'home';
  const defendingGoalieOnIce = lm.positions?.[defendingSide]?.[0]?.onIce !== false;
  if (defendingGoalieOnIce) lm.goalieStats[defendingSide].goals++;
  lm.shotAttempts ||= { home: 0, away: 0 };
  lm.shotAttempts[side]++;
  lm.shots[side]++;
  if (defendingGoalieOnIce) lm.goalieStats[defendingSide].shots++;
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
    reconcileLiveManpower(lm);
  }

  const onIceScoring = new Set(onIceScorers.map(player => player.id));
  const onIceConceding = new Set(onIceConcedingPlayers.map(player => player.id));
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
  lm.positions.puck.shotAnimation = null;
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
  const active = liveGetOnIceSkaters(lm, side).filter(player =>
    !(lm.penalties[side] || []).some(penalty => penalty.playerId === player.id && penalty.endsAt > lm.totalSecPlayed)
  );
  const eligible = active.length ? active : lineup.skaters.filter(player =>
    !(lm.penalties[side] || []).some(penalty => penalty.playerId === player.id && penalty.endsAt > lm.totalSecPlayed)
  );
  if (!eligible.length) return;
  const p = pick(eligible);
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
  reconcileLiveManpower(lm);
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
  if (lm.period === 3 && tied && lm.goaliePulled) {
    for (const side of ['home', 'away']) {
      if (!lm.goaliePulled[side]) continue;
      lm.goaliePulled[side] = false;
      if (lm.positions?.[side]?.[0]) lm.positions[side][0].onIce = true;
    }
    reconcileLiveManpower(lm);
  }
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

function liveResumeFromBreak(options = {}) {
  const lm = G.liveMatch;
  if (!lm || !lm.isBreak || lm.isFinished) return false;
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
  if (options.startInterval !== false && !lm.intervalId && !lm.isFinished) {
    lm.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  }
  const periodText = lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`;
  livePushEvent({ type: 'period', text: periodText, time: lm.period === 4 ? '05:00' : '20:00', period: lm.period });
  lm.pbp.push({ period: lm.period, time: '—', type: 'period', text: periodText });
  if (options.render !== false) render();
  return true;
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
    const goalsAgainst = lm.goalieStats.away.goals;
    const shotsAgainst = lm.goalieStats.away.shots;
    s.gp++; s.shotsAgainst += shotsAgainst; s.goalsAgainst += goalsAgainst; s.saves += Math.max(0, shotsAgainst - goalsAgainst);
    if (!lm.shootout && goalsAgainst === 0 && !lm.goaliePulled?.away) s.shutouts++;
    if (lm.shootoutWinner === 'away' || (!lm.shootoutWinner && lm.hg < lm.ag)) s.wins++;
    else if (lm.shootoutWinner === 'home' || lm.hg > lm.ag) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.homeLineup.goalie) : ensureStats(lm.homeLineup.goalie);
    const goalsAgainst = lm.goalieStats.home.goals;
    const shotsAgainst = lm.goalieStats.home.shots;
    s.gp++; s.shotsAgainst += shotsAgainst; s.goalsAgainst += goalsAgainst; s.saves += Math.max(0, shotsAgainst - goalsAgainst);
    if (!lm.shootout && goalsAgainst === 0 && !lm.goaliePulled?.home) s.shutouts++;
    if (lm.shootoutWinner === 'home' || (!lm.shootoutWinner && lm.ag < lm.hg)) s.wins++;
    else if (lm.shootoutWinner === 'away' || lm.ag > lm.hg) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) updateGoalieStatus(home, lm.homeLineup.goalie, lm.goalieStats.home.goals, lm.goalieStats.home.shots);
  if (lm.awayLineup.goalie) updateGoalieStatus(away, lm.awayLineup.goalie, lm.goalieStats.away.goals, lm.goalieStats.away.shots);
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
  if (!lm || lm.isFinished) return;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }

  // Досимулируем матч тем же игровым шагом, что и обычный LIVE.
  // Так голы, ассисты, броски, удаления и вратарская статистика
  // проходят через штатные обработчики и не теряются при ускорении.
  lm.paused = false;
  let safety = 0;
  while (!lm.isFinished && safety < 5000) {
    safety++;
    if (lm.isBreak) {
      if (!liveResumeFromBreak({ startInterval: false, render: false })) break;
      continue;
    }
    if (lm.timeLeft <= 0) {
      liveEndPeriod();
      continue;
    }
    const before = lm.totalSecPlayed;
    liveAdvance(Math.min(LIVE_TICK_SEC, lm.timeLeft));
    if (!lm.isFinished && !lm.isBreak && lm.totalSecPlayed <= before) break;
  }

  if (!lm.isFinished && !lm.isBreak) {
    // Защита от некорректного состояния, чтобы матч не завис навсегда.
    finishLiveMatch();
  }
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

  // Хоккейная майка с клубным рисунком, номером на спине и фамилией игрока.
  const drawPlayer = (p, side, usedNumbers) => {
    const x = vx(p.x), y = vy(p.y);
    const r = Math.max(5, Math.round(W / 100));
    const jersey = side === 'home' ? homeJersey : awayJersey;
    const puckState = lm.positions.puck;
    const isCarrier = puckState && !(puckState.looseFrames > 0)
      && puckState.possessionSide === side && puckState.carrierIndex === p.idx;

    // Номер постоянен для игрока при повторных LIVE-матчах; старые сохранения поддерживаются.
    const rawNumber = Number(p.jerseyNumber ?? p.number);
    let jerseyNumber = Number.isInteger(rawNumber) && rawNumber >= 1 && rawNumber <= 99
      ? rawNumber : null;
    if (jerseyNumber === null) {
      const seed = String(p.playerId || p.playerName || p.idx);
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      jerseyNumber = 1 + (hash % 99);
    }
    const preferredNumber = jerseyNumber;
    while (usedNumbers.has(jerseyNumber)) jerseyNumber = jerseyNumber % 99 + 1;
    usedNumbers.add(jerseyNumber);

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

    // Полосы на рукавах и контрастный ворот.
    ctx.fillStyle = jersey.secondary;
    ctx.fillRect(-10, 0.1, 4.2, 1.1);
    ctx.fillRect(5.8, 0.1, 4.2, 1.1);
    ctx.restore();

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

    // Номер расположен по центру спины. На выездной форме используется тёмная окантовка.
    const numberColor = side === 'away' ? '#172033' : '#FFFFFF';
    ctx.font = '900 7.2px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = side === 'away' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)';
    ctx.strokeText(String(jerseyNumber), 0, 1.2);
    ctx.fillStyle = numberColor;
    ctx.fillText(String(jerseyNumber), 0, 1.2);
    ctx.restore();

    // Фамилия показывается компактной плашкой под игроком, чтобы читаться и на телефоне.
    const fullName = String(p.playerName || '').trim();
    const surname = fullName ? fullName.split(/\s+/).slice(-1)[0] : 'Игрок';
    const surnameText = surname.length > 10 ? surname.slice(0, 9) + '…' : surname;
    const labelFont = Math.max(6, Math.min(9, W / 58));
    ctx.save();
    ctx.font = `600 ${labelFont}px -apple-system, sans-serif`;
    const numberText = String(jerseyNumber);
    const labelText = `${numberText} ${surnameText}`;
    const labelWidth = Math.min(Math.max(27, ctx.measureText(labelText).width + 7), Math.max(38, W / 7));
    const labelY = Math.min(H - 5, y + r + labelFont + 2);
    ctx.fillStyle = 'rgba(10,16,27,0.78)';
    const left = x - labelWidth / 2, top = labelY - labelFont / 2 - 2;
    ctx.fillRect(left, top, labelWidth, labelFont + 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, labelY, labelWidth - 5);
    const stamina = clamp(p.stamina ?? 100, 0, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(left, top + labelFont + 4, labelWidth, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(left, top + labelFont + 4, labelWidth * stamina / 100, 2);
    ctx.restore();

    if ((p.contactFrames || 0) > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      p.contactFrames--;
    }

    if (isCarrier) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const homeNumbers = new Set();
  const awayNumbers = new Set();
  for (const p of lm.positions.home) if (p.onIce !== false) drawPlayer(p, 'home', homeNumbers);
  for (const p of lm.positions.away) if (p.onIce !== false) drawPlayer(p, 'away', awayNumbers);

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
    ctx.fillStyle = '#14532d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(22, Math.round(W / 12))}px -apple-system, sans-serif`;
    ctx.fillText('ГОЛ!', W / 2, H / 2);
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
    const manpower = getLiveManpowerState(lm);
    const hp = liveGetActivePenalties('home');
    const ap = liveGetActivePenalties('away');
    const parts = [];
    if (manpower.home.advantage > 0) parts.push(`${homeTeamNameShort()} — большинство ${manpower.home.skaters} на ${manpower.away.skaters}`);
    if (manpower.away.advantage > 0) parts.push(`${awayTeamNameShort()} — большинство ${manpower.away.skaters} на ${manpower.home.skaters}`);
    if (lm.goaliePulled?.home) parts.push(`${homeTeamNameShort()} — пустые ворота, 6 полевых`);
    if (lm.goaliePulled?.away) parts.push(`${awayTeamNameShort()} — пустые ворота, 6 полевых`);
    if (hp.length || ap.length || parts.length) {
      const box = [...hp.map(p => `${p.playerName}: ${p.type} мин`), ...ap.map(p => `${p.playerName}: ${p.type} мин`)];
      ppEl.textContent = [parts.join(' · '), box.join(' | ')].filter(Boolean).join(' — ');
      ppEl.style.display = 'block';
    } else ppEl.style.display = 'none';
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

  // A recorded shot is animated independently of the match RNG and score calculation.
  if (puck.shotAnimation) {
    const shot = puck.shotAnimation;
    const progress = 1 - shot.frames / shot.totalFrames;
    puck.x = shot.startX + (shot.targetX - shot.startX) * progress;
    puck.y = shot.startY + (shot.targetY - shot.startY) * progress
      - Math.sin(progress * Math.PI) * 1.8;
    shot.frames--;
    if (shot.frames <= 0) {
      puck.x = shot.targetX;
      puck.y = shot.targetY;
      puck.shotAnimation = null;
      puck.looseFrames = shot.outcome === 'сейв' ? 18 : 22;
      puck.targetX = clamp(shot.targetX + (shot.side === 'home' ? -7 : 7), 5, 195);
      puck.targetY = clamp(shot.targetY + (shot.outcome === 'штанга' ? 8 : 3), 8, 92);
      puck.nextPossessionSide = shot.outcome === 'сейв' ? shot.defendingSide : shot.side;
      puck.nextCarrierIndex = 3 + Math.floor(visualRng() * 3);
    }
  // Loose puck: players react to the destination; possession resumes after the puck settles.
  } else if ((puck.looseFrames || 0) > 0) {
    if (puck.battle && puck.battle.frames > 0) {
      // Players tie up sticks and shoulders; the puck stays contested for a few frames.
      puck.battle.frames--;
      for (const side of ['home', 'away']) {
        const player = (lm.positions[side] || [])[puck.battle[side + 'Index']];
        if (player) {
          player.contactFrames = 5;
          player.vx = (player.vx || 0) * 0.35;
          player.vy = (player.vy || 0) * 0.35;
        }
      }
      if (puck.battle.frames === 0) {
        const winner = visualRng() < 0.5 ? 'home' : 'away';
        puck.nextPossessionSide = winner;
        puck.nextCarrierIndex = puck.battle[winner + 'Index'];
        puck.battle = null;
        puck.looseFrames = 1;
      }
    } else {
      const receiver = Number.isInteger(puck.nextCarrierIndex)
        ? (lm.positions[puck.nextPossessionSide] || [])[puck.nextCarrierIndex] : null;
      const targetX = receiver ? receiver.x : (puck.targetX ?? 100);
      const targetY = receiver ? receiver.y : (puck.targetY ?? 50);
      puck.x += (targetX - puck.x) * 0.18;
      puck.y += (targetY - puck.y) * 0.18;
      puck.looseFrames--;
      if (puck.looseFrames === 0) {
        const previousSide = puck.possessionSide || 'home';
        const receivingSide = puck.nextPossessionSide || previousSide;
        puck.possessionSide = receivingSide;
        puck.carrierIndex = Number.isInteger(puck.nextCarrierIndex)
          ? puck.nextCarrierIndex : 3 + Math.floor(visualRng() * 3);
        puck.actionFrames = 70 + Math.floor(visualRng() * 80);
        puck.targetX = null;
        puck.targetY = null;
        puck.nextPossessionSide = null;
        puck.nextCarrierIndex = null;
        if (receivingSide !== previousSide) {
          // A clean regain starts a short visual counterattack phase for the new carrier.
          puck.counterattack = { side: receivingSide, frames: 105 };
        }
      }
    }
  } else {
    puck.actionFrames = (puck.actionFrames || 0) - 1;
    if (puck.actionFrames <= 0) {
      // Visual-only puck actions use the visual RNG and never affect match results.
      const currentSide = puck.possessionSide || 'home';
      const currentCarrierIndex = Number.isInteger(puck.carrierIndex) ? puck.carrierIndex : 3;
      const currentPlayers = lm.positions[currentSide] || [];
      const isTurnover = visualRng() < 0.18;

      if (isTurnover) {
        const nextSide = currentSide === 'home' ? 'away' : 'home';
        const nextCarrierIndex = 3 + Math.floor(visualRng() * 3);
        const receiver = (lm.positions[nextSide] || [])[nextCarrierIndex];
        puck.carrierIndex = null;
        puck.targetX = receiver ? receiver.x : (nextSide === 'home' ? 100 : 100);
        puck.targetY = receiver ? receiver.y : 50;
        puck.looseFrames = 14;
        puck.nextPossessionSide = nextSide;
        puck.nextCarrierIndex = nextCarrierIndex;
        puck.actionFrames = 70 + Math.floor(visualRng() * 80);
      } else {
        const candidates = currentPlayers
          .map((player, index) => ({ player, index }))
          .filter(item => item.index > 0 && item.index !== currentCarrierIndex);
        if (candidates.length) {
          const receiver = candidates[Math.floor(visualRng() * candidates.length)];
          puck.passFromX = puck.x;
          puck.passFromY = puck.y;
          puck.passFrames = 12;
          puck.carrierIndex = receiver.index;
        }
        puck.actionFrames = 70 + Math.floor(visualRng() * 80);
      }
    }
  }

  const possessionSide = puck.possessionSide || 'home';
  const manpower = getLiveManpowerState(lm);
  const directionFor = side => side === 'home' ? 1 : -1;
  const tacticalFor = side => {
    const teamId = side === 'home' ? lm.homeId : lm.awayId;
    const team = (G.league?.teams || []).find(item => item.id === teamId);
    const values = team?.tactics || {};
    const read = key => {
      const value = Number(values[key]);
      return clamp(Number.isFinite(value) ? value : 50, 0, 100);
    };
    const situation = lm.situation?.[side] || { urgency: 0, protectLead: 0 };
    return {
      forecheck: clamp(read('forecheck') + situation.urgency * 18, 0, 100),
      pressure: clamp(read('pressure') + situation.urgency * 25, 0, 100),
      style: clamp(read('style') + situation.urgency * 8, 0, 100),
      physical: read('physical'),
      risk: clamp(read('risk') + situation.urgency * 18 - situation.protectLead * 35, 0, 100),
    };
  };
  for (const side of sides) {
    const players = lm.positions[side] || [];
    const direction = directionFor(side);
    const ownGoalX = side === 'home' ? 10 : 190;
    const hasPuck = side === possessionSide;
    const carrier = hasPuck ? players[puck.carrierIndex] : null;
    const tactics = tacticalFor(side);
    const counterattackActive = !!puck.counterattack && puck.counterattack.frames > 0;
    const isCounterattacking = counterattackActive && puck.counterattack.side === side && hasPuck;
    const isRecoveringAgainstCounter = counterattackActive && puck.counterattack.side !== side && !hasPuck;
    const opponentZone = side === 'home' ? puck.x > 100 : puck.x < 100;
    const forwardCandidates = players
      .map((player, index) => ({ player, index }))
      .filter(item => item.index > 0 && item.player.onIce !== false && item.player.role !== 'D' && item.player.role !== 'goalie')
      .sort((a, b) => Math.hypot(puck.x - a.player.x, puck.y - a.player.y)
        - Math.hypot(puck.x - b.player.x, puck.y - b.player.y));
    const secondForechecker = forwardCandidates[1]?.player || null;
    const supportPress = tactics.pressure >= 78 || (tactics.forecheck >= 82 && opponentZone);
    const aggressivePress = tactics.pressure >= 62 || (tactics.forecheck >= 65 && opponentZone);
    let closestSkater = null;
    let closestDistance = Infinity;

    for (const player of players) {
      if (player.role === 'goalie' || player.onIce === false) continue;
      const distance = Math.hypot(puck.x - player.x, puck.y - player.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSkater = player;
      }
    }

    for (const player of players) {
      if (player.onIce === false) continue;
      const isGoalie = player.role === 'goalie';
      const isCarrier = !!carrier && player === carrier;
      const isDefender = player.role === 'D';
      let targetX = player.baseX;
      let targetY = player.baseY;

      if (isGoalie) {
        // Goalie stays in the crease; during a shot, reacts more sharply to its lane.
        const puckInOwnZone = (puck.x - ownGoalX) * direction < 58;
        targetX = ownGoalX + direction * (puckInOwnZone ? 5 : 2);
        targetY = clamp(puck.shotAnimation && puck.shotAnimation.defendingSide === side
          ? puck.shotAnimation.targetY : 50 + (puck.y - 50) * 0.16, 42, 58);
      } else if (manpower[side].skaters < 5) {
        // Penalty kill: compact box protects the slot and passing lanes.
        const boxX = side === 'home' ? 43 : 157;
        const boxY = [35, 65, 43, 57, 50][player.idx - 1] ?? 50;
        const boxOffset = player.idx <= 2 ? 0 : player.idx === 3 ? 12 : -12;
        targetX = boxX + direction * boxOffset;
        targetY = boxY;
        if (isCarrier) { targetX = puck.x; targetY = puck.y; }
      } else if (manpower[side].advantage > 0 && hasPuck) {
        // Power play: spread into an umbrella with a central shooting lane.
        const attackX = side === 'home' ? 155 : 45;
        const umbrella = [
          { x: -17, y: -20 }, { x: -17, y: 20 }, { x: 4, y: -27 },
          { x: 17, y: 0 }, { x: 4, y: 27 },
        ][player.idx - 1] || { x: 0, y: 0 };
        targetX = attackX + direction * umbrella.x;
        targetY = 50 + umbrella.y;
        if (isCarrier) { targetX = puck.x + direction * 6; targetY = puck.y; }
      } else if (isCounterattacking) {
        if (isCarrier) {
          // The new carrier attacks open ice immediately after a clean regain.
          targetX = puck.x + direction * (13 + tactics.style * 0.025 + tactics.risk * 0.045);
          targetY = puck.y;
        } else if (isDefender) {
          // Defencemen trail the rush as a safe outlet instead of joining the same lane.
          targetX = puck.x - direction * (player.idx === 1 ? 23 : 17);
          targetY = puck.y + (player.idx === 1 ? -18 : 18);
        } else {
          // Wingers sprint into separate lanes while the centre offers a short support option.
          const lane = player.idx === 3 ? -23 : player.idx === 4 ? 0 : 23;
          targetX = puck.x + direction * (player.idx === 4 ? -7 : 25);
          targetY = puck.y + lane;
        }
      } else if (hasPuck) {
        if (isCarrier) {
          // Vertical/risk-oriented teams attack space faster; positional teams retain the puck.
          const forwardDrive = 6 + tactics.style * 0.07 + tactics.risk * 0.035;
          targetX = puck.x + direction * forwardDrive;
          targetY = puck.y;
        } else if (isDefender) {
          // Defencemen support from behind; aggressive systems move the blue line higher.
          const supportDepth = 24 - tactics.style * 0.055 - tactics.risk * 0.035;
          targetX = puck.x - direction * supportDepth;
          targetY = puck.y + (player.idx === 1 ? -19 : 19);
        } else {
          // Positional attack preserves width; vertical/risk-oriented attack sends wings deeper.
          const lane = player.idx === 3 ? -19 : player.idx === 4 ? 0 : 19;
          const forwardPush = 7 + tactics.style * 0.13 + tactics.risk * 0.055;
          const centerTrail = 13 - tactics.risk * 0.075;
          targetX = puck.x + direction * (player.idx === 4 ? -centerTrail : forwardPush);
          targetY = puck.y + lane;
        }
      } else if (player === closestSkater) {
        // A team caught during a counterattack sends its nearest skater straight back to the puck.
        targetX = (aggressivePress || isRecoveringAgainstCounter) ? puck.x : puck.x - direction * (8 + (50 - tactics.pressure) * 0.12);
        targetY = (aggressivePress || isRecoveringAgainstCounter) ? puck.y : puck.y + (50 - puck.y) * 0.22;
      } else if (!hasPuck && player === secondForechecker && supportPress) {
        // A second forward supports the forecheck instead of abandoning the defensive shape.
        targetX = puck.x - direction * 8;
        targetY = puck.y + (puck.y < 50 ? 10 : -10);
      } else if (isDefender) {
        // A compact trap protects the slot; higher pressure shades the second defender outward.
        const shade = 29 + tactics.pressure * 0.055;
        targetX = ownGoalX + direction * shade;
        targetY = clamp(puck.y + (player.idx === 1 ? -17 : 17), 27, 73);
      } else {
        // Forwards backcheck; higher forecheck keeps them closer to the puck for a quick regain.
        const lane = player.idx === 3 ? -17 : player.idx === 4 ? 0 : 17;
        const backcheckDepth = 20 - tactics.forecheck * 0.055;
        targetX = puck.x - direction * backcheckDepth;
        targetY = clamp(puck.y + lane, 14, 86);
      }

      if (!isGoalie) {
        targetX = clamp(targetX, 12, 188);
        targetY = clamp(targetY, 10, 90);
      }

      // Small visual variation prevents robotic movement without making players drift.
      const jitter = isGoalie ? 0.0015 : 0.004;
      const response = isGoalie ? 0.055 : 0.035;
      const staminaFactor = isGoalie ? 1 : clamp((player.stamina ?? 100) / 100, 0.58, 1);
      const physicalFactor = isGoalie ? 1 : 0.96 + tactics.physical * 0.0008;
      const maxSpeed = (isGoalie ? 0.24 : isDefender ? 0.78 : 0.9) * staminaFactor * physicalFactor;
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

  // Trigger a brief visual board/loose-puck battle when opponents arrive together.
  if ((puck.looseFrames || 0) > 0 && !puck.battle && !puck.shotAnimation) {
    const nearest = {};
    for (const side of sides) {
      const players = lm.positions[side] || [];
      let best = null;
      for (let index = 1; index < players.length; index++) {
        const player = players[index];
        const distance = Math.hypot(player.x - puck.x, player.y - puck.y);
        if (!best || distance < best.distance) best = { index, distance, player };
      }
      nearest[side] = best;
    }
    if (nearest.home && nearest.away
      && nearest.home.distance < 10 && nearest.away.distance < 10
      && Math.abs(nearest.home.distance - nearest.away.distance) < 4) {
      const nearBoards = puck.y < 18 || puck.y > 82;
      puck.battle = {
        frames: nearBoards ? 12 : 8,
        homeIndex: nearest.home.index,
        awayIndex: nearest.away.index,
        type: nearBoards ? 'board' : 'puck',
      };
      puck.targetX = puck.x;
      puck.targetY = puck.y;
      nearest.home.player.contactFrames = 6;
      nearest.away.player.contactFrames = 6;
    }
  }

  if ((puck.looseFrames || 0) <= 0) {
    const carrier = (lm.positions[possessionSide] || [])[puck.carrierIndex];
    if (carrier) {
      const puckOffset = directionFor(possessionSide) * 3.2;
      const targetX = carrier.x + puckOffset;
      const targetY = carrier.y;
      if ((puck.passFrames || 0) > 0) {
        const progress = 1 - puck.passFrames / 12;
        puck.x = puck.passFromX + (targetX - puck.passFromX) * progress;
        puck.y = puck.passFromY + (targetY - puck.passFromY) * progress
          - Math.sin(progress * Math.PI) * 2.2;
        puck.passFrames--;
        if (puck.passFrames === 0) {
          puck.x = targetX;
          puck.y = targetY;
          puck.passFromX = null;
          puck.passFromY = null;
        }
      } else {
        puck.x += (targetX - puck.x) * 0.34;
        puck.y += (targetY - puck.y) * 0.34;
      }
    }
  }
  if (puck.counterattack && (puck.looseFrames || 0) <= 0) {
    puck.counterattack.frames--;
    if (puck.counterattack.frames <= 0 || puck.possessionSide !== puck.counterattack.side) {
      puck.counterattack = null;
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
