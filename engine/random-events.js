/* ============================================================
   СЛУЧАЙНЫЕ СОБЫТИЯ
   ============================================================ */
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
];
function generateRandomEvent() {
  if (!G.league) return;
  const evt = pickWeighted(RANDOM_EVENTS, e => e.weight); if (!evt) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  if (myTeam && rng() < 0.5) {
    const result = evt.apply(myTeam);
    if (result) { addInboxMessage('coach', 'Тренер', `📰 ${result.title}`, result.body, []); addNews('event', `${myTeam.name}: ${result.title}`, 1); }
  } else {
    const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId); if (!aiTeams.length) return;
    const aiTeam = pick(aiTeams); evt.applyAI(aiTeam);
    addNews('event', `${aiTeam.name}: событие (${evt.key})`, 1);
  }
}
