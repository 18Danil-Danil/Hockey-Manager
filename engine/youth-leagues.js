/* ============================================================
   МОЛОДЁЖНЫЕ ЛИГИ: базовая модель и стартовые составы
   МХЛ — Молодёжный чемпионат; РХЛ — Молодёжное первенство.
   Возрастной диапазон пока вынесен в конфигурацию, чтобы его
   можно было скорректировать без переписывания логики.
   ============================================================ */
const YOUTH_RULES = {
  minAge: 15,
  maxAge: 20,
  promotionPlaces: 2,
  relegationPlaces: 2,
  rosterSize: 20,
  mhlOvrMin: 52,
  mhlOvrMax: 66,
  rhlOvrMin: 46,
  rhlOvrMax: 60,
};

function createYouthPlayer(position, leagueId) {
  const isGoalie = position === 'G';
  const minOvr = leagueId === 'MHL' ? YOUTH_RULES.mhlOvrMin : YOUTH_RULES.rhlOvrMin;
  const maxOvr = leagueId === 'MHL' ? YOUTH_RULES.mhlOvrMax : YOUTH_RULES.rhlOvrMax;
  const player = genPlayer(position, randInt(minOvr, maxOvr), { status: 'youth' });
  player.age = randInt(YOUTH_RULES.minAge, YOUTH_RULES.maxAge);
  player.attrPot = generateAttrPot(player.attrs, player.age, isGoalie);
  player.pot = overallFromAttrs(player.attrPot, isGoalie);
  player.contract = contractFor(player.ovr, player.age);
  player.status = 'youth';
  player.youth = {
    joinedSeason: 1,
    development: 'normal',
    graduated: false,
    signedBySeniorClubId: null,
  };
  return player;
}

function createYouthRoster(leagueId) {
  const positions = ['G', 'G', 'G', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'C', 'LW', 'LW', 'LW', 'RW', 'RW', 'RW', 'C'];
  return positions.map(position => createYouthPlayer(position, leagueId));
}

function createYouthTeam(meta) {
  const organization = window.YOUTH_CLUBS.organizations.find(item => item.id === meta.org);
  return {
    id: meta.id,
    name: meta.name,
    leagueId: meta.league,
    organizationId: meta.org,
    organizationName: organization ? organization.name : meta.name,
    independent: organization ? organization.independent : true,
    seniorLinks: [...(meta.senior || [])],
    roster: createYouthRoster(meta.league),
    coach: null,
    budget: { source: organization && organization.independent ? 'independent' : 'club-system', balance: 0 },
    record: { gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    stats: { goals: [], goalies: [] },
    history: [],
    standing: null,
  };
}

function createYouthCompetition(leagueId, teams) {
  return {
    id: leagueId,
    name: leagueId === 'MHL' ? 'Молодёжный чемпионат' : 'Молодёжное первенство',
    teams,
    schedule: makeSchedule(teams),
    currentRound: 0,
    results: [],
    table: [],
    history: [],
    championId: null,
    topScorerId: null,
  };
}

function initYouthLeagues() {
  const registry = window.YOUTH_CLUBS.teams;
  const mhlTeams = registry.filter(meta => meta.league === 'MHL').map(createYouthTeam);
  const rhlTeams = registry.filter(meta => meta.league === 'RHL').map(createYouthTeam);
  return {
    rules: { ...YOUTH_RULES },
    leagues: {
      MHL: createYouthCompetition('MHL', mhlTeams),
      RHL: createYouthCompetition('RHL', rhlTeams),
    },
    transferLog: [],
    promotionHistory: [],
    generatedAtSeason: 1,
  };
}
