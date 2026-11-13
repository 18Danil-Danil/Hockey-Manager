/* Международный трансферный рынок.
   Зарубежные клубы и их составы хранятся в сохранении конкретной карьеры. */
function createInternationalMarket() {
  const clubs = [];
  const positions = ['C', 'LW', 'RW', 'C', 'LW', 'RW', 'D', 'D', 'D', 'D', 'G', 'G'];
  for (const league of window.INTERNATIONAL_LEAGUES || []) {
    for (const definition of league.clubs || []) {
      const club = {
        id: definition.id,
        name: definition.name,
        city: definition.city,
        region: league.region,
        country: league.country,
        countryCode: league.countryCode,
        leagueId: league.id,
        leagueName: league.leagueName,
        transferMultiplier: league.transferMultiplier || 1,
        salaryMultiplier: league.salaryMultiplier || 1,
        strength: definition.strength || 1,
        roster: []
      };
      for (const position of positions) {
        const base = randInt(league.minOvr, league.maxOvr);
        const targetOvr = clamp(Math.round(base + (club.strength - 1) * 5), league.minOvr, league.maxOvr + 2);
        const nationality = pick(league.nationalities || [league.country]);
        const player = genPlayer(position, targetOvr, { nationality, status: 'contract' });
        player.contract.salary = Math.max(0.5, Math.round(player.contract.salary * club.salaryMultiplier * 10) / 10);
        player.contract.years = randInt(1, 4);
        player.internationalClubId = club.id;
        player.internationalClubName = club.name;
        player.internationalLeague = club.leagueName;
        player.internationalRegion = club.region;
        player.internationalCountry = club.country;
        player.transferListed = rng() < 0.24;
        club.roster.push(player);
      }
      club.averageOvr = club.roster.reduce((sum, player) => sum + player.ovr, 0) / Math.max(1, club.roster.length);
      clubs.push(club);
    }
  }
  return { version: 1, clubs, transferLog: [] };
}
function ensureInternationalMarket() {
  if (!G.league) return;
  if (G.league.internationalMarket && G.league.internationalMarket.version === 1 &&
      Array.isArray(G.league.internationalMarket.clubs)) return;
  G.league.internationalMarket = createInternationalMarket();
}
function findInternationalPlayer(playerId) {
  const market = G.league?.internationalMarket;
  if (!market) return null;
  for (const club of market.clubs || []) {
    const player = club.roster.find(item => Number(item.id) === Number(playerId));
    if (player) return { player, club };
  }
  return null;
}
function getInternationalTransferPrice(player, club) {
  const ageFactor = player.age <= 23 ? 1.16 : player.age >= 31 ? 0.78 : 1;
  const potential = Math.max(0, (player.pot || player.ovr) - player.ovr);
  const keyPlayer = player.ovr >= (club.averageOvr || 70) + 7;
  const listedFactor = player.transferListed ? 0.78 : 1;
  const base = Math.max(0.8, (player.ovr - 58) * 0.16 + potential * 0.045);
  return Math.round(base * (club.transferMultiplier || 1) * ageFactor * listedFactor * (keyPlayer ? 1.35 : 1) * 10) / 10;
}
function getInternationalTransferQuote(player, club, team) {
  const price = getInternationalTransferPrice(player, club);
  const ageFactor = player.age <= 23 ? 0.55 : player.age >= 30 ? 0.9 : 1;
  const salaryBase = Math.pow(Math.max(0, player.ovr - 60) / 30, 2) * 22 * ageFactor;
  const salary = Math.max(player.contract?.salary || 0.5,
    Math.round(salaryBase * 0.82 * 10) / 10);
  const currentSalary = team ? team.roster.reduce((sum, item) => sum + (item.contract?.salary || 0), 0) : 0;
  const foreigners = team ? team.roster.filter(item => item.nationality !== 'Россия').length : 0;
  let reason = '';
  if (!team) reason = 'Сначала выбери клуб ВХЛ';
  else if (typeof isTradeDeadlinePassed === 'function' && isTradeDeadlinePassed()) reason = 'Трансферное окно закрыто после 40-го тура';
  else if (team.roster.length >= 25) reason = 'В составе уже 25 игроков';
  else if (player.nationality !== 'Россия' && foreigners >= 3) reason = 'Лимит легионеров (3) уже исчерпан';
  else if (currentSalary + salary > team.finance.salaryCap) reason = 'Не хватает места под потолком зарплат';
  else if (team.finance.balance < price) reason = 'Недостаточно средств для трансфера';
  return { price, salary, allowed: !reason, reason };
}
function buyInternationalPlayer(playerId) {
  const team = G.league?.teams.find(item => item.id === G.playerTeamId);
  const found = findInternationalPlayer(playerId);
  if (!team || !found) { showToast('Игрок или клуб не найден'); return false; }
  const { player, club } = found;
  const quote = getInternationalTransferQuote(player, club, team);
  if (!quote.allowed) { showToast(quote.reason, 'error'); return false; }
  const index = club.roster.indexOf(player);
  if (index < 0) return false;
  club.roster.splice(index, 1);
  player.originClub = club.name;
  player.originLeague = club.leagueName;
  player.originCountry = club.country;
  player.internationalClubId = null;
  player.status = 'contract';
  player.contract.salary = quote.salary;
  player.contract.years = Math.max(1, player.contract.years || 1);
  team.finance.balance = Math.round((team.finance.balance - quote.price) * 10) / 10;
  team.finance.expenses.transfers = (team.finance.expenses.transfers || 0) + quote.price;
  team.roster.push(player);
  team.lines = null;
  syncLines(team);
  G.league.internationalMarket.transferLog.push({
    season: G.league.season, playerId: player.id, playerName: player.name,
    fromClub: club.name, toClub: team.name, fee: quote.price
  });
  addNews('signing', team.name + ' приобрёл ' + player.name + ' из клуба ' + club.name, 2);
  showToast(player.name + ' перешёл в ' + team.name + ' за ' + quote.price.toFixed(1) + ' млн ₽', 'success');
  render();
  saveGame({ immediate: true });
  return true;
}
