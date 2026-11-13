/* Международный трансферный рынок с реальными ростерами Казахстана и Беларуси. */
function getInternationalRatingIndex() {
  const data = window.INTERNATIONAL_PLAYER_STATS_DATA;
  if (!data || !Array.isArray(data.players)) return new Map();
  if (window._INTERNATIONAL_RATING_CACHE?.source === data) return window._INTERNATIONAL_RATING_CACHE.index;
  const index = new Map();
  const leagues = [...new Set(data.players.map(player => player.league))];
  const percentile = (rows, valueOf, value, inverse = false) => {
    const values = rows.map(valueOf).filter(Number.isFinite).sort((a,b)=>a-b);
    if (!values.length) return 0.5;
    let below = 0, equal = 0;
    for (const item of values) { if (item < value) below++; else if (item === value) equal++; }
    const rank = (below + Math.max(0,equal-1)/2) / Math.max(1,values.length-1);
    return inverse ? 1-rank : rank;
  };
  for (const league of leagues) {
    const rows = data.players.filter(player => player.league === league);
    for (const player of rows) {
      const sameRole = rows.filter(item => (item.position === 'G') === (player.position === 'G') &&
        (item.position === 'G' || (item.position === 'D') === (player.position === 'D')));
      const gp = Math.max(1, player.gp || 0);
      const sample = Math.min(1, gp / 20);
      let attrs, rating;
      if (player.position === 'G') {
        const sv = Number(player.svPct);
        const gaa = Number(player.gaa);
        const winRate = (player.w || 0) / gp;
        const svRank = percentile(sameRole, item => Number(item.svPct), sv);
        const gaaRank = percentile(sameRole, item => Number(item.gaa), gaa, true);
        const winRank = percentile(sameRole, item => (item.w || 0) / Math.max(1,item.gp || 0), winRate);
        const workload = Math.min(1, gp / 22);
        attrs = {
          reflexes: Math.round(64 + svRank * 18 * (0.55 + sample * 0.45)),
          positioning: Math.round(63 + gaaRank * 18 * (0.55 + sample * 0.45)),
          glove: Math.round(63 + svRank * 17 * (0.55 + sample * 0.45)),
          stick: Math.round(62 + (svRank * 0.65 + gaaRank * 0.35) * 17),
          iq: Math.round(62 + (gaaRank * 0.45 + winRank * 0.35 + workload * 0.2) * 17)
        };
        rating = overallFromAttrs(attrs, true);
      } else {
        const ppg = (player.g + player.a) / gp;
        const gpg = player.g / gp;
        const apg = player.a / gp;
        const pmRate = (player.pm || 0) / gp;
        const pimRate = (player.pim || 0) / gp;
        const ppgRank = percentile(sameRole, item => ((item.g || 0)+(item.a || 0))/Math.max(1,item.gp || 0), ppg);
        const goalRank = percentile(sameRole, item => (item.g || 0)/Math.max(1,item.gp || 0), gpg);
        const assistRank = percentile(sameRole, item => (item.a || 0)/Math.max(1,item.gp || 0), apg);
        const plusRank = percentile(sameRole, item => (item.pm || 0)/Math.max(1,item.gp || 0), pmRate);
        const penaltyRank = percentile(sameRole, item => (item.pim || 0)/Math.max(1,item.gp || 0), pimRate);
        const confidence = 0.55 + sample * 0.45;
        if (player.position === 'D') {
          attrs = {
            skating: Math.round(63 + (ppgRank * 0.55 + plusRank * 0.45) * 17 * confidence),
            shooting: Math.round(62 + (goalRank * 0.7 + ppgRank * 0.3) * 17 * confidence),
            passing: Math.round(63 + (assistRank * 0.65 + ppgRank * 0.35) * 17 * confidence),
            defense: Math.round(64 + (plusRank * 0.72 + ppgRank * 0.18 + (1-penaltyRank) * 0.10) * 17 * confidence),
            physical: Math.round(62 + (penaltyRank * 0.35 + plusRank * 0.35 + sample * 0.30) * 16),
            iq: Math.round(63 + (plusRank * 0.45 + assistRank * 0.35 + sample * 0.20) * 17)
          };
        } else {
          attrs = {
            skating: Math.round(63 + (ppgRank * 0.6 + plusRank * 0.4) * 17 * confidence),
            shooting: Math.round(62 + (goalRank * 0.72 + ppgRank * 0.28) * 18 * confidence),
            passing: Math.round(62 + (assistRank * 0.65 + ppgRank * 0.35) * 18 * confidence),
            defense: Math.round(61 + (plusRank * 0.55 + sample * 0.25 + (1-penaltyRank) * 0.20) * 16),
            physical: Math.round(62 + (penaltyRank * 0.35 + plusRank * 0.25 + sample * 0.40) * 16),
            iq: Math.round(62 + (ppgRank * 0.35 + assistRank * 0.30 + plusRank * 0.25 + sample * 0.10) * 17)
          };
        }
        rating = overallFromAttrs(attrs, false);
      }
      const leagueAdjustment = league === 'khl' ? 5 : league === 'kazakhstan' ? -1 : 0;
      rating = clamp(Math.round(rating + leagueAdjustment), 62, league === 'khl' ? 90 : 84);
      index.set(player.key, {attrs, ovr:rating, sampleGames:gp, stats:player});
    }
  }
  window._INTERNATIONAL_RATING_CACHE = {source:data,index};
  return index;
}
function createInternationalMarket() {
  const clubs = [];
  const positions = ['C','LW','RW','C','LW','RW','D','D','D','D','G','G'];
  const ratingIndex = getInternationalRatingIndex();
  for (const league of window.INTERNATIONAL_LEAGUES || []) {
    for (const definition of league.clubs || []) {
      const club = {
        id:definition.id,name:definition.name,city:definition.city,region:league.region,
        country:league.country,countryCode:league.countryCode,leagueId:league.id,
        leagueName:league.leagueName,transferMultiplier:league.transferMultiplier || 1,
        salaryMultiplier:league.salaryMultiplier || 1,strength:definition.strength || 1,roster:[]
      };
      const realPlayers = (window.INTERNATIONAL_PLAYER_STATS_DATA?.players || [])
        .filter(player => player.league === league.id && player.club === definition.id);
      for (const record of realPlayers) {
        const rating = ratingIndex.get(record.key);
        const position = record.position === 'G' ? 'G' : record.position === 'D' ? 'D' :
          ['C','LW','RW'].includes(record.position) ? record.position : 'C';
        const player = genPlayer(position, rating?.ovr || league.minOvr, {
          nationality:record.nationality || league.country, status:'contract'
        });
        player.name = record.name;
        player.nationality = record.nationality || league.country;
        player.ovr = rating?.ovr || player.ovr;
        if (rating?.attrs) player.attrs = {...rating.attrs};
        const ageBonus = player.age <= 21 ? 12 : player.age <= 23 ? 8 : player.age <= 26 ? 4 : player.age <= 29 ? 2 : 0;
        player.attrPot = Object.fromEntries(Object.entries(player.attrs).map(([key,value])=>[key,clamp(value+ageBonus,40,99)]));
        player.pot = overallFromAttrs(player.attrPot, position === 'G');
        player.internationalRealPlayer = true;
        player.internationalStats = {...record, season:window.INTERNATIONAL_PLAYER_STATS_DATA.season};
        player.internationalSource = window.INTERNATIONAL_PLAYER_STATS_DATA.source;
        player.contract.salary = Math.max(0.5, Math.round(player.contract.salary * club.salaryMultiplier * 10) / 10);
        player.internationalClubId = club.id;
        player.internationalClubName = club.name;
        player.internationalLeague = club.leagueName;
        player.internationalRegion = club.region;
        player.internationalCountry = club.country;
        player.transferListed = rng() < 0.18;
        club.roster.push(player);
      }
      let fillIndex = 0;
      while (club.roster.length < positions.length) {
        const position = positions[fillIndex % positions.length];
        fillIndex++;
        const base = randInt(league.minOvr, league.maxOvr);
        const targetOvr = clamp(Math.round(base + (club.strength - 1) * 5),league.minOvr,league.maxOvr+2);
        const nationality = pick(league.nationalities || [league.country]);
        const player = genPlayer(position,targetOvr,{nationality,status:'contract'});
        player.contract.salary = Math.max(0.5,Math.round(player.contract.salary*club.salaryMultiplier*10)/10);
        player.contract.years = randInt(1,4);
        player.internationalClubId=club.id;
        player.internationalClubName=club.name;
        player.internationalLeague=club.leagueName;
        player.internationalRegion=club.region;
        player.internationalCountry=club.country;
        player.transferListed=rng()<0.24;
        club.roster.push(player);
      }
      club.averageOvr=club.roster.reduce((sum,player)=>sum+player.ovr,0)/Math.max(1,club.roster.length);
      clubs.push(club);
    }
  }
  return {version:4,clubs,transferLog:[]};
}
function ensureInternationalMarket() {
  if (!G.league) return;
  const previous = G.league.internationalMarket;
  if (previous && previous.version >= 4 && Array.isArray(previous.clubs)) return;
  const rebuilt = createInternationalMarket();
  if (previous && Array.isArray(previous.transferLog)) {
    rebuilt.transferLog = previous.transferLog.slice();
    const signedNames = new Set(previous.transferLog.map(item => String(item.playerName || '').trim().toLocaleLowerCase()).filter(Boolean));
    for (const club of rebuilt.clubs) {
      club.roster = club.roster.filter(player => !signedNames.has(String(player.name || '').trim().toLocaleLowerCase()));
      club.averageOvr = club.roster.reduce((sum, player) => sum + player.ovr, 0) / Math.max(1, club.roster.length);
    }
  }
  G.league.internationalMarket = rebuilt;
}
function findInternationalPlayer(playerId) {
  const market=G.league?.internationalMarket;
  if(!market) return null;
  for(const club of market.clubs||[]){
    const player=club.roster.find(item=>Number(item.id)===Number(playerId));
    if(player) return {player,club};
  }
  return null;
}
function getInternationalTransferPrice(player,club) {
  const ageFactor=player.age<=23?1.16:player.age>=31?0.78:1;
  const potential=Math.max(0,(player.pot||player.ovr)-player.ovr);
  const keyPlayer=player.ovr>=(club.averageOvr||70)+7;
  const listedFactor=player.transferListed?0.78:1;
  const base=Math.max(0.8,(player.ovr-58)*0.16+potential*0.045);
  return Math.round(base*(club.transferMultiplier||1)*ageFactor*listedFactor*(keyPlayer?1.35:1)*10)/10;
}
function getInternationalTransferQuote(player,club,team) {
  const price=getInternationalTransferPrice(player,club);
  const ageFactor=player.age<=23?0.55:player.age>=30?0.9:1;
  const salaryBase=Math.pow(Math.max(0,player.ovr-60)/30,2)*22*ageFactor;
  const salary=Math.max(player.contract?.salary||0.5,Math.round(salaryBase*0.82*10)/10);
  const currentSalary=team?team.roster.reduce((sum,item)=>sum+(item.contract?.salary||0),0):0;
  const foreigners=team?team.roster.filter(item=>item.nationality!=='Россия').length:0;
  let reason='';
  if(!team) reason='Сначала выбери клуб ВХЛ';
  else if(typeof isTradeDeadlinePassed==='function'&&isTradeDeadlinePassed()) reason='Трансферное окно закрыто после 40-го тура';
  else if(team.roster.length>=25) reason='В составе уже 25 игроков';
  else if(player.nationality!=='Россия'&&foreigners>=3) reason='Лимит легионеров (3) уже исчерпан';
  else if(currentSalary+salary>team.finance.salaryCap) reason='Не хватает места под потолком зарплат';
  else if(team.finance.balance<price) reason='Недостаточно средств для трансфера';
  return {price,salary,allowed:!reason,reason};
}
function buyInternationalPlayer(playerId) {
  const team=G.league?.teams.find(item=>item.id===G.playerTeamId);
  const found=findInternationalPlayer(playerId);
  if(!team||!found){showToast('Игрок или клуб не найден');return false;}
  const {player,club}=found;
  const quote=getInternationalTransferQuote(player,club,team);
  if(!quote.allowed){showToast(quote.reason,'error');return false;}
  const index=club.roster.indexOf(player);
  if(index<0)return false;
  club.roster.splice(index,1);
  player.originClub=club.name;
  player.originLeague=club.leagueName;
  player.originCountry=club.country;
  player.internationalClubId=null;
  player.status='contract';
  player.contract.salary=quote.salary;
  player.contract.years=Math.max(1,player.contract.years||1);
  team.finance.balance=Math.round((team.finance.balance-quote.price)*10)/10;
  team.finance.expenses.transfers=(team.finance.expenses.transfers||0)+quote.price;
  team.roster.push(player);
  team.lines=null;
  syncLines(team);
  G.league.internationalMarket.transferLog.push({
    season:G.league.season,playerId:player.id,playerName:player.name,
    fromClub:club.name,toClub:team.name,fee:quote.price
  });
  addNews('signing',team.name+' приобрёл '+player.name+' из клуба '+club.name,2);
  showToast(player.name+' перешёл в '+team.name+' за '+quote.price.toFixed(1)+' млн ₽','success');
  render();
  saveGame({immediate:true});
  return true;
}
