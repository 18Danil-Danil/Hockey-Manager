/* ============================================================
   РАЗДЕВАЛКА: личные разговоры, встречи и командные мероприятия
   ============================================================ */
const LOCKER_ROOM_TOPICS = {
  support: { label: 'Поддержать', description: 'Помочь игроку справиться с трудным отрезком' },
  praise: { label: 'Похвалить', description: 'Отметить хорошую игру и вклад в команду' },
  role: { label: 'Обсудить роль', description: 'Объяснить игровую роль и ожидания тренерского штаба' },
  feedback: { label: 'Обратная связь', description: 'Спокойно разобрать ошибки и наметить улучшения' }
};
const LOCKER_ROOM_TEAM_EVENTS = {
  meeting: { label: 'Командное собрание', description: 'Обсудить цели, задачи и атмосферу в раздевалке', cost: 0, cooldown: 4 },
  dinner: { label: 'Командный ужин', description: 'Неформальное общение помогает сплотить коллектив', cost: 1.5, cooldown: 6 },
  recovery: { label: 'Совместный день восстановления', description: 'Отдых и восстановительные процедуры после тяжёлого отрезка', cost: 1.2, cooldown: 5 },
  psychologist: { label: 'Групповая встреча с психологом', description: 'Работа с напряжением и настроением команды', cost: 0.5, cooldown: 5, requiresPsychologist: true },
  teambuilding: { label: 'Командное мероприятие', description: 'Совместная активность вне льда', cost: 2, cooldown: 7 }
};

function getLockerRoomState(team) {
  if (!team.lockerRoom || typeof team.lockerRoom !== 'object') {
    team.lockerRoom = { meetings: [], lastTeamEventRound: -100, lastTeamEvent: null, eventHistory: [] };
  }
  if (!Array.isArray(team.lockerRoom.meetings)) team.lockerRoom.meetings = [];
  if (!Array.isArray(team.lockerRoom.eventHistory)) team.lockerRoom.eventHistory = [];
  if (!Array.isArray(team.lockerRoom.meetingHistory)) team.lockerRoom.meetingHistory = [];
  if (!Array.isArray(team.lockerRoom.requests)) team.lockerRoom.requests = [];
  if (!Number.isFinite(Number(team.lockerRoom.lastTeamEventRound))) team.lockerRoom.lastTeamEventRound = -100;
  return team.lockerRoom;
}
function getLockerRoomTeam() {
  return G.league?.teams?.find(team => team.id === G.playerTeamId) || null;
}
function getPlayerTalkCooldown(player) {
  const last = Number(player.lastLockerRoomTalkRound);
  return Number.isFinite(last) ? Math.max(0, 3 - (G.league.currentRound - last)) : 0;
}
function getPlayerConversationResult(player, topic) {
  const morale = Math.max(20, Math.min(100, Number(player.morale) || 65));
  const form = Math.max(30, Math.min(99, Number(player.form) || 60));
  let moraleDelta = 0, formDelta = 0, message = '';
  if (topic === 'support') {
    moraleDelta = morale < 45 ? 6 : morale < 60 ? 5 : morale < 75 ? 3 : 1;
    formDelta = form < 50 ? 2 : 0;
    message = morale < 55
      ? 'Разговор помог хоккеисту почувствовать поддержку тренерского штаба.'
      : 'Игрок оценил внимание и поддержку со стороны тренера.';
  } else if (topic === 'praise') {
    const stats = player.stats || {};
    const productive = form >= 70 || (Number(stats.gp) >= 5 && Number(stats.points) >= 5);
    moraleDelta = productive ? 4 : 1;
    formDelta = productive ? 2 : 0;
    message = productive
      ? 'Хоккеист положительно отреагировал на похвалу и признание его вклада.'
      : 'Игрок поблагодарил за внимание, но понимает, что должен прибавить.';
  } else if (topic === 'role') {
    const team = getLockerRoomTeam();
    const benched = (team?.bench || []).includes(player.id);
    moraleDelta = benched ? (morale < 55 ? 2 : -1) : 2;
    message = benched
      ? 'Вы объяснили причины текущей роли. Игрок понял позицию штаба, хотя хотел бы больше игрового времени.'
      : 'Роль и ожидания тренерского штаба стали понятнее игроку.';
  } else if (topic === 'feedback') {
    moraleDelta = morale < 45 ? -2 : 0;
    formDelta = form < 75 ? 2 : 1;
    message = morale < 45
      ? 'Игрок воспринял замечания болезненно. Потребуется дополнительное внимание.'
      : 'Конструктивный разбор помог игроку понять, над чем работать.';
  } else {
    return { success: false, message: 'Неизвестная тема разговора' };
  }
  const character = player.character || 'calm';
  if (character === 'leader' && (topic === 'support' || topic === 'praise')) moraleDelta += 1;
  if (character === 'worker' && topic === 'feedback') formDelta += 1;
  return { success: true, moraleDelta, formDelta, message };
}
function applyPlayerConversation(team, player, topic, source = 'direct') {
  if (!team || !player || !team.roster?.some(item => item.id === player.id)) {
    return { success: false, reason: 'player-not-in-team', message: 'Хоккеист больше не состоит в команде' };
  }
  const state = getLockerRoomState(team);
  if (source === 'direct' && state.meetings.some(item => item.playerId === player.id)) return { success: false, reason: 'meeting-scheduled', message: 'С этим хоккеистом уже назначена встреча.' };
  const cooldown = getPlayerTalkCooldown(player);
  if (cooldown > 0) return { success: false, reason: 'cooldown', cooldown, message: 'Следующий личный разговор можно провести через ' + cooldown + ' тур.' };
  const result = getPlayerConversationResult(player, topic);
  if (!result.success) return result;
  player.morale = Math.max(20, Math.min(100, (Number(player.morale) || 65) + result.moraleDelta));
  player.form = Math.max(30, Math.min(99, (Number(player.form) || 60) + result.formDelta));
  player.lastLockerRoomTalkRound = G.league.currentRound;
  player.lastLockerRoomTalkTopic = topic;
  const topicLabel = LOCKER_ROOM_TOPICS[topic].label.toLowerCase();
  if (team.id === G.playerTeamId && source === 'direct') {
    addInboxMessage('player', player.name, 'Личный разговор: ' + LOCKER_ROOM_TOPICS[topic].label,
      result.message + ' Мораль ' + (result.moraleDelta >= 0 ? '+' : '') + result.moraleDelta +
      (result.formDelta ? ', форма +' + result.formDelta : '') + '.', []);
    addNews('player_story', 'Тренер провёл личный разговор с ' + player.name + ' (' + topicLabel + ')', 1);
  }
  return { ...result, player, topic, source };
}
function talkToPlayer(playerId, topic) {
  const team = getLockerRoomTeam();
  const player = team?.roster?.find(item => item.id === playerId);
  const result = applyPlayerConversation(team, player, topic, 'direct');
  if (typeof showToast === 'function') showToast(result.message, result.success ? 'success' : 'info');
  if (typeof render === 'function') render();
  if (result.success && typeof saveGame === 'function') saveGame({ immediate: true });
  return result;
}
function schedulePlayerMeeting(playerId, topic, delay = 1) {
  const team = getLockerRoomTeam();
  const player = team?.roster?.find(item => item.id === playerId);
  if (!team || !player) return { success: false, message: 'Хоккеист не найден' };
  if (!LOCKER_ROOM_TOPICS[topic]) return { success: false, message: 'Выберите тему встречи' };
  const state = getLockerRoomState(team);
  if (state.meetings.some(item => item.playerId === playerId)) return { success: false, message: 'Встреча с этим хоккеистом уже назначена' };
  const cooldown = getPlayerTalkCooldown(player);
  if (cooldown > 0) return { success: false, message: 'Личный разговор будет доступен через ' + cooldown + ' тур.' };
  const roundsAhead = Math.max(1, Math.min(3, Math.floor(Number(delay) || 1)));
  const meeting = {
    id: nextId(), playerId, playerName: player.name, topic,
    scheduledRound: G.league.currentRound + roundsAhead,
    createdRound: G.league.currentRound, status: 'scheduled'
  };
  state.meetings.push(meeting);
  addInboxMessage('player', player.name, 'Назначена личная встреча',
    'Встреча назначена на ' + roundsAhead + ' тур(а) вперёд. Тема: ' + LOCKER_ROOM_TOPICS[topic].label + '.', []);
  if (typeof showToast === 'function') showToast('Встреча с ' + player.name + ' назначена', 'success');
  if (typeof render === 'function') render();
  if (typeof saveGame === 'function') saveGame({ immediate: true });
  return { success: true, meeting };
}
function cancelPlayerMeeting(meetingId) {
  const team = getLockerRoomTeam();
  if (!team) return false;
  const state = getLockerRoomState(team);
  const before = state.meetings.length;
  state.meetings = state.meetings.filter(item => item.id !== meetingId);
  if (state.meetings.length === before) return false;
  if (typeof render === 'function') render();
  if (typeof saveGame === 'function') saveGame({ immediate: true });
  return true;
}
function processLockerRoomMeetings(team) {
  if (!team || team.id !== G.playerTeamId) return [];
  const state = getLockerRoomState(team);
  const due = state.meetings.filter(item => item.status === 'scheduled' && item.scheduledRound <= G.league.currentRound);
  if (!due.length) return [];
  const completed = [];
  for (const meeting of due) {
    const player = team.roster.find(item => item.id === meeting.playerId);
    let result;
    if (!player) {
      result = { success: false, message: 'Встреча отменена: хоккеист больше не состоит в команде.' };
    } else {
      result = applyPlayerConversation(team, player, meeting.topic, 'scheduled');
      if (!result.success) result.message = 'Встреча не состоялась: ' + result.message;
    }
    meeting.status = result.success ? 'completed' : 'cancelled';
    meeting.result = result.message;
    meeting.completedRound = G.league.currentRound;
    const subject = result.success ? 'Личная встреча состоялась' : 'Личная встреча не состоялась';
    addInboxMessage('player', player?.name || meeting.playerName, subject, result.message, []);
    if (result.success) addNews('player_story', 'Состоялась личная встреча с ' + player.name, 1);
    completed.push(meeting);
  }
  state.meetingHistory.push(...completed);
  if (state.meetingHistory.length > 30) state.meetingHistory = state.meetingHistory.slice(-30);
  state.meetings = state.meetings.filter(item => item.status === 'scheduled');
  return completed;
}
function holdLockerRoomEvent(eventKey) {
  const team = getLockerRoomTeam();
  const definition = LOCKER_ROOM_TEAM_EVENTS[eventKey];
  if (!team || !definition) return { success: false, message: 'Мероприятие недоступно' };
  const state = getLockerRoomState(team);
  const remaining = definition.cooldown - (G.league.currentRound - state.lastTeamEventRound);
  if (remaining > 0) return { success: false, message: 'Командное мероприятие будет доступно через ' + remaining + ' тур.' };
  if (definition.requiresPsychologist && !team.staff?.psychologist) return { success: false, message: 'Для этой встречи нужен психолог команды' };
  if (team.finance.balance < definition.cost) return { success: false, message: 'Недостаточно средств. Нужно ' + definition.cost.toFixed(1) + ' млн ₽.' };
  if (!team.roster.length) return { success: false, message: 'В команде нет хоккеистов' };
  if (definition.cost > 0) {
    team.finance.balance = Math.round((team.finance.balance - definition.cost) * 10) / 10;
    team.finance.expenses.operations = (team.finance.expenses.operations || 0) + definition.cost;
  }
  let moraleDelta = 0, fatigueDelta = 0, formDelta = 0, body = '';
  if (eventKey === 'meeting') {
    moraleDelta = 2; body = 'Команда обсудила цели, роли и ближайшие задачи. Мораль +2.';
  } else if (eventKey === 'dinner') {
    moraleDelta = 3; fatigueDelta = -2; body = 'Игроки провели вечер вместе вне арены. Мораль +3, усталость -2.';
  } else if (eventKey === 'recovery') {
    moraleDelta = 1; fatigueDelta = -6; body = 'Команда получила дополнительное время на восстановление. Мораль +1, усталость -6.';
  } else if (eventKey === 'psychologist') {
    moraleDelta = 3; body = 'Психолог помог команде обсудить напряжение и наладить общение. Мораль +3.';
  } else if (eventKey === 'teambuilding') {
    moraleDelta = 4; formDelta = 1; body = 'Совместная активность укрепила командный дух. Мораль +4, форма +1.';
  }
  for (const player of team.roster) {
    player.morale = Math.max(20, Math.min(100, (Number(player.morale) || 65) + moraleDelta));
    player.fatigue = Math.max(0, Math.min(100, (Number(player.fatigue) || 0) + fatigueDelta));
    player.form = Math.max(30, Math.min(99, (Number(player.form) || 60) + formDelta));
  }
  state.lastTeamEventRound = G.league.currentRound;
  state.lastTeamEvent = { key: eventKey, round: G.league.currentRound, cost: definition.cost };
  state.eventHistory.push({ ...state.lastTeamEvent });
  if (state.eventHistory.length > 20) state.eventHistory = state.eventHistory.slice(-20);
  addNews('event', team.name + ': ' + definition.label, 1);
  addInboxMessage('coach', 'Тренерский штаб', definition.label, body + (definition.cost ? ' Расходы: ' + definition.cost.toFixed(1) + ' млн ₽.' : ''), []);
  if (typeof showToast === 'function') showToast(definition.label + ' проведено', 'success');
  if (typeof render === 'function') render();
  if (typeof saveGame === 'function') saveGame({ immediate: true });
  return { success: true, event: eventKey, cost: definition.cost, moraleDelta, fatigueDelta, formDelta };
}


/* ============================================================
   ИНИЦИАТИВА ИГРОКОВ: просьбы, конфликты и отложенные последствия
   ============================================================ */
const LOCKER_ROOM_REQUESTS = {
  playing_time: { title: 'Игрок просит больше игрового времени', choices: {
    give_chance: 'Пообещать шанс в ближайших матчах',
    explain: 'Объяснить конкуренцию за место',
    refuse: 'Отказать'
  }},
  support: { title: 'Игрок просит поддержки', choices: {
    support: 'Поддержать хоккеиста',
    ignore: 'Оставить вопрос без внимания'
  }},
  conflict: { title: 'Напряжение внутри команды', choices: {
    mediate: 'Провести общую беседу',
    separate: 'Развести игроков и поговорить отдельно'
  }},
  contract: { title: 'Игрок хочет обсудить новый контракт', choices: {
    negotiate: 'Начать переговоры о продлении',
    delay: 'Вернуться к вопросу позже'
  }},
  transfer: { title: 'Игрок просит отпустить его из клуба', choices: {
    seek_transfer: 'Разрешить искать новый клуб',
    convince: 'Попытаться убедить остаться'
  }}
};
function createLockerRoomRequest(team, type, player, otherPlayer = null) {
  const state = getLockerRoomState(team);
  if (state.requests.some(item => item.status === 'pending' && (item.playerId === player?.id || item.otherPlayerId === player?.id || item.playerId === otherPlayer?.id || item.otherPlayerId === otherPlayer?.id))) return null;
  const request = {
    id: nextId(), type, playerId: player?.id ?? null, playerName: player?.name ?? null,
    otherPlayerId: otherPlayer?.id ?? null, otherPlayerName: otherPlayer?.name ?? null,
    createdRound: G.league.currentRound, deadlineRound: G.league.currentRound + 3,
    status: 'pending'
  };
  state.requests.push(request);
  if (state.requests.length > 40) state.requests = state.requests.slice(-40);
  const definition = LOCKER_ROOM_REQUESTS[type];
  const body = type === 'playing_time'
    ? player.name + ' недоволен количеством игрового времени и просит обсудить свою роль.'
    : type === 'support'
      ? player.name + ' переживает из-за своей формы и морального состояния и просит поддержки.'
      : player.name + ' и ' + otherPlayer.name + ' испытывают напряжение в отношениях. Ситуация может повлиять на атмосферу в раздевалке.';
  addInboxMessage('player', player?.name || 'Команда', definition.title, body, []);
  addNews('player_story', body, 1);
  return request;
}
function processPlayerRelations(team) {
  if (!team || team.id !== G.playerTeamId) return [];
  const state = getLockerRoomState(team);
  const round = G.league.currentRound;
  const created = [];
  for (const request of state.requests) {
    if (request.status !== 'pending' || round < request.deadlineRound) continue;
    request.status = 'expired';
    request.resolvedRound = round;
    request.resolution = 'Игроки не получили ответа тренерского штаба.';
    const affected = [request.playerId, request.otherPlayerId].filter(Boolean);
    for (const id of affected) {
      const player = team.roster.find(item => item.id === id);
      if (player) player.morale = Math.max(20, (Number(player.morale) || 60) - 5);
    }
    addInboxMessage('player', request.playerName || 'Команда', 'Недовольство осталось нерешённым',
      request.resolution + ' Мораль участников снизилась на 5.', []);
    addNews('player_story', request.resolution, 1);
  }
  const pendingPlayers = new Set(state.requests.filter(item => item.status === 'pending').flatMap(item => [item.playerId, item.otherPlayerId]).filter(Boolean));
  const requestReady = player => !pendingPlayers.has(player.id) && round - (Number(player.lastLockerRoomRequestRound) || -100) >= 10;
  const transferCandidate = team.roster.find(player => requestReady(player) && (Number(player.morale) || 60) <= 25 && (team.bench || []).includes(player.id));
  if (transferCandidate) {
    const request = createLockerRoomRequest(team, 'transfer', transferCandidate);
    if (request) { transferCandidate.lastLockerRoomRequestRound = round; created.push(request); }
  }
  if (!created.length) {
    const contractCandidate = team.roster.find(player => requestReady(player) && Number(player.contract?.years) <= 1 && Number(player.contract?.years) >= 0);
    if (contractCandidate && rng() < 0.12) {
      const request = createLockerRoomRequest(team, 'contract', contractCandidate);
      if (request) { contractCandidate.lastLockerRoomRequestRound = round; created.push(request); }
    }
  }
  const bench = new Set(team.bench || []);
  const unhappy = team.roster.filter(player => !pendingPlayers.has(player.id) && round - (Number(player.lastLockerRoomRequestRound) || -100) >= 10 && bench.has(player.id) && (Number(player.morale) || 60) <= 58);
  if (unhappy.length && rng() < 0.28) {
    const player = unhappy.sort((a,b) => (a.morale||0)-(b.morale||0))[0];
    const request = createLockerRoomRequest(team, 'playing_time', player);
    if (request) { player.lastLockerRoomRequestRound = round; created.push(request); }
  }
  const distressed = team.roster.filter(player => !pendingPlayers.has(player.id) && round - (Number(player.lastLockerRoomRequestRound) || -100) >= 10 && (Number(player.morale) || 60) <= 34);
  if (!created.length && distressed.length && rng() < 0.18) {
    const player = distressed.sort((a,b) => (a.morale||0)-(b.morale||0))[0];
    const request = createLockerRoomRequest(team, 'support', player);
    if (request) { player.lastLockerRoomRequestRound = round; created.push(request); }
  }
  const leaders = team.roster.filter(player => player.character === 'leader' && !bench.has(player.id));
  const egoists = team.roster.filter(player => player.character === 'egoist' && !bench.has(player.id));
  const conflictReady = !state.lastConflictRound || round - state.lastConflictRound >= 12;
  if (!created.length && conflictReady && leaders.length && egoists.length && rng() < 0.025) {
    const request = createLockerRoomRequest(team, 'conflict', egoists[0], leaders[0]);
    if (request) { state.lastConflictRound = round; created.push(request); }
  }
  return created;
}
function resolveLockerRoomRequest(requestId, decision) {
  const team = getLockerRoomTeam();
  if (!team) return { success: false, message: 'Команда не найдена' };
  const state = getLockerRoomState(team);
  const request = state.requests.find(item => item.id === requestId && item.status === 'pending');
  if (!request) return { success: false, message: 'Обращение уже закрыто или не найдено' };
  const definition = LOCKER_ROOM_REQUESTS[request.type];
  if (!definition || !Object.prototype.hasOwnProperty.call(definition.choices, decision)) return { success: false, message: 'Неизвестное решение' };
  const player = team.roster.find(item => item.id === request.playerId);
  const other = team.roster.find(item => item.id === request.otherPlayerId);
  let message = '';
  const changeMorale = (target, delta) => { if (target) target.morale = Math.max(20, Math.min(100, (Number(target.morale) || 60) + delta)); };
  if (request.type === 'playing_time') {
    if (decision === 'give_chance') { changeMorale(player, 6); if (player) player.playingTimePromiseRound = G.league.currentRound + 3; message = 'Тренер пообещал дать хоккеисту шанс в ближайших матчах. Мораль +6.'; }
    else if (decision === 'explain') { changeMorale(player, 2); message = 'Тренер объяснил конкуренцию за место в составе. Игрок принял объяснение. Мораль +2.'; }
    else { changeMorale(player, -5); message = 'Тренер отказал в просьбе. Игрок разочарован. Мораль -5.'; }
  } else if (request.type === 'support') {
    if (decision === 'support') { changeMorale(player, 7); message = 'Тренер поддержал хоккеиста. Мораль +7.'; }
    else { changeMorale(player, -5); message = 'Игрок не получил ожидаемой поддержки. Мораль -5.'; }
  } else if (request.type === 'conflict') {
    if (decision === 'mediate') { changeMorale(player, 3); changeMorale(other, 3); message = 'Тренер провёл общую беседу. Напряжение снизилось, мораль обоих игроков +3.'; }
    else { changeMorale(player, 1); changeMorale(other, 1); message = 'Игроков развели по разным группам и провели отдельные разговоры. Мораль обоих +1.'; }
  } else if (request.type === 'contract') {
    if (decision === 'negotiate') {
      message = 'Тренер согласился обсудить новый контракт с ' + (player?.name || request.playerName) + '.';
      if (player && typeof openPlayerContractNegotiation === 'function') openPlayerContractNegotiation(player.id, 'renewal');
    } else { changeMorale(player, -2); message = 'Переговоры отложены. Игрок надеется вернуться к вопросу в ближайшее время. Мораль -2.'; }
  } else if (request.type === 'transfer') {
    if (decision === 'seek_transfer') {
      if (player) { player.transferRequest = true; player.transferListed = true; changeMorale(player, 2); }
      message = (player?.name || request.playerName) + ' получил разрешение искать новый клуб. Мораль +2.';
    } else { changeMorale(player, 3); message = 'Тренер поговорил с игроком и попытался убедить его остаться. Мораль +3.'; }
  }
  request.status = 'resolved';
  request.resolvedRound = G.league.currentRound;
  request.decision = decision;
  request.resolution = message;
  addInboxMessage('coach', 'Тренерский штаб', 'Решение по обращению игрока', message, []);
  addNews('player_story', message, 1);
  if (typeof showToast === 'function') showToast('Решение принято', 'success');
  if (typeof render === 'function') render();
  if (typeof saveGame === 'function') saveGame({ immediate: true });
  return { success: true, request, message };
}
