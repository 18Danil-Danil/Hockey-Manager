/* ============================================================
   ГЕНЕРАЦИЯ КОМАНДЫ (из VHL_TEAMS)
   ============================================================ */
function genTeam(meta) {
  const roster = [];
  const talent = meta.talent;
  const att = meta.ratings.att;
  const def = meta.ratings.def;
  const gk  = meta.ratings.gk;

  const fTemplate = [att + 4, att + 2, att, att - 2, att - 4, att - 6, att - 8, att - 10, att - 12, att - 14, att - 16, att - 18, att - 20];
  const fPositions = ['C','C','C','LW','LW','LW','RW','RW','RW','C','LW','RW','C'];
  fTemplate.forEach((baseOvr, i) => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer(fPositions[i], ovr));
  });
  const dTemplate = [def + 2, def, def - 2, def - 4, def - 6, def - 8, def - 10];
  dTemplate.forEach(baseOvr => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer('D', ovr));
  });
  [gk, gk - 6].forEach(baseOvr => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer('G', ovr));
  });
  let importedRoster = null;
  if (typeof buildImportedVhlRoster === 'function') {
    try { importedRoster = buildImportedVhlRoster(meta); }
    catch (error) { console.warn('Не удалось применить состав ВХЛ для ' + meta.name + ':', error); }
  }
  if (importedRoster) {
    roster.length = 0;
    roster.push(...importedRoster.players);
  }
  roster.sort((a, b) => b.ovr - a.ovr);

  const budget = meta.budget / 1_000_000;
  const baseFanBase = clamp(meta.fanBase / 5, 0.2, 1.0);
  const diff = G.difficulty || DIFFICULTIES.normal;
  const salaryCapPct = diff.salaryCapPct;

  const team = {
    id: meta.id, slug: meta.slug, name: meta.name, shortName: meta.shortName,
    city: meta.city, region: meta.region,
    strength: 1.00 + (talent - 64) / 14 * 0.40,
    talent: meta.talent, prestige: meta.prestige, trend: meta.trend,
    ratings: { ...meta.ratings },
    history: meta.history.map(h => ({ ...h })),
    trophies: {
      petrov: [...meta.trophies.petrov],
      regular: [...meta.trophies.regular],
      opening: [...meta.trophies.opening],
      finals: [...(meta.trophies.finals || [])],
    },
    rivals: [...meta.rivals],
    logo: meta.logo,
    sponsorFlow: meta.sponsorFlow, govSupport: meta.govSupport,
    hockeyLove: meta.hockeyLove, youthFactor: meta.youthFactor,
    baseMarket: meta.baseMarket, gmType: meta.gmType,
    coachStyle: meta.coachStyle, staffSkill: meta.staffSkill,
    roster,
    rosterSource: importedRoster ? { source: 'vhlru', teamName: importedRoster.sourceTeamName, rosterAsOf: importedRoster.rosterAsOf } : { source: 'generated' },
    record: { w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 },
    finance: {
      seasonBudget: budget,
      balance: Math.round(budget * 0.20 * diff.startBalancePct),
      salaryCap: Math.round(budget * salaryCapPct),
      arenaCapacity: meta.arenaCapacity,
      ticketPrice: 500,
      fanBase: baseFanBase, baseFanBase,
      merchLevel: 1, vipLevel: 0,
      matchdayFlags: { fanzone: false, show: false, kidsTickets: false },
      income: { tickets: 0, matchdayExtras: 0, sponsors: 0, sponsorBonuses: 0, tv: 0, prizes: 0, transfers: 0, merch: 0, gov: 0 },
      expenses: { salaries: 0, staffSalaries: 0, operations: 0, transfers: 0, bonuses: 0 },
      lastSponsorWins: 0, sponsorOffers: null,
    },
    arenaLevel: 1,
    tactics: { forecheck: 50, pressure: 50, style: 50, physical: 50, risk: 50 },
    sponsors: [],
    staff: { headCoach: null, assistantCoach: null, youthCoach: null, physicalCoach: null, doctor: null, psychologist: null, marketing: null, administrator: null, scout: null },
    infrastructure: { training: 1, medical: 1, youthAcademy: 1, marketing: 1 },
    lines: null, bench: [], waiversUsed: 0,
    streak: { type: null, count: 0 },
    lastRehabRound: -10,
    scoutMission: null,
  };
  initAcademy(team);
  return team;
}
