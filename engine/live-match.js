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
    gameplayPossession: {
      side: initialPossessionSide,
      playerId: positions[initialPossessionSide][positions.puck.carrierIndex]?.playerId || null,
    },
    puckBattleStats: {
      home: { won: 0, lost: 0, takeaways: 0 },
      away: { won: 0, lost: 0, takeaways: 0 },
    },
    physicalContactCooldown: 0,
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
    const isAvailable = player => !penalizedIds.has(player.id)
      && (!player.injury || player.injury.gamesLeft <= 0 || player.playingThroughPain);
    const current = roster.filter(player => currentIds.has(player.id) && isAvailable(player));
    const candidates = [...current];
    for (const player of roster) {
      if (isAvailable(player) && !candidates.some(item => item.id === player.id)) candidates.push(player);
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

function getLiveDuelRating(player, role, stamina = 100, boardBattle = false) {
  const attrs = player?.attrs || {};
  const fallback = Number(player?.ovr) || 50;
  const read = key => clamp(Number(attrs[key]) || fallback, 1, 99);
  const skill = boardBattle
    ? role === 'carrier'
      ? read('physical') * 0.30 + read('defense') * 0.26 + read('skating') * 0.12
        + read('iq') * 0.20 + read('passing') * 0.12
      : read('physical') * 0.35 + read('defense') * 0.34 + read('skating') * 0.10
        + read('iq') * 0.16 + read('passing') * 0.05
    : role === 'carrier'
      ? read('physical') * 0.18 + read('skating') * 0.20 + read('passing') * 0.22
        + read('iq') * 0.25 + read('defense') * 0.15
      : read('physical') * 0.25 + read('defense') * 0.30 + read('skating') * 0.15
        + read('iq') * 0.20 + read('passing') * 0.10;
  return skill * (0.65 + clamp(Number(stamina) || 0, 0, 100) * 0.0035);
}

function resolveLivePuckBattle(lm) {
  if (!lm || lm.isFinished || lm.isBreak || lm.positions?.puck?.shotAnimation) return false;
  const possession = lm.gameplayPossession || (lm.gameplayPossession = {
    side: 'home', playerId: null,
  });
  const side = possession.side === 'away' ? 'away' : 'home';
  const opponentSide = side === 'home' ? 'away' : 'home';
  const ownSlots = (lm.positions?.[side] || []).slice(1);
  const opponentSlots = (lm.positions?.[opponentSide] || []).slice(1);
  const ownPlayers = ownSlots.filter(slot => slot.onIce !== false && slot.playerId)
    .map(slot => {
      const player = (lm[side + 'Lineup']?.skaters || []).find(item => item.id === slot.playerId);
      return player ? { player, slot } : null;
    }).filter(Boolean);
  const opponentPlayers = opponentSlots.filter(slot => slot.onIce !== false && slot.playerId)
    .map(slot => {
      const player = (lm[opponentSide + 'Lineup']?.skaters || []).find(item => item.id === slot.playerId);
      return player ? { player, slot } : null;
    }).filter(Boolean);
  if (!ownPlayers.length || !opponentPlayers.length) return false;

  let carrier = ownPlayers.find(item => item.player.id === possession.playerId);
  if (!carrier) {
    carrier = ownPlayers[Math.floor(rng() * ownPlayers.length)];
    possession.playerId = carrier.player.id;
  }
  const ownTeamId = side === 'home' ? lm.homeId : lm.awayId;
  const opponentTeamId = opponentSide === 'home' ? lm.homeId : lm.awayId;
  const ownTeam = G.league?.teams?.find(team => team.id === ownTeamId);
  const opponentTeam = G.league?.teams?.find(team => team.id === opponentTeamId);
  const opponentTactics = opponentTeam?.tactics || {};
  const tacticValue = key => Number.isFinite(Number(opponentTactics[key])) ? Number(opponentTactics[key]) : 50;
  const pressure = clamp(tacticValue('pressure') / 100, 0, 1);
  const forecheck = clamp(tacticValue('forecheck') / 100, 0, 1);
  const physical = clamp(tacticValue('physical') / 100, 0, 1);
  const duelRate = clamp(0.025 + pressure * 0.012 + forecheck * 0.008 + physical * 0.005, 0.025, 0.05);
  if (rng() >= duelRate) return false;

  const puckY = Number(lm.positions?.puck?.y ?? carrier.slot.y ?? 50);
  const isBoardBattle = puckY <= 18 || puckY >= 82;
  const challenger = isBoardBattle
    ? opponentPlayers.slice().sort((a, b) => Math.hypot(a.slot.x - carrier.slot.x, a.slot.y - carrier.slot.y)
      - Math.hypot(b.slot.x - carrier.slot.x, b.slot.y - carrier.slot.y))[0]
    : opponentPlayers[Math.floor(rng() * opponentPlayers.length)];
  const carrierStamina = lm.playerStamina?.[side]?.[carrier.player.id] ?? carrier.slot.stamina ?? 100;
  const challengerStamina = lm.playerStamina?.[opponentSide]?.[challenger.player.id] ?? challenger.slot.stamina ?? 100;
  const carrierRating = getLiveDuelRating(carrier.player, 'carrier', carrierStamina, isBoardBattle);
  const challengerRating = getLiveDuelRating(challenger.player, 'defender', challengerStamina, isBoardBattle);
  const tacticalEdge = (physical - 0.5) * (isBoardBattle ? 0.12 : 0.08) + (pressure - 0.5) * 0.04;
  const challengerWinChance = clamp(0.5 + (challengerRating - carrierRating) / 180 + tacticalEdge, 0.25, 0.75);
  const takeaway = rng() < challengerWinChance;
  const statsFor = (player, key) => {
    const stats = lm.isPlayoff ? ensurePlayoffStats(player) : ensureStats(player);
    stats[key] = (Number(stats[key]) || 0) + 1;
  };

  lm.puckBattleStats ||= {
    home: { won: 0, lost: 0, takeaways: 0 },
    away: { won: 0, lost: 0, takeaways: 0 },
  };
  const carrierStats = lm.puckBattleStats[side];
  const challengerStats = lm.puckBattleStats[opponentSide];
  carrierStats[ takeaway ? 'lost' : 'won' ]++;
  challengerStats[ takeaway ? 'won' : 'lost' ]++;
  statsFor(carrier.player, takeaway ? 'puckBattlesLost' : 'puckBattlesWon');
  statsFor(challenger.player, takeaway ? 'puckBattlesWon' : 'puckBattlesLost');
  if (isBoardBattle) {
    statsFor(carrier.player, takeaway ? 'boardBattlesLost' : 'boardBattlesWon');
    statsFor(challenger.player, takeaway ? 'boardBattlesWon' : 'boardBattlesLost');
  }

  if (takeaway) {
    challengerStats.takeaways++;
    statsFor(challenger.player, 'takeaways');
    possession.side = opponentSide;
    possession.playerId = challenger.player.id;
  } else {
    possession.side = side;
    possession.playerId = carrier.player.id;
  }

  const winnerName = takeaway ? challenger.player.name : carrier.player.name;
  const loserName = takeaway ? carrier.player.name : challenger.player.name;
  const text = isBoardBattle
    ? takeaway
      ? `${challenger.player.name} выигрывает борьбу у борта и отбирает шайбу у ${carrier.player.name}`
      : `${carrier.player.name} удерживает шайбу в борьбе у борта с ${challenger.player.name}`
    : takeaway
      ? `${challenger.player.name} отбирает шайбу у ${carrier.player.name}`
      : `${carrier.player.name} выигрывает борьбу за шайбу у ${challenger.player.name}`;
  livePushEvent({
    type: isBoardBattle ? 'board_battle' : 'puck_battle', side: takeaway ? opponentSide : side,
    text, winner: winnerName, loser: loserName, takeaway, boardBattle: isBoardBattle,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });

  // The animation follows the gameplay result; visual RNG never chooses the winner.
  const puck = lm.positions?.puck;
  if (puck) {
    const winnerSide = takeaway ? opponentSide : side;
    const winnerIndex = (lm.positions[winnerSide] || []).findIndex(slot =>
      slot.playerId === possession.playerId && slot.onIce !== false);
    puck.carrierIndex = null;
    puck.looseFrames = 8;
    puck.nextPossessionSide = winnerSide;
    puck.nextCarrierIndex = winnerIndex > 0 ? winnerIndex : 3;
    puck.battle = null;
  }
  return true;
}

function getLiveContactRating(player, stamina = 100) {
  const attrs = player?.attrs || {};
  const fallback = Number(player?.ovr) || 50;
  const read = key => clamp(Number(attrs[key]) || fallback, 1, 99);
  const base = read('physical') * 0.48 + read('skating') * 0.22
    + read('defense') * 0.20 + read('iq') * 0.10;
  return base * (0.70 + clamp(Number(stamina) || 0, 0, 100) * 0.003);
}

function applyLiveContactInjury(lm, teamSide, player, hitForce, stamina, contactType = 'body') {
  if (!lm || !player || (player.injury && player.injury.gamesLeft > 0)) return null;
  const teamId = teamSide === 'home' ? lm.homeId : lm.awayId;
  const team = G.league?.teams?.find(item => item.id === teamId);
  if (!team) return null;
  const fatigue = clamp(Number(player.fatigue) || 0, 0, 100);
  const medicalMod = 1 - (Number(team.infrastructure?.medical) || 0) * 0.05
    - (Number(team.staff?.doctor?.level) || 0) * 0.03;
  const fatigueRisk = fatigue > 70 ? 0.004 : fatigue > 50 ? 0.002 : 0;
  const staminaRisk = clamp((65 - (Number(stamina) || 100)) / 65, 0, 1) * 0.003;
  const boardRisk = contactType === 'board' ? 0.002 : 0;
  const injuryChance = clamp((0.003 + hitForce * 0.009 + fatigueRisk + staminaRisk + boardRisk)
    * Math.max(0.2, medicalMod), 0.001, 0.018);
  if (rng() >= injuryChance) return null;

  const severity = rng() < 0.12 ? 'major' : 'minor';
  const rawGames = severity === 'major'
    ? 8 + Math.floor(rng() * 11)
    : 1 + Math.floor(rng() * 4);
  const gamesLeft = Math.max(1, Math.round(rawGames * Math.max(0.4, medicalMod)));
  player.injury = { gamesLeft, severity, source: 'live_contact' };
  player.playingThroughPain = false;
  player.injuryPolicy = null;

  const severityText = severity === 'major' ? 'серьёзную травму' : 'лёгкое повреждение';
  livePushEvent({
    type: 'injury', side: teamSide,
    text: `${player.name} получает ${severityText} после силового контакта и покидает лёд`,
    playerId: player.id, injuryGames: gamesLeft, injurySeverity: severity,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });
  if (typeof addNews === 'function' && (player.ovr >= 78 || team.id === G.playerTeamId)) {
    addNews('injury', `${player.name} (${team.name}) получил ${severityText} — пропустит ${gamesLeft} игр`, 2);
  }
  if (team.id === G.playerTeamId && typeof addInboxMessage === 'function') {
    addInboxMessage('coach', 'Медицинский штаб', `${player.name} получил травму`,
      `После силового контакта диагностировано повреждение: ${severity === 'major' ? 'серьёзное' : 'лёгкое'}. Игрок пропустит ориентировочно ${gamesLeft} игр.`, []);
  }
  reconcileLiveManpower(lm);
  return player.injury;
}

function resolveLivePhysicalContact(lm, stepSec = LIVE_TICK_SEC) {
  if (!lm || lm.isFinished || lm.isBreak || lm.shootout || lm.positions?.puck?.shotAnimation) return false;
  lm.physicalContactCooldown = Math.max(0, (Number(lm.physicalContactCooldown) || 0) - stepSec);
  if (lm.physicalContactCooldown > 0) return false;

  const possession = lm.gameplayPossession;
  if (!possession?.playerId || !['home', 'away'].includes(possession.side)) return false;
  const defendingSide = possession.side === 'home' ? 'away' : 'home';
  const carrierSlot = (lm.positions?.[possession.side] || []).find(slot =>
    slot.playerId === possession.playerId && slot.onIce !== false && slot.role !== 'goalie'
  );
  if (!carrierSlot) return false;

  const defenders = (lm.positions?.[defendingSide] || [])
    .filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie')
    .map(slot => {
      const player = (lm[defendingSide + 'Lineup']?.skaters || []).find(item => item.id === slot.playerId);
      return player ? { player, slot, distance: Math.hypot(slot.x - carrierSlot.x, slot.y - carrierSlot.y) } : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  const challenger = defenders[0];
  if (!challenger || challenger.distance > 24) return false;

  const defendingTeamId = defendingSide === 'home' ? lm.homeId : lm.awayId;
  const defendingTeam = G.league?.teams?.find(team => team.id === defendingTeamId);
  const physical = clamp((Number(defendingTeam?.tactics?.physical) || 50) / 100, 0, 1);
  const contactChance = clamp(0.012 + physical * 0.035, 0.012, 0.047);
  if (rng() >= contactChance) return false;

  const carrier = (lm[possession.side + 'Lineup']?.skaters || []).find(item => item.id === possession.playerId);
  if (!carrier) return false;
  const carrierStamina = lm.playerStamina?.[possession.side]?.[carrier.id] ?? carrierSlot.stamina ?? 100;
  const challengerStamina = lm.playerStamina?.[defendingSide]?.[challenger.player.id] ?? challenger.slot.stamina ?? 100;
  const hitRating = getLiveContactRating(challenger.player, challengerStamina);
  const resistance = getLiveContactRating(carrier, carrierStamina);
  const hitAdvantage = hitRating - resistance;
  const cleanHitChance = clamp(0.38 + hitAdvantage / 180 + physical * 0.08, 0.20, 0.72);
  const cleanHit = rng() < cleanHitChance;

  const statsFor = (player, key) => {
    const stats = lm.isPlayoff ? ensurePlayoffStats(player) : ensureStats(player);
    stats[key] = (Number(stats[key]) || 0) + 1;
  };
  statsFor(challenger.player, 'hits');
  statsFor(carrier, 'hitsReceived');
  lm.physicalContactCooldown = 15;
  challenger.slot.contactFrames = 9;
  carrierSlot.contactFrames = 9;
  if (cleanHit) carrierSlot.fallFrames = 10;

  const contactType = carrierSlot.y <= 16 || carrierSlot.y >= 84
    ? 'board' : hitAdvantage >= 12 ? 'shoulder' : 'body';
  const hitForce = clamp((hitRating - resistance + 45) / 150
    + (contactType === 'board' ? 0.08 : 0), 0, 1);
  const dislodged = cleanHit && rng() < clamp(0.24 + hitAdvantage / 260
    + (contactType === 'board' ? 0.05 : 0), 0.10, 0.53);
  const injury = cleanHit
    ? applyLiveContactInjury(lm, possession.side, carrier, hitForce, carrierStamina, contactType)
    : null;
  if (dislodged) {
    possession.side = defendingSide;
    possession.playerId = challenger.player.id;
    const puck = lm.positions?.puck;
    const receiverIndex = (lm.positions[defendingSide] || []).findIndex(slot =>
      slot.playerId === challenger.player.id && slot.onIce !== false
    );
    if (puck) {
      puck.carrierIndex = null;
      puck.looseFrames = 9;
      puck.nextPossessionSide = defendingSide;
      puck.nextCarrierIndex = receiverIndex > 0 ? receiverIndex : 3;
      puck.targetX = challenger.slot.x;
      puck.targetY = challenger.slot.y;
      puck.battle = null;
    }
  }

  const hitterName = challenger.player.name || 'Защитник';
  const carrierName = carrier.name || 'Нападающий';
  const contactVerb = contactType === 'board'
    ? 'прижимает к борту'
    : contactType === 'shoulder' ? 'проводит силовой приём плечом против' : 'встречает корпусом';
  livePushEvent({
    type: contactType === 'board' ? 'board_check' : 'body_check', side: defendingSide,
    text: cleanHit
      ? `${hitterName} ${contactVerb} ${carrierName}${dislodged ? ' — шайба потеряна' : ''}${injury ? ' — травма' : ''}`
      : `${carrierName} выдерживает силовой приём ${hitterName}`,
    contactType, hitterId: challenger.player.id, targetId: carrier.id, cleanHit, dislodged, injury: !!injury,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });

  // Only reckless contact can become a penalty; ordinary legal checks remain part of play.
  const discipline = clamp(Number(challenger.player.attrs?.iq) || Number(challenger.player.ovr) || 50, 1, 99);
  const infractionChance = clamp(0.004 + Math.max(0, physical - 0.65) * 0.055
    + Math.max(0, 50 - discipline) * 0.00035, 0.002, 0.035);
  if (rng() < infractionChance && typeof livePenalty === 'function') {
    livePenalty(defendingSide, lm.totalSecPlayed, challenger.player.id, 'силовой приём с нарушением правил');
  }
  return true;
}

function resolveLiveShotBlock(lm, attackingSide, shooterPosition, shotTargetY) {
  if (!lm || !['home', 'away'].includes(attackingSide) || !shooterPosition) return null;
  const defendingSide = attackingSide === 'home' ? 'away' : 'home';
  const goalX = attackingSide === 'home' ? 190 : 10;
  const shotDx = goalX - shooterPosition.x;
  if (Math.abs(shotDx) < 1) return null;
  const candidates = (lm.positions?.[defendingSide] || [])
    .slice(1)
    .filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie')
    .map(slot => {
      const progress = (slot.x - shooterPosition.x) / shotDx;
      if (progress < 0.12 || progress > 0.88) return null;
      const lineY = shooterPosition.y + (shotTargetY - shooterPosition.y) * progress;
      const laneDistance = Math.abs(slot.y - lineY);
      if (laneDistance > 7.5) return null;
      const player = (lm[defendingSide + 'Lineup']?.skaters || [])
        .find(item => item.id === slot.playerId);
      if (!player) return null;
      const attrs = player.attrs || {};
      const fallback = Number(player.ovr) || 50;
      const blocking = clamp(Number(attrs.blocking) || Number(attrs.defense) || fallback, 1, 99);
      const physical = clamp(Number(attrs.physical) || fallback, 1, 99);
      const stamina = lm.playerStamina?.[defendingSide]?.[player.id] ?? slot.stamina ?? 100;
      const rating = (blocking * 0.72 + physical * 0.28) * (0.72 + clamp(stamina, 0, 100) * 0.0028);
      return { player, slot, progress, laneDistance, rating };
    }).filter(Boolean)
    .sort((a, b) => a.laneDistance - b.laneDistance || a.progress - b.progress);
  const blocker = candidates[0];
  if (!blocker) return null;
  const blockChance = clamp(0.18 + blocker.rating / 260, 0.20, 0.62);
  return rng() < blockChance ? { ...blocker, side: defendingSide } : null;
}

function getLiveBreakawayThreat(lm, side) {
  const possession = lm?.gameplayPossession;
  if (possession?.side !== side || !possession.playerId) return null;
  const slot = (lm.positions?.[side] || []).find(item =>
    item.playerId === possession.playerId && item.onIce !== false && item.role !== 'goalie');
  if (!slot || (side === 'home' ? slot.x < 145 : slot.x > 55)) return null;
  const defendingSide = side === 'home' ? 'away' : 'home';
  const closest = (lm.positions?.[defendingSide] || []).filter(item =>
    item.onIce !== false && item.playerId && item.role !== 'goalie')
    .reduce((best, item) => Math.min(best, Math.hypot(item.x - slot.x, item.y - slot.y)), Infinity);
  return closest >= 19 ? possession.playerId : null;
}

function getLiveShotOpportunity(lm, side, activeSkaters, puck) {
  const direction = side === 'home' ? 1 : -1;
  const attackingZone = side === 'home' ? puck.x >= 145 : puck.x <= 55;
  const positions = lm.positions?.[side] || [];
  const defendingSide = side === 'home' ? 'away' : 'home';
  const defenders = (lm.positions?.[defendingSide] || [])
    .filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie');
  const carrierId = lm.gameplayPossession?.side === side ? lm.gameplayPossession.playerId : null;
  const carrier = activeSkaters.find(player => player.id === carrierId);
  const carrierSlot = carrier ? positions.find(slot => slot.playerId === carrier.id && slot.onIce !== false) : null;
  if (carrier && carrierSlot && attackingZone) {
    const closestDefender = defenders.reduce((best, slot) =>
      Math.min(best, Math.hypot(slot.x - carrierSlot.x, slot.y - carrierSlot.y)), Infinity);
    if (closestDefender >= 19) {
      return { shooter: carrier, type: 'breakaway', passer: null, slotPass: false };
    }
    const slotTargets = activeSkaters.filter(player => player.id !== carrier.id).map(player => {
      const slot = positions.find(item => item.playerId === player.id && item.onIce !== false);
      if (!slot) return null;
      const goalDistance = side === 'home' ? 190 - slot.x : slot.x - 10;
      return { player, slot, goalDistance };
    }).filter(item => item && item.goalDistance >= 0 && item.goalDistance <= 34
      && item.slot.y >= 38 && item.slot.y <= 62)
      .sort((a, b) => a.goalDistance - b.goalDistance);
    if (slotTargets.length) {
      const passer = carrier;
      const passing = clamp(Number(passer.attrs?.passing) || Number(passer.ovr) || 50, 1, 99);
      const passChance = clamp(0.10 + passing * 0.0015, 0.10, 0.25);
      if (rng() < passChance) {
        const receiver = slotTargets[0].player;
        const interception = resolveLivePassInterception(lm, side, passer, receiver);
        if (interception) {
          return { shooter: null, type: 'intercepted', passer, receiver, interceptor: interception.player,
            interceptorSlot: interception.slot, slotPass: false };
        }
        return { shooter: receiver, type: 'slot', passer, slotPass: true };
      }
    }
  }
  const shooter = activeSkaters.length ? pickWeighted(activeSkaters, shotWeight) : null;
  return { shooter, type: 'standard', passer: null, slotPass: false };
}

function resolveLivePassInterception(lm, side, passer, receiver) {
  if (!lm || !passer || !receiver) return null;
  const defendingSide = side === 'home' ? 'away' : 'home';
  const passerSlot = (lm.positions?.[side] || []).find(slot =>
    slot.playerId === passer.id && slot.onIce !== false);
  const receiverSlot = (lm.positions?.[side] || []).find(slot =>
    slot.playerId === receiver.id && slot.onIce !== false);
  if (!passerSlot || !receiverSlot) return null;
  const dx = receiverSlot.x - passerSlot.x;
  const dy = receiverSlot.y - passerSlot.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1) return null;
  const passing = clamp(Number(passer.attrs?.passing) || Number(passer.ovr) || 50, 1, 99);
  const candidates = (lm.positions?.[defendingSide] || []).slice(1)
    .filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie')
    .map(slot => {
      const progress = ((slot.x - passerSlot.x) * dx + (slot.y - passerSlot.y) * dy) / lengthSquared;
      if (progress < 0.14 || progress > 0.86) return null;
      const laneY = passerSlot.y + dy * progress;
      const laneX = passerSlot.x + dx * progress;
      const laneDistance = Math.hypot(slot.x - laneX, slot.y - laneY);
      if (laneDistance > 8.5) return null;
      const player = (lm[defendingSide + 'Lineup']?.skaters || [])
        .find(item => item.id === slot.playerId);
      if (!player) return null;
      const attrs = player.attrs || {};
      const fallback = Number(player.ovr) || 50;
      const anticipation = clamp(Number(attrs.interception) || Number(attrs.defense) || fallback, 1, 99);
      const iq = clamp(Number(attrs.iq) || fallback, 1, 99);
      const stamina = lm.playerStamina?.[defendingSide]?.[player.id] ?? slot.stamina ?? 100;
      const rating = (anticipation * 0.58 + iq * 0.42) * (0.72 + clamp(stamina, 0, 100) * 0.0028);
      return { player, slot, progress, laneDistance, rating };
    }).filter(Boolean).sort((a, b) => a.laneDistance - b.laneDistance);
  const interceptor = candidates[0];
  if (!interceptor) return null;
  const interceptionChance = clamp(
    0.12 + (interceptor.rating - passing) / 190 + (8.5 - interceptor.laneDistance) * 0.018,
    0.08, 0.58
  );
  return rng() < interceptionChance ? { ...interceptor, side: defendingSide } : null;
}

function getLiveGoalieControl(goaliePlayer) {
  const attrs = goaliePlayer?.attrs || {};
  return clamp(Number(attrs.reboundControl) || Number(attrs.reflexes)
    || Number(goaliePlayer?.ovr) || 50, 1, 99);
}

function resolveLiveShotRebound(lm, attackingSide, shooter, outcome, shotTargetY) {
  const defendingSide = attackingSide === 'home' ? 'away' : 'home';
  const goalX = attackingSide === 'home' ? 190 : 10;
  const goalie = (lm.positions?.[defendingSide] || []).find(slot => slot.role === 'goalie' && slot.onIce !== false);
  const goaliePlayer = goalie && (lm[defendingSide + 'Lineup']?.goalie || null);
  const control = getLiveGoalieControl(goaliePlayer);
  // Хорошо контролируемый отскок уходит за пределы пятака, к борту;
  // слабый контроль чаще оставляет шайбу в опасной зоне перед воротами.
  const cornerOffset = 7 + control * 0.15;
  const targetX = attackingSide === 'home' ? goalX - (7 + control * 0.12) : goalX + (7 + control * 0.12);
  const targetY = clamp(shotTargetY + (shotTargetY < 50 ? cornerOffset : -cornerOffset), 9, 91);
  const candidates = {};
  for (const side of [attackingSide, defendingSide]) {
    const slots = lm.positions?.[side] || [];
    candidates[side] = slots.slice(1).filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie')
      .map(slot => {
        const player = (lm[side + 'Lineup']?.skaters || []).find(item => item.id === slot.playerId);
        if (!player) return null;
        const distance = Math.hypot(slot.x - targetX, slot.y - targetY);
        const attrs = player.attrs || {};
        const skill = (Number(attrs.physical) || Number(player.ovr) || 50) * 0.32
          + (Number(attrs.skating) || Number(player.ovr) || 50) * 0.28
          + (Number(attrs.iq) || Number(player.ovr) || 50) * 0.24
          + (Number(attrs.defense) || Number(player.ovr) || 50) * 0.16;
        return { player, slot, distance, rating: skill - distance * 1.25 };
      }).filter(Boolean).sort((a, b) => b.rating - a.rating);
  }
  const attacker = candidates[attackingSide][0] || null;
  const defender = candidates[defendingSide][0] || null;
  const smotherChance = outcome === 'сейв' ? clamp(0.16 + control * 0.0038, 0.16, 0.54) : 0;
  let winnerSide, winner, frozen = false;
  if (rng() < smotherChance || (!attacker && !defender)) {
    winnerSide = defendingSide;
    winner = null;
    frozen = true;
  } else if (!attacker) {
    winnerSide = defendingSide; winner = defender;
  } else if (!defender) {
    winnerSide = attackingSide; winner = attacker;
  } else {
    const attackerChance = clamp(0.5 + (attacker.rating - defender.rating) / 100, 0.22, 0.78);
    winnerSide = rng() < attackerChance ? attackingSide : defendingSide;
    winner = winnerSide === attackingSide ? attacker : defender;
  }
  const winnerIndex = frozen ? 0 : winner
    ? (lm.positions[winnerSide] || []).findIndex(slot => slot.playerId === winner.player.id && slot.onIce !== false)
    : -1;
  const loserSide = winnerSide === attackingSide ? defendingSide : attackingSide;
  const loser = frozen ? null : winnerSide === attackingSide ? defender : attacker;
  const statsFor = (player, key) => {
    if (!player) return;
    const stats = lm.isPlayoff ? ensurePlayoffStats(player) : ensureStats(player);
    stats[key] = (Number(stats[key]) || 0) + 1;
  };
  if (winner && !frozen) statsFor(winner.player, 'reboundRecoveries');
  if (loser && !frozen) statsFor(loser.player, 'reboundBattlesLost');
  if (winner && !frozen) statsFor(winner.player, 'reboundBattlesWon');
  if (frozen && goaliePlayer) statsFor(goaliePlayer, 'reboundCovers');
  lm.gameplayPossession = { side: winnerSide, playerId: frozen ? null : winner?.player.id || null };
  lm.reboundStats ||= { home: 0, away: 0, contested: 0, covered: 0 };
  if (frozen) lm.reboundStats.covered++;
  else {
    lm.reboundStats[winnerSide]++;
    if (attacker && defender) lm.reboundStats.contested++;
  }
  livePushEvent({
    type: frozen ? 'goalie_cover' : 'rebound',
    side: winnerSide,
    text: frozen
      ? `${goaliePlayer?.name || 'Вратарь'} фиксирует шайбу после броска ${shooter.name}`
      : winner
        ? `${winner.player.name} подбирает отскочившую шайбу после броска ${shooter.name}`
        : 'Шайба отскакивает от ворот',
    shooterId: shooter.id, winnerId: winner?.player.id || null,
    contested: !!(attacker && defender), frozen,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });
  return {
    side: winnerSide,
    carrierIndex: frozen ? 0 : winnerIndex > 0 ? winnerIndex : null,
    // Сначала шайба визуально уходит в выбранный угол, затем её подбирает
    // уже определённый игровой логикой победитель борьбы.
    targetX,
    targetY,
    frozen,
  };
}

function liveAdvance(stepSec) {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const scoreBefore = (Number(lm.hg) || 0) + (Number(lm.ag) || 0);
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

  const homeBreakaway = getLiveBreakawayThreat(lm, 'home');
  const awayBreakaway = getLiveBreakawayThreat(lm, 'away');
  lm.breakawayThreat = homeBreakaway
    ? { side: 'home', playerId: homeBreakaway }
    : awayBreakaway ? { side: 'away', playerId: awayBreakaway } : null;
  const pH = hXg * hMod * lm.situation.home.attack * lm.situation.away.defense
    * (homeBreakaway ? 1.32 : 1) * (stepSec / 3600);
  const pA = aXg * aMod * lm.situation.away.attack * lm.situation.home.defense
    * (awayBreakaway ? 1.32 : 1) * (stepSec / 3600);

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
        const side = lm.gameplayPossession?.side || (rng() < 0.5 ? 'home' : 'away');
        const lineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
        const defendingSide = side === 'home' ? 'away' : 'home';
        const activeIds = new Set((lm.positions?.[side] || []).slice(1).filter(player => player.onIce !== false).map(player => player.playerId));
        const activeSkaters = lineup.skaters.filter(player => activeIds.has(player.id));
        const shooters = activeSkaters.length ? activeSkaters : lineup.skaters;
        if (shooters.length) {
          const puck = lm.positions?.puck;
          const puckForShot = puck || { x: side === 'home' ? 150 : 50, y: 50 };
          const opportunity = getLiveShotOpportunity(lm, side, activeSkaters.length ? activeSkaters : shooters, puckForShot);
          if (opportunity.type === 'intercepted' && opportunity.interceptor) {
            const interceptor = opportunity.interceptor;
            const interceptorSlot = opportunity.interceptorSlot;
            const interceptionStats = lm.isPlayoff ? ensurePlayoffStats(interceptor) : ensureStats(interceptor);
            interceptionStats.interceptions = (Number(interceptionStats.interceptions) || 0) + 1;
            lm.gameplayPossession = { side: defendingSide, playerId: interceptor.id };
            if (puck && interceptorSlot) {
              const carrierIndex = (lm.positions[defendingSide] || []).findIndex(slot =>
                slot.playerId === interceptor.id && slot.onIce !== false);
              puck.passFromX = puck.x;
              puck.passFromY = puck.y;
              puck.passFrames = 12;
              puck.possessionSide = defendingSide;
              puck.carrierIndex = carrierIndex;
              puck.looseFrames = 0;
              puck.shotAnimation = null;
              puck.actionFrames = 75;
            }
            livePushEvent({
              type: 'pass_interception', side: defendingSide,
              text: `${interceptor.name} перехватывает передачу ${opportunity.passer.name} на партнёра`,
              interceptorId: interceptor.id, passerId: opportunity.passer.id,
              receiverId: opportunity.receiver.id,
              time: liveFmtTime(lm.timeLeft), period: lm.period,
            });
          } else {
          const p = opportunity.shooter || pickWeighted(shooters, shotWeight);
          if (opportunity.slotPass && opportunity.passer) {
            const passerStats = lm.isPlayoff ? ensurePlayoffStats(opportunity.passer) : ensureStats(opportunity.passer);
            passerStats.slotPasses = (Number(passerStats.slotPasses) || 0) + 1;
            lm.lastSlotPass = { side, passerId: opportunity.passer.id, receiverId: p.id, expiresAt: lm.totalSecPlayed + 10 };
            lm.gameplayPossession = { side, playerId: p.id };
            livePushEvent({
              type: 'slot_pass', side,
              text: `${opportunity.passer.name} отдаёт передачу на пятак — ${p.name} готовится бросать`,
              passerId: opportunity.passer.id, receiverId: p.id,
              time: liveFmtTime(lm.timeLeft), period: lm.period,
            });
          }
          if (opportunity.type === 'breakaway') {
            const breakawayStats = lm.isPlayoff ? ensurePlayoffStats(p) : ensureStats(p);
            breakawayStats.breakawayAttempts = (Number(breakawayStats.breakawayAttempts) || 0) + 1;
            livePushEvent({
              type: 'breakaway', side,
              text: `${p.name} выходит один на один с вратарём!`,
              shooterId: p.id, time: liveFmtTime(lm.timeLeft), period: lm.period,
            });
          }
          let outcome = pick(opportunity.type === 'breakaway'
            ? ['сейв','сейв','сейв','сейв','мимо','штанга']
            : opportunity.type === 'slot'
              ? ['сейв','сейв','сейв','сейв','мимо','штанга']
              : ['сейв','сейв','сейв','мимо','штанга']);
          lm.shotAttempts ||= { home: 0, away: 0 };
          lm.shotAttempts[side]++;
          const shooterPositions = lm.positions?.[side] || [];
          const shooterIndex = shooterPositions.findIndex(position => position.playerId === p.id);
          const shooterPosition = shooterPositions[shooterIndex >= 0 ? shooterIndex : 3];
          const shotOriginY = shooterPosition?.y ?? puck?.y ?? 50;
          const shotTargetY = clamp(shotOriginY + (outcome === 'штанга' ? (shotOriginY < 50 ? -7 : 7) : 0), 43, 57);
          const block = outcome === 'сейв'
            ? resolveLiveShotBlock(lm, side, shooterPosition, shotTargetY) : null;
          if (block) outcome = 'блокирован';
          // В створ идут только сейвы и голы; заблокированный бросок не считается броском в створ.
          if (outcome === 'сейв') {
            lm.shots[side]++;
            const goalieOnIce = lm.positions?.[defendingSide]?.[0]?.onIce !== false;
            if (goalieOnIce) lm.goalieStats[defendingSide].shots++;
            const isPlayoff = lm.isPlayoff;
            (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++;
          }
          if (block) {
            const isPlayoff = lm.isPlayoff;
            const blockerStats = isPlayoff ? ensurePlayoffStats(block.player) : ensureStats(block.player);
            blockerStats.blocks = (Number(blockerStats.blocks) || 0) + 1;
            lm.gameplayPossession = { side: defendingSide, playerId: block.player.id };
            livePushEvent({
              type: 'shot_block', side: defendingSide,
              text: `${block.player.name} блокирует бросок ${p.name}`,
              blockerId: block.player.id, shooterId: p.id,
              time: liveFmtTime(lm.timeLeft), period: lm.period,
            });
          }
          if (opportunity.type === 'breakaway' || opportunity.type === 'slot') {
            const shotTypeStats = lm.isPlayoff ? ensurePlayoffStats(p) : ensureStats(p);
            const key = opportunity.type === 'breakaway' ? 'breakawayShots' : 'slotShots';
            shotTypeStats[key] = (Number(shotTypeStats[key]) || 0) + 1;
          }
          if (puck) {
            const defendingGoalie = (lm.positions[defendingSide] || []).find(position => position.role === 'goalie');
            const attackingGoalX = side === 'home' ? 190 : 10;
            const rebound = !block && (outcome === 'сейв' || outcome === 'штанга')
              ? resolveLiveShotRebound(lm, side, p, outcome, shotTargetY) : null;
            if (!block && outcome === 'мимо') {
              const nearestDefender = (lm.positions[defendingSide] || []).slice(1)
                .filter(slot => slot.onIce !== false && slot.playerId && slot.role !== 'goalie')
                .sort((a, b) => Math.hypot(a.x - (side === 'home' ? 180 : 20), a.y - shotTargetY)
                  - Math.hypot(b.x - (side === 'home' ? 180 : 20), b.y - shotTargetY))[0];
              const defender = nearestDefender && (lm[defendingSide + 'Lineup']?.skaters || [])
                .find(player => player.id === nearestDefender.playerId);
              lm.gameplayPossession = { side: defendingSide, playerId: defender?.id || null };
            }
            puck.possessionSide = side;
            puck.carrierIndex = null;
            puck.shotAnimation = {
              side, outcome, defendingSide,
              startX: shooterPosition ? shooterPosition.x : puck.x,
              startY: shooterPosition ? shooterPosition.y : puck.y,
              targetX: block ? block.slot.x : outcome === 'сейв' && defendingGoalie ? defendingGoalie.x : attackingGoalX,
              targetY: block ? block.slot.y : shotTargetY,
              nextPossessionSide: block ? defendingSide : rebound?.side || (outcome === 'мимо' ? defendingSide : side),
              nextCarrierIndex: block ? (lm.positions[defendingSide] || []).findIndex(slot => slot.playerId === block.player.id && slot.onIce !== false) : rebound?.carrierIndex ?? null,
              reboundX: rebound?.targetX, reboundY: rebound?.targetY, reboundFrozen: !!rebound?.frozen,
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
            text: `${p.name} (${p.position}) [${sideName}] бросает${opportunity.type === 'breakaway' ? ' после выхода один на один' : opportunity.type === 'slot' ? ' в касание после передачи на пятак' : ''} — ${outcome}.`,
            shooterId: p.id, shotType: opportunity.type,
            time: liveFmtTime(lm.timeLeft), period: lm.period,
          });
          }
        }
      }
    }
  }

  if ((Number(lm.hg) || 0) + (Number(lm.ag) || 0) === scoreBefore && typeof resolveLivePuckBattle === 'function') resolveLivePuckBattle(lm);
  if ((Number(lm.hg) || 0) + (Number(lm.ag) || 0) === scoreBefore && typeof resolveLivePhysicalContact === 'function') resolveLivePhysicalContact(lm, stepSec);

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
  const breakawayPlayerId = lm.breakawayThreat?.side === side ? lm.breakawayThreat.playerId : null;
  const scorer = onIceScorers.find(player => player.id === breakawayPlayerId)
    || (lm.gameplayPossession?.side === side
      ? onIceScorers.find(player => player.id === lm.gameplayPossession.playerId) : null)
    || pickWeighted(onIceScorers, scorerWeight);
  lm.breakawayThreat = null;

  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) {
    addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  }

  const assistPool = onIceScorers.filter(p => p.id !== scorer.id);
  const slotPassAssist = lm.lastSlotPass?.side === side
    && lm.lastSlotPass.receiverId === scorer.id
    && lm.totalSecPlayed <= lm.lastSlotPass.expiresAt
    ? assistPool.find(player => player.id === lm.lastSlotPass.passerId) : null;
  const numAssists = slotPassAssist
    ? Math.max(1, rng() < 0.35 ? 1 : 2)
    : rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assisters = [];
  if (slotPassAssist) {
    assisters.push(slotPassAssist);
    const aStat = isPlayoff ? ensurePlayoffStats(slotPassAssist) : ensureStats(slotPassAssist);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(slotPassAssist), 1);
  }
  for (let i = assisters.length; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }
  if (slotPassAssist) lm.lastSlotPass = null;

  if (side === 'home') lm.hg++; else lm.ag++;
  const defendingSide = side === 'home' ? 'away' : 'home';
  const defendingGoalieOnIce = lm.positions?.[defendingSide]?.[0]?.onIce !== false;
  if (defendingGoalieOnIce) lm.goalieStats[defendingSide].goals++;
  lm.shotAttempts ||= { home: 0, away: 0 };
  lm.shotAttempts[side]++;
  lm.shots[side]++;
  if (defendingGoalieOnIce) lm.goalieStats[defendingSide].shots++;
  lm.gameplayPossession = { side: side === 'home' ? 'away' : 'home', playerId: null };
  lm.lastGoalSide = side;
  lm.goalFlashUntil = Date.now() + 1200;
  const scoringPositions = lm.positions?.[side] || [];
  for (const slot of scoringPositions) {
    if (slot.role === 'goalie' || slot.onIce === false) continue;
    slot.celebrationFrames = slot.playerId === scorer.id ? 34 : 20;
  }

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
  const txt = `ГОЛ! ${scorer.name} (${scorer.position})${breakawayPlayerId === scorer.id ? ' после выхода один на один' : ''}${assisters.length ? ` — ассист: ${assistNames}` : ''} [${sideName}]`;
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

function livePenalty(side, startedAt = null, offenderId = null, reasonOverride = null) {
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
  const p = eligible.find(player => player.id === offenderId) || pick(eligible);
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
  const reason = reasonOverride || (isMajor ? pick(['удар в голову','драка','атака вратаря']) : pick(['задержка','подножка','грубость','толчок','удар соперника']));
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
    const isFallen = (p.fallFrames || 0) > 0;
    if (isFallen && typeof ctx.rotate === 'function') ctx.rotate(Math.PI / 2);

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
    if ((p.celebrationFrames || 0) > 0) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -1); ctx.lineTo(-10, -7);
      ctx.moveTo(6, -1); ctx.lineTo(10, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -10, 3.5, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
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

    if (isFallen) p.fallFrames--;

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
    if (lm.goaliePulled?.home) parts.push(`${homeTeamNameShort()} — пустые ворота, ${manpower.home.skaters} полевых`);
    if (lm.goaliePulled?.away) parts.push(`${awayTeamNameShort()} — пустые ворота, ${manpower.away.skaters} полевых`);
    if (hp.length || ap.length || parts.length) {
      const box = [...hp.map(p => `${p.playerName}: ${p.type} мин`), ...ap.map(p => `${p.playerName}: ${p.type} мин`)];
      ppEl.textContent = [parts.join(' · '), box.join(' | ')].filter(Boolean).join(' — ');
      ppEl.style.display = 'block';
    } else ppEl.style.display = 'none';
  }

  const feedEl = document.getElementById('live-feed');
  if (feedEl) {
    const playerSide = lm.homeId === G.playerTeamId ? 'home' : 'away';
    const html = lm.events.slice(0, 30).map(ev => {
      const cls = ev.type === 'goal' ? 'goal' : ev.type === 'penalty' ? 'penalty' : ev.type === 'period' ? 'period' : ev.type === 'shot' || ev.type === 'shootout' ? 'shot' : 'event';
      const teamCls = ev.side === playerSide ? 'team-us' : ev.side && ev.side !== playerSide ? 'team-opponent' : '';
      const teamLabel = ev.side === playerSide ? '<span class="lfi-team-tag">НАШИ</span>'
        : ev.side && ev.side !== playerSide ? '<span class="lfi-team-tag">СОПЕРНИК</span>' : '';
      return `<div class="live-feed-item ${cls} ${teamCls}"><span class="lfi-time">[${ev.time || '—'}]</span>${teamLabel}${ev.text}</div>`;
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
  for (const side of ['home', 'away']) {
    for (const slot of lm.positions[side] || []) {
      if ((slot.celebrationFrames || 0) > 0) slot.celebrationFrames--;
    }
  }
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
      puck.looseFrames = shot.outcome === 'сейв' || shot.outcome === 'штанга' ? (shot.reboundFrozen ? 0 : 18) : shot.outcome === 'блокирован' ? 22 : 12;
      puck.targetX = Number.isFinite(shot.reboundX) ? shot.reboundX
        : clamp(shot.targetX + (shot.side === 'home' ? -7 : 7), 5, 195);
      puck.targetY = Number.isFinite(shot.reboundY) ? shot.reboundY
        : clamp(shot.targetY + (shot.outcome === 'штанга' ? 8 : 3), 8, 92);
      puck.reboundFrames = shot.outcome === 'сейв' || shot.outcome === 'штанга' ? 7 : 0;
      puck.nextPossessionSide = shot.nextPossessionSide
        || (shot.outcome === 'сейв' || shot.outcome === 'блокирован' ? shot.defendingSide : shot.side);
      puck.nextCarrierIndex = shot.reboundFrozen ? 0
        : Number.isInteger(shot.nextCarrierIndex) && shot.nextCarrierIndex > 0
          ? shot.nextCarrierIndex : 3 + Math.floor(visualRng() * 3);
      if (shot.reboundFrozen) {
        puck.possessionSide = shot.nextPossessionSide || shot.defendingSide;
        puck.carrierIndex = 0;
        puck.nextPossessionSide = null;
        puck.nextCarrierIndex = null;
        puck.actionFrames = 65;
      }
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
        const winner = puck.battle.winner || puck.nextPossessionSide || lm.gameplayPossession?.side || puck.possessionSide || 'home';
        puck.nextPossessionSide = winner;
        puck.nextCarrierIndex = puck.battle[winner + 'Index'];
        puck.battle = null;
        puck.looseFrames = 1;
      }
    } else {
      const receiver = Number.isInteger(puck.nextCarrierIndex)
        ? (lm.positions[puck.nextPossessionSide] || [])[puck.nextCarrierIndex] : null;
      const showingReboundDeflection = (puck.reboundFrames || 0) > 0;
      const targetX = !showingReboundDeflection && receiver ? receiver.x : (puck.targetX ?? 100);
      const targetY = !showingReboundDeflection && receiver ? receiver.y : (puck.targetY ?? 50);
      puck.x += (targetX - puck.x) * 0.18;
      puck.y += (targetY - puck.y) * 0.18;
      if (showingReboundDeflection) puck.reboundFrames--;
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
      const isBobble = visualRng() < 0.18;

      if (isBobble) {
        // A visual bobble is recovered by the same team; only the gameplay
        // puck-battle resolver is allowed to award possession to the opponent.
        const nextSide = currentSide;
        const nextCarrierIndex = 3 + Math.floor(visualRng() * 3);
        const receiver = (lm.positions[nextSide] || [])[nextCarrierIndex];
        puck.carrierIndex = null;
        puck.targetX = receiver ? receiver.x : 100;
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
    const opponentSide = side === 'home' ? 'away' : 'home';
    const opponentPlayers = (lm.positions[opponentSide] || [])
      .filter(player => player.onIce !== false && player.role !== 'goalie');
    const opponentPossession = lm.gameplayPossession?.side === opponentSide;
    const opponentCarrier = opponentPossession
      ? (lm.positions[opponentSide] || []).find(player =>
          player.playerId === lm.gameplayPossession.playerId && player.onIce !== false)
        || (lm.positions[opponentSide] || [])[puck.carrierIndex]
      : null;
    const activeDefenders = players.filter(player => player.role === 'D' && player.onIce !== false);
    const defendersByCarrier = activeDefenders.slice().sort((a, b) =>
      Math.hypot((opponentCarrier?.x ?? puck.x) - a.x, (opponentCarrier?.y ?? puck.y) - a.y)
      - Math.hypot((opponentCarrier?.x ?? puck.x) - b.x, (opponentCarrier?.y ?? puck.y) - b.y));
    const pressureDefender = defendersByCarrier[0] || null;
    const markedThreats = opponentPlayers
      .filter(player => player !== opponentCarrier && player.role !== 'D')
      .map(player => ({
        player,
        danger: Math.abs(player.x - ownGoalX) * 0.72 + Math.abs(player.y - 50) * 0.34,
      }))
      .sort((a, b) => a.danger - b.danger);
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
        // Вратарь сохраняет глубину вратарской, но читает поперечное движение шайбы.
        // Во время броска смещается именно в линию броска, не выходя за пределы створа.
        const puckInOwnZone = (puck.x - ownGoalX) * direction < 58;
        const shotOnGoalie = puck.shotAnimation && puck.shotAnimation.defendingSide === side;
        const shotLaneY = shotOnGoalie ? puck.shotAnimation.targetY : 50 + (puck.y - 50) * 0.34;
        const distanceToGoal = Math.abs(puck.x - ownGoalX);
        const depth = puckInOwnZone ? clamp(3.5 + (58 - distanceToGoal) * 0.045, 3.5, 6.2) : 2;
        targetX = ownGoalX + direction * depth;
        targetY = clamp(shotLaneY, 34, 66);
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
      } else if (!hasPuck && isDefender && opponentCarrier
        && (side === 'home' ? puck.x < 155 : puck.x > 45)) {
        // Один защитник встречает носителя шайбы, второй остаётся между опасным
        // нападающим и воротами. Это динамическая страховка, а не фиксированные полосы.
        const carrierDistance = Math.hypot(opponentCarrier.x - player.x, opponentCarrier.y - player.y);
        const challengeRange = 62 + tactics.pressure * 0.12;
        if (player === pressureDefender) {
          const containGap = carrierDistance > challengeRange ? 15
            : tactics.pressure >= 72 ? 3 : 7 + (50 - tactics.pressure) * 0.055;
          targetX = opponentCarrier.x - direction * containGap;
          targetY = opponentCarrier.y + (50 - opponentCarrier.y) * 0.08;
        } else {
          const threat = markedThreats.find(item => !defendersByCarrier
            .slice(0, 1).some(defender => defender === player))?.player || null;
          const coverX = ownGoalX + direction * (24 + tactics.pressure * 0.018);
          if (threat) {
            const coverDepth = clamp(Math.abs(threat.x - ownGoalX) * 0.55, 18, 82);
            targetX = ownGoalX + direction * coverDepth;
            targetY = clamp(threat.y + (50 - threat.y) * 0.16, 30, 70);
          } else {
            targetX = coverX;
            targetY = clamp(50 + (opponentCarrier.y - 50) * 0.28, 34, 66);
          }
        }
      } else if (player === closestSkater) {
        // Ближайший полевой игрок атакует шайбу; защитники сохраняют отдельную страховку.
        targetX = (aggressivePress || isRecoveringAgainstCounter) ? puck.x : puck.x - direction * (8 + (50 - tactics.pressure) * 0.12);
        targetY = (aggressivePress || isRecoveringAgainstCounter) ? puck.y : puck.y + (50 - puck.y) * 0.22;
      } else if (!hasPuck && isDefender
        && (side === 'home' ? puck.x < 115 : puck.x > 85)) {
        const slotDepth = 23 + tactics.pressure * 0.025;
        targetX = ownGoalX + direction * slotDepth;
        targetY = clamp(50 + (puck.y - 50) * 0.22, 35, 65);
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
      const jitter = isGoalie ? 0.001 : 0.004;
      const response = isGoalie ? 0.105 : 0.035;
      const staminaFactor = isGoalie ? 1 : clamp((player.stamina ?? 100) / 100, 0.58, 1);
      const physicalFactor = isGoalie ? 1 : 0.96 + tactics.physical * 0.0008;
      const maxSpeed = (isGoalie ? 0.42 : isDefender ? 0.78 : 0.9) * staminaFactor * physicalFactor;
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
        // The visual contact may delay the handoff, but cannot override the
        // gameplay resolver's winner with a fresh visual-RNG coin flip.
        winner: puck.nextPossessionSide || lm.gameplayPossession?.side || puck.possessionSide || 'home',
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
