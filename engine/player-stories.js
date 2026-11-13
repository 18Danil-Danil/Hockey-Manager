function getPlayerStoryFlags(player) {
  if (!G.league.playerStoryFlags) G.league.playerStoryFlags = {};
  const key = String(player.id);
  let entry = G.league.playerStoryFlags[key];
  if (!entry || entry.season !== G.league.season) entry = G.league.playerStoryFlags[key] = { season: G.league.season, flags: [] };
  if (!Array.isArray(entry.flags)) entry.flags = [];
  return entry;
}
function generatePlayerStories() {
  if (!G.league) return;
  const candidates = [];
  for (const team of G.league.teams) for (const player of team.roster || []) {
    const flags = getPlayerStoryFlags(player);
    const mark = (key, priority, type, text, body) => { if (!flags.flags.includes(key)) candidates.push({ team, flags, key, priority, type, text, body }); };
    const stats = player.stats || {}, career = player.careerStats || {};
    const gp = stats.gp || 0, points = stats.points || 0;
    const careerPoints = (career.points || 0) + points, careerGoals = (career.goals || 0) + (stats.goals || 0), careerWins = (career.wins || 0) + (stats.wins || 0);
    if (player.injury && player.injury.gamesLeft > 0) { if (!flags.flags.includes('currently_injured')) flags.flags.push('currently_injured'); }
    else if (flags.flags.includes('currently_injured') && !flags.flags.includes('comeback')) mark('comeback',5,'player_story',player.name+' вернулся после травмы','Хоккеист восстановился и снова готов помогать команде.');
    if (player.age <= 22 && gp >= 12 && points >= 12 && player.ovr >= 68) mark('breakout',4,'player_story','Прорыв молодого игрока: '+player.name,'Молодой хоккеист уверенно проявляет себя на уровне лиги: '+points+' очков в '+gp+' матчах.');
    if (player.position !== 'G' && careerPoints >= 100 && (career.points || 0) < 100) mark('career_100_points',5,'milestone',player.name+' набрал 100 очков за карьеру','Хоккеист достиг отметки в 100 очков за карьеру. Общий результат: '+careerPoints+'.');
    if (player.position !== 'G' && careerGoals >= 50 && (career.goals || 0) < 50) mark('career_50_goals',4,'milestone',player.name+' забросил 50 шайб за карьеру','Юбилейная отметка в 50 голов в официальных матчах.');
    if (player.position === 'G' && gp >= 10 && stats.shotsAgainst >= 100 && stats.saves / stats.shotsAgainst >= .9) mark('goalie_hot_season',3,'player_story','Вратарь в ударе: '+player.name,'Надёжная игра голкипера: '+Math.round(stats.saves/stats.shotsAgainst*1000)/10+'% отражённых бросков.');
    if (player.position !== 'G' && player.age >= 32 && gp >= 10 && points >= 15) mark('veteran_leader',2,'player_story','Ветеран ведёт команду за собой: '+player.name,'Опытный хоккеист остаётся одним из лидеров команды — '+points+' очков в сезоне.');
    if (player.form >= 92 && gp >= 8 && points >= 8) mark('hot_form',1,'player_story',player.name+' набрал отличную форму','Хоккеист поймал игровой ритм и стабильно приносит пользу команде.');
    if (player.form <= 42 && gp >= 10 && player.morale <= 55) mark('slump',1,'player_story',player.name+' переживает непростой отрезок','Последние матчи складываются тяжело. Тренерский штаб может уделить игроку дополнительное внимание.');
    if (player.position === 'G' && careerWins >= 50 && (career.wins || 0) < 50) mark('goalie_50_wins',4,'milestone',player.name+' одержал 50 побед за карьеру','Голкипер достиг отметки в 50 побед в регулярных чемпионатах.');
  }
  candidates.sort((a,b)=>b.priority-a.priority);
  for (const item of candidates.slice(0,3)) {
    item.flags.flags.push(item.key); addNews(item.type,item.text,item.priority>=4?3:2);
    if (item.team.id === G.playerTeamId) addInboxMessage('coach','Тренерский штаб',item.text,item.body,[]);
  }
}
