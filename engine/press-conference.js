/* ============================================================
   ПРЕСС-КОНФЕРЕНЦИЯ
   ============================================================ */
function generatePressConference() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const questions = [];
  if (team.streak && team.streak.type === 'l' && team.streak.count >= 2) {
    questions.push({ q: `Команда проигрывает ${team.streak.count} матчей подряд. Как объясните?`,
      answers: [{ label: 'Работаем дальше, не ищем оправданий', morale: 2, fanbase: 0 }, { label: 'Соперники были сильнее', morale: 0, fanbase: -0.01 }, { label: 'Судьи и обстоятельства не в нашу пользу', morale: -2, fanbase: -0.03 }] });
  } else if (team.streak && team.streak.type === 'w' && team.streak.count >= 3) {
    questions.push({ q: `${team.streak.count} побед подряд — в чём секрет?`,
      answers: [{ label: 'Каждый вносит вклад, работаем на максимум', morale: 3, fanbase: 0.02 }, { label: 'Пока рано делать выводы', morale: 0, fanbase: 0 }, { label: 'Соперники попались слабые', morale: -2, fanbase: -0.03 }] });
  } else {
    questions.push({ q: 'Как оцените форму команды?',
      answers: [{ label: 'Идём правильным курсом', morale: 2, fanbase: 0.01 }, { label: 'Есть над чем работать', morale: 0, fanbase: 0 }, { label: 'Разочарован результатом', morale: -1, fanbase: -0.01 }] });
  }
  const stars = team.roster.filter(p => p.ovr >= 78).sort((a, b) => b.ovr - a.ovr).slice(0, 1);
  if (stars.length) {
    questions.push({ q: `Что скажете об игре ${stars[0].name}?`,
      answers: [{ label: 'Полностью доверяю', morale: 2, fanbase: 0.01 }, { label: 'Может больше', morale: 0, fanbase: 0 }, { label: 'Жду большего', morale: -2, fanbase: 0 }] });
  } else {
    questions.push({ q: 'Кто из игроков вас удивил?',
      answers: [{ label: 'Молодёжь прогрессирует', morale: 2, fanbase: 0.01 }, { label: 'Все играют как умеют', morale: 0, fanbase: 0 }, { label: 'Пока никто', morale: -2, fanbase: 0 }] });
  }
  questions.push({ q: 'Где видите команду по итогам сезона?',
    answers: [{ label: 'Боремся за плей-офф', morale: 2, fanbase: 0.01 }, { label: 'Работаем от матча к матчу', morale: 0, fanbase: 0 }, { label: 'Целимся в Кубок Петрова', morale: 3, fanbase: 0.02 }] });
  return { questions, current: 0 };
}
function answerPressQuestion(qIdx, aIdx) {
  const pc = G.pressConference; if (!pc) return;
  const q = pc.questions[qIdx]; const a = q.answers[aIdx];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  for (const p of team.roster) p.morale = clamp(p.morale + a.morale, 20, 100);
  team.finance.fanBase = clamp(team.finance.fanBase + a.fanbase, 0.15, 1.0);
  pc.current++;
  if (pc.current >= pc.questions.length) { G.pressConference = null; render(); } else render();
}
function maybeStartPressConference() {
  if (!G.playerTeamId) return;
  if (G.league.currentRound === 0) return;
  if (G.league.currentRound % 10 !== 0) return;
  if (G.league.currentRound >= G.league.schedule.length) return;
  G.pressConference = generatePressConference();
}
