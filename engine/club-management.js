/* ============================================================
   ШТАБ / ИНФРА / АКАДЕМИЯ
   ============================================================ */
const STAFF_ROLES = {
  headCoach:      { label: 'Главный тренер', baseSalary: 3.0, icon: '👔', desc: 'Бонус к атаке и защите (+1% за уровень)' },
  assistantCoach: { label: 'Ассистент', baseSalary: 1.5, icon: '📋', desc: 'Открывает «Советы» в тактике и тренировках' },
  youthCoach:     { label: 'Тренер молодёжи', baseSalary: 1.2, icon: '🎓', desc: 'Ускоряет рост молодых игроков' },
  physicalCoach:  { label: 'Тренер по физподготовке', baseSalary: 1.0, icon: '💪', desc: 'Снижает усталость после матчей' },
  doctor:         { label: 'Врач команды', baseSalary: 1.2, icon: '🩺', desc: 'Снижает риск и длительность травм' },
  psychologist:   { label: 'Психолог', baseSalary: 1.0, icon: '🧠', desc: 'Снижает конфликты на 30%, +1 к морали каждый тур' },
  marketing:      { label: 'Маркетолог', baseSalary: 1.0, icon: '📈', desc: 'Повышает доход от матч-дей' },
  administrator:  { label: 'Администратор', baseSalary: 0.8, icon: '🗂️', desc: 'Снижает операционные расходы' },
  scout:          { label: 'Скаут', baseSalary: 1.0, icon: '🔍', desc: 'Показывает потенциал и данные соперников' },
};
function genStaffCandidate() {
  const roles = Object.keys(STAFF_ROLES);
  const role = pick(roles);
  const level = randInt(1, 5);
  const base = STAFF_ROLES[role].baseSalary;
  return { id: nextId(), role, name: pick(FIRST) + ' ' + pick(LAST), level, xp: 0, salary: Math.round(base * (0.5 + level * 0.3) * 10) / 10, age: randInt(30, 65) };
}
function generateStaffCandidates(count = 12) { const list = []; for (let i = 0; i < count; i++) list.push(genStaffCandidate()); return list; }
function updateStaffPool() {
  if (!G.league.staffPool) G.league.staffPool = [];
  for (let i = 0; i < randInt(1, 2); i++) G.league.staffPool.push(genStaffCandidate());
  if (G.league.staffPool.length > 15) G.league.staffPool = G.league.staffPool.slice(-15);
}
const INFRA = {
  training:     { label: 'Тренировочная база', desc: 'Ускоряет развитие игроков', maxLevel: 5, upgradeCost: l => 20 + l * 30, effect: l => `+${l * 5}% к скорости развития` },
  medical:      { label: 'Медицинский центр', desc: 'Снижает риск травм', maxLevel: 5, upgradeCost: l => 25 + l * 25, effect: l => `-${l * 5}% к риску травм` },
  youthAcademy: { label: 'Детская академия', desc: 'Улучшает качество молодёжи', maxLevel: 5, upgradeCost: l => 30 + l * 35, effect: l => `+${l * 2} к базовому OVR выпускников` },
  marketing:    { label: 'Маркетинг', desc: 'Повышает доход от матч-дей', maxLevel: 5, upgradeCost: l => 15 + l * 20, effect: l => `+${l * 8}% к доходу от матч-дей` },
};
function arenaUpgradeCost(level) { return 100 + level * 150; }
function genAcademyPlayer(group, academyLevel, forceStar = false) {
  const age = group === 'U16' ? randInt(15, 16) : group === 'U17' ? randInt(16, 17) : randInt(17, 18);
  const pos = pick(['C','LW','RW','D','G']);
  const baseOvr = clamp(46 + academyLevel * 2 + randInt(-4, 4), 42, 65);
  const p = genPlayer(pos, baseOvr); p.age = age;
  const isG = pos === 'G';
  const isStar = forceStar || rng() < 0.05;
  const bonus = 12 + academyLevel * 2 + randInt(-3, 8) + (isStar ? 20 : 0);
  p.attrPot = {};
  const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  for (const a of attrs) p.attrPot[a] = clamp(p.attrs[a] + bonus + randInt(-3, 5), 50, 99);
  p.pot = overallFromAttrs(p.attrPot, isG); p.ovr = overallFromAttrs(p.attrs, isG);
  p.isStarAcademy = isStar;
  return p;
}
function academyPrognosis(p) {
  if (p.isStarAcademy) return { label: '⭐ Звезда', cls: 'star' };
  if (p.pot >= 82) return { label: 'Топ-6', cls: 'top6' };
  if (p.pot >= 72) return { label: 'Чек-лайн', cls: 'checking' };
  return { label: 'Энерджайзер', cls: 'energy' };
}
function initAcademy(team) {
  team.academy = { U16: [], U17: [], U18: [] };
  const lvl = team.infrastructure.youthAcademy;
  for (const g of ['U16','U17','U18']) for (let i = 0; i < randInt(6, 8); i++) team.academy[g].push(genAcademyPlayer(g, lvl));
}
function searchForTalent() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  if (team.finance.balance < 5) { showToast('Нужно 5 млн ₽'); return; }
  team.finance.balance -= 5; team.finance.expenses.operations += 5;
  const lvl = team.infrastructure.youthAcademy;
  const isStar = rng() < 0.10;
  const p = genAcademyPlayer('U18', lvl + 1, isStar);
  p.age = randInt(16, 18);
  team.academy.U18.push(p);
  addNews('academy', `${team.name} нашёл талант: ${p.name} (${p.position}, OVR ${p.ovr}${isStar ? ', ⭐ звезда' : ''})`, isStar ? 3 : 1);
  addInboxMessage('scout', 'Скаут', `Найден талант: ${p.name}`, `Позиция: ${p.position}, возраст: ${p.age}, OVR: ${p.ovr}, потенциал: ${p.pot}${isStar ? ' ⭐' : ''}. Находится в U18.`, []);
  render();
}
function sendScoutMission() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  if (team.scoutMission && team.scoutMission.active) { showToast('Скаут уже в миссии'); return; }
  if (team.finance.balance < 2) { showToast('Нужно 2 млн ₽'); return; }
  team.finance.balance -= 2; team.finance.expenses.operations += 2;
  team.scoutMission = { active: true, endsRound: G.league.currentRound + 5, reported: false };
  addInboxMessage('scout', 'Скаут', 'Скаут отправлен', 'Скаут отправился в поездку. Отчёт через 5 туров.', []);
  render();
}
function checkScoutMission(team) {
  if (!team.scoutMission || !team.scoutMission.active) return;
  if (G.league.currentRound < team.scoutMission.endsRound) return;
  if (team.scoutMission.reported) return;
  team.scoutMission.reported = true;
  team.scoutMission.active = false;
  const count = randInt(2, 4);
  const found = [];
  for (let i = 0; i < count; i++) found.push(genAcademyPlayer('U17', team.infrastructure.youthAcademy, rng() < 0.15));
  team.scoutMission.results = found;
  addInboxMessage('scout', 'Скаут', `Отчёт скаута: ${count} игрока`, `Найдены ${count} перспективных игрока. Посмотрите в академии.`, []);
}
function addScoutedPlayerToAcademy(team, scoutedId) {
  const scouted = (team.scoutMission?.results || []).find(p => p.id === scoutedId);
  if (!scouted) return;
  team.academy.U17.push(scouted);
  team.scoutMission.results = team.scoutMission.results.filter(p => p.id !== scoutedId);
  addInboxMessage('scout', 'Скаут', `Игрок добавлен в академию`, `${scouted.name} (${scouted.position}) принят в U17.`, []);
  render();
}
function growAcademyPlayer(p) {
  p.age++;
  const isG = p.position === 'G';
  const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const gain = p.age <= 17 ? randInt(2, 4) : randInt(1, 3);
  for (let i = 0; i < gain; i++) { const elig = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (!elig.length) break; p.attrs[pick(elig)]++; }
  p.ovr = overallFromAttrs(p.attrs, isG);
  return p;
}
function progressAcademy(team) {
  const promoted = [];
  for (const p of team.academy.U18) {
    growAcademyPlayer(p);
    if (p.ovr >= 60 && p.age >= 18) { p.status = 'contract'; p.contract = contractFor(p.ovr, p.age); promoted.push(p); }
  }
  team.academy.U18 = team.academy.U17.map(growAcademyPlayer);
  team.academy.U17 = team.academy.U16.map(growAcademyPlayer);
  team.academy.U16 = [];
  const lvl = team.infrastructure.youthAcademy;
  for (let i = 0; i < randInt(6, 8); i++) team.academy.U16.push(genAcademyPlayer('U16', lvl));
  for (const p of promoted) {
    team.roster.push(p);
    if (p.ovr >= 65) addNews('academy', `${p.name} (${p.position}, ${p.ovr}) выпустился из академии ${team.name}`, 1);
  }
}
function developStaff(team) {
  for (const role of Object.keys(team.staff)) {
    const emp = team.staff[role];
    if (!emp) continue;
    emp.xp = (emp.xp || 0) + 10;
    const xpNeeded = emp.level * 20;
    if (emp.level < 5 && emp.xp >= xpNeeded) { emp.xp -= xpNeeded; emp.level++; emp.salary = Math.round(STAFF_ROLES[role].baseSalary * (0.5 + emp.level * 0.3) * 10) / 10; }
  }
}
