/* ============================================================
   СЛУЧАЙНЫЕ СОБЫТИЯ
   ============================================================ */
function createRandomEvent(key, weight, apply) {
  return { key, weight, apply, applyAI: apply };
}

const RANDOM_EVENTS = [
  { key: 'fans', weight: 2, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.02, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale + 2, 20, 100); return { title: 'Встреча с болельщиками', body: 'Фанбаза +2%, мораль +2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.02, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale + 2, 20, 100); } },
  { key: 'scandal', weight: 1, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase - 0.03, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale - 2, 20, 100); return { title: 'Медиа-скандал', body: 'Фанбаза -3%, мораль -2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase - 0.03, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale - 2, 20, 100); } },
  { key: 'charity', weight: 1, apply: (team) => { if (team.finance.balance < 2) return null; team.finance.balance -= 2; team.finance.expenses.operations += 2; team.finance.fanBase = clamp(team.finance.fanBase + 0.03, 0.15, 1.0); return { title: 'Благотворительность', body: '-2 млн ₽, фанбаза +3%.' }; }, applyAI: (team) => { if (team.finance.balance < 2) return; team.finance.balance -= 2; team.finance.fanBase = clamp(team.finance.fanBase + 0.03, 0.15, 1.0); } },
  { key: 'training_camp', weight: 2, apply: (team) => { for (const p of team.roster) p.form = clamp(p.form + 5, 30, 99); return { title: 'Тренировочный сбор', body: 'Форма +5.' }; }, applyAI: (team) => { for (const p of team.roster) p.form = clamp(p.form + 5, 30, 99); } },
  { key: 'conflict', weight: 1, apply: (team) => { const hasPsy = !!team.staff.psychologist; if (hasPsy && rng() < 0.7) return { title: 'Конфликт погашен психологом', body: 'Психолог сгладил конфликт.' }; const targets = team.roster.slice().sort(() => rng() - 0.5).slice(0, 2); for (const p of targets) p.morale = clamp(p.morale - 3, 20, 100); return { title: 'Конфликт в раздевалке', body: `${targets.map(p => p.name).join(', ')}. Мораль -3.` }; }, applyAI: (team) => { const hasPsy = !!team.staff.psychologist; if (hasPsy && rng() < 0.7) return; const targets = team.roster.slice().sort(() => rng() - 0.5).slice(0, 2); for (const p of targets) p.morale = clamp(p.morale - 3, 20, 100); } },
  { key: 'personal_joy', weight: 1, apply: (team) => { if (!team.roster.length) return null; const p = pick(team.roster); p.morale = clamp(p.morale + 3, 20, 100); return { title: 'Радостное событие', body: `У ${p.name} радостное событие. Мораль +3.` }; }, applyAI: (team) => { if (!team.roster.length) return; const p = pick(team.roster); p.morale = clamp(p.morale + 3, 20, 100); } },
  { key: 'family_problem', weight: 1, apply: (team) => { if (!team.roster.length) return null; const p = pick(team.roster); p.morale = clamp(p.morale - 3, 20, 100); return { title: 'Семейные проблемы', body: `У ${p.name} семейные проблемы. Мораль -3.` }; }, applyAI: (team) => { if (!team.roster.length) return; const p = pick(team.roster); p.morale = clamp(p.morale - 3, 20, 100); } },
  { key: 'sponsor_bonus', weight: 1, apply: (team) => { if (team.finance.balance <= 0) return null; team.finance.balance += 2; team.finance.income.sponsorBonuses += 2; return { title: 'Спонсорский бонус', body: '+2 млн ₽.' }; }, applyAI: (team) => { if (team.finance.balance <= 0) return; team.finance.balance += 2; } },
  { key: 'open_training', weight: 2, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0); for (const p of team.roster) p.form = clamp(p.form + 2, 30, 99); return { title: 'Открытая тренировка', body: 'Фанбаза +1%, форма +2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0); for (const p of team.roster) p.form = clamp(p.form + 2, 30, 99); } },

  createRandomEvent('team_meeting', 2, (team) => {
    for (const p of team.roster) p.morale = clamp(p.morale + 2, 20, 100);
    return { title: 'Командное собрание', body: 'Игроки обсудили цели и задачи. Мораль команды +2.' };
  }),
  createRandomEvent('team_dinner', 1, (team) => {
    if (team.finance.balance < 1) return null;
    team.finance.balance -= 1; team.finance.expenses.operations += 1;
    for (const p of team.roster) p.morale = clamp(p.morale + 3, 20, 100);
    return { title: 'Командный ужин', body: 'Совместный вечер помог сплотить коллектив. -1 млн ₽, мораль +3.' };
  }),
  createRandomEvent('community_day', 1, (team) => {
    if (team.finance.balance < 1.5) return null;
    team.finance.balance -= 1.5; team.finance.expenses.operations += 1.5;
    team.finance.fanBase = clamp(team.finance.fanBase + 0.025, 0.15, 1.0);
    return { title: 'День клуба в городе', body: 'Игроки встретились с болельщиками и местными жителями. -1,5 млн ₽, фанбаза +2,5%.' };
  }),
  createRandomEvent('video_analysis', 2, (team) => {
    for (const p of team.roster) p.form = clamp(p.form + 3, 30, 99);
    return { title: 'Видеоразбор матчей', body: 'Тренерский штаб разобрал ошибки и удачные эпизоды. Форма игроков +3.' };
  }),
  createRandomEvent('recovery_day', 2, (team) => {
    for (const p of team.roster) p.fatigue = clamp(p.fatigue - 6, 0, 100);
    return { title: 'Дополнительный день восстановления', body: 'Команда получила время на отдых. Усталость игроков снижена на 6.' };
  }),
  createRandomEvent('media_day', 1, (team) => {
    team.finance.fanBase = clamp(team.finance.fanBase + 0.02, 0.15, 1.0);
    for (const p of team.roster) p.morale = clamp(p.morale + 1, 20, 100);
    return { title: 'Медиадень клуба', body: 'Интервью и общение с прессой привлекли внимание к команде. Фанбаза +2%, мораль +1.' };
  }),
  createRandomEvent('sponsor_activation', 1, (team) => {
    team.finance.balance += 1.5; team.finance.income.sponsorBonuses += 1.5;
    team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0);
    return { title: 'Совместная акция со спонсором', body: 'Партнёрская кампания принесла клубу +1,5 млн ₽ и увеличила фанбазу на 1%.' };
  }),
  createRandomEvent('equipment_delivery', 1, (team) => {
    if (team.finance.balance < 2) return null;
    team.finance.balance -= 2; team.finance.expenses.operations += 2;
    for (const p of team.roster) p.form = clamp(p.form + 2, 30, 99);
    return { title: 'Обновление экипировки', body: 'Клуб закупил дополнительное тренировочное оборудование. -2 млн ₽, форма +2.' };
  }),
  createRandomEvent('youth_showcase', 1, (team) => {
    team.finance.fanBase = clamp(team.finance.fanBase + 0.015, 0.15, 1.0);
    for (const p of team.roster) if (p.age <= 22) p.morale = clamp(p.morale + 3, 20, 100);
    return { title: 'День молодёжного хоккея', body: 'Молодые игроки получили внимание болельщиков. Фанбаза +1,5%, мораль молодых хоккеистов +3.' };
  }),
];
function generateRandomEvent() {
  if (!G.league) return;
  const evt = pickWeighted(RANDOM_EVENTS, e => e.weight);
  if (!evt) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const isPlayerTeam = !!myTeam && rng() < 0.5;
  const team = isPlayerTeam ? myTeam : pick(G.league.teams.filter(t => t.id !== G.playerTeamId));
  if (!team) return;
  const result = evt.apply(team);
  if (!result) return;
  addNews('event', team.name + ': ' + result.title, 1);
  if (isPlayerTeam) addInboxMessage('coach', 'Тренер', '📰 ' + result.title, result.body, []);
}

/* Выводим в ленту только наиболее заметные результаты игрового дня.
   Все заголовки строятся по фактическим счетам симуляции. */
function generateLeagueMatchNews(results) {
  if (!Array.isArray(results) || !results.length) return;
  const highlights = [];
  for (const result of results) {
    const home = G.league.teams.find(team => team.id === result.homeId);
    const away = G.league.teams.find(team => team.id === result.awayId);
    if (!home || !away) continue;
    const total = result.hg + result.ag;
    const margin = Math.abs(result.hg - result.ag);
    let item = null;
    if (result.hg === 0 || result.ag === 0) {
      const winner = result.hg > result.ag ? home : away;
      const loser = result.hg > result.ag ? away : home;
      item = { priority: 4, type: 'shutout', importance: 3, text: winner.name + ' всухую обыграл ' + loser.name + ' (' + Math.max(result.hg, result.ag) + ':0)' };
    } else if (total >= 9) {
      item = { priority: 3, type: 'high_scoring', importance: 2, text: 'Результативная перестрелка: ' + away.name + ' — ' + home.name + ' (' + result.ag + ':' + result.hg + ')' };
    } else if (margin >= 5) {
      const winner = result.hg > result.ag ? home : away;
      const loser = result.hg > result.ag ? away : home;
      item = { priority: 2, type: 'blowout', importance: 2, text: winner.name + ' уверенно обыграл ' + loser.name + ' со счётом ' + Math.max(result.hg, result.ag) + ':' + Math.min(result.hg, result.ag) };
    } else if (result.ot) {
      const winner = result.hg > result.ag ? home : away;
      const loser = result.hg > result.ag ? away : home;
      item = { priority: 1, type: 'overtime', importance: 2, text: winner.name + ' вырвал победу у ' + loser.name + ' в овертайме (' + result.ag + ':' + result.hg + ')' };
    }
    if (item) highlights.push(item);
  }
  highlights.sort((a, b) => b.priority - a.priority);
  for (const item of highlights.slice(0, 2)) addNews(item.type, item.text, item.importance);
}
