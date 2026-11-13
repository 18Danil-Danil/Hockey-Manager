/* ============================================================
   ГЕНЕРАЦИЯ ИГРОКОВ
   Функции используют общие данные и RNG, загруженные до этого файла.
   ============================================================ */
function overallFromAttrs(attrs, isG) {
  if (isG) return Math.round(attrs.reflexes*0.3 + attrs.positioning*0.3 + attrs.glove*0.15 + attrs.stick*0.15 + attrs.iq*0.1);
  return Math.round(attrs.skating*0.15 + attrs.shooting*0.20 + attrs.passing*0.20 + attrs.defense*0.20 + attrs.physical*0.10 + attrs.iq*0.15);
}
function contractFor(ovr, age) {
  let base = Math.pow(Math.max(0, ovr - 60) / 30, 2) * 22;
  if (age <= 23) base *= 0.55; else if (age >= 30) base *= 0.9;
  const salary = Math.max(0.5, Math.round(base * 10) / 10);
  return {
    salary, years: randInt(1, 5),
    bonusGoal: Math.round((0.02 + Math.max(0, ovr - 60) * 0.002) * 100) / 100,
    bonusGames: Math.round((0.08 + Math.max(0, ovr - 60) * 0.008) * 10) / 10,
    bonusPlayoff: Math.round((0.3 + Math.max(0, ovr - 60) * 0.03) * 10) / 10,
    bonusMvp: Math.round((0.8 + Math.max(0, ovr - 60) * 0.05) * 10) / 10,
    bonusTopScorer: Math.round((0.4 + Math.max(0, ovr - 60) * 0.03) * 10) / 10,
  };
}
function pickAge(targetOvr) {
  if (targetOvr >= 88) return randInt(23, 32);
  if (targetOvr >= 80) return randInt(21, 34);
  if (targetOvr >= 72) return randInt(20, 35);
  return randInt(19, 35);
}
function generateAttrPot(attrs, age, isG) {
  const list = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const bonus = age <= 21 ? randInt(8, 18) : age <= 23 ? randInt(3, 10) : age <= 26 ? randInt(0, 4) : 0;
  const pot = {};
  for (const a of list) pot[a] = clamp(attrs[a] + bonus + randInt(-2, 4), 40, 99);
  return pot;
}
function pickCharacter() { return pickWeighted(Object.keys(CHARACTER_WEIGHTS), k => CHARACTER_WEIGHTS[k]); }
function pickPlayerNationality() {
  const weights = window.PLAYER_DATA.NATIONALITY_WEIGHTS;
  return pickWeighted(Object.keys(weights), nationality => weights[nationality]);
}
function normalizePlayerNameKey(name) {
  return String(name || '').normalize('NFKC').toLocaleLowerCase('ru')
    .replace(/ё/g, 'е').replace(/\\s+/g, ' ').trim();
}
function getPlayerNameRegistry() {
  if (!(window.PLAYER_NAME_REGISTRY instanceof Set)) window.PLAYER_NAME_REGISTRY = new Set();
  return window.PLAYER_NAME_REGISTRY;
}
function resetPlayerNameRegistry() {
  window.PLAYER_NAME_REGISTRY = new Set();
}
function hydratePlayerNameRegistry(league) {
  resetPlayerNameRegistry();
  const registry = getPlayerNameRegistry();
  const visited = new Set();
  const scan = value => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (typeof value.name === 'string' && value.position) {
      const key = normalizePlayerNameKey(value.name);
      if (key) registry.add(key);
    }
    for (const child of Object.values(value)) scan(child);
  };
  scan(league);
  return registry.size;
}
function getPlayerNameWeightProfile(nationality, kind, values) {
  const cache = window.PLAYER_NAME_WEIGHT_CACHE || (window.PLAYER_NAME_WEIGHT_CACHE = {});
  const cacheKey = nationality + ':' + kind;
  if (cache[cacheKey]?.values === values) return cache[cacheKey];
  const profile = window.PLAYER_NAME_FREQUENCY?.[nationality]?.[kind] || {};
  const common = new Set((profile.common || []).map(normalizePlayerNameKey));
  const rare = new Set((profile.rare || []).map(normalizePlayerNameKey));
  const commonWeight = kind === 'first' ? 250 : 35;
  const ordinaryWeight = kind === 'first' ? 25 : 10;
  const weights = (values || []).map(value => rare.has(normalizePlayerNameKey(value)) ? 1 : common.has(normalizePlayerNameKey(value)) ? commonWeight : ordinaryWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  cache[cacheKey] = { values, weights, total, common, rare };
  return cache[cacheKey];
}
function getPlayerNamePartWeight(nationality, kind, value) {
  const profile = getPlayerNameWeightProfile(nationality, kind, []);
  const key = normalizePlayerNameKey(value);
  if (profile.rare.has(key)) return 1;
  if (profile.common.has(key)) return kind === 'first' ? 250 : 35;
  return kind === 'first' ? 25 : 10;
}
function pickWeightedPlayerNamePart(values, nationality, kind) {
  if (!values?.length) return '';
  const profile = getPlayerNameWeightProfile(nationality, kind, values);
  let roll = randInt(1, profile.total);
  for (let i = 0; i < values.length; i++) {
    roll -= profile.weights[i];
    if (roll <= 0) return values[i];
  }
  return values[values.length - 1];
}
function generatePlayerName(nationality) {
  const registry = getPlayerNameRegistry();
  const pool = window.PLAYER_DATA.NAME_POOLS[nationality] || { first: FIRST, last: LAST };
  const takeUnique = source => {
    const first = source?.first || [];
    const last = source?.last || [];
    if (!first.length || !last.length) return null;
    const combinations = first.length * last.length;
    const start = randInt(0, combinations - 1);
    for (let offset = 0; offset < combinations; offset++) {
      const index = (start + offset) % combinations;
      const candidate = first[Math.floor(index / last.length)] + ' ' + last[index % last.length];
      const key = normalizePlayerNameKey(candidate);
      if (!registry.has(key)) {
        registry.add(key);
        return candidate;
      }
    }
    return null;
  };
  // Сначала выбираем части имени с учётом распространённости.
  // Редкие исторические имена остаются в пуле, но имеют существенно меньший вес.
  for (let attempt = 0; attempt < 12; attempt++) {
    const firstName = pickWeightedPlayerNamePart(pool.first || FIRST, nationality, 'first');
    const lastName = pickWeightedPlayerNamePart(pool.last || LAST, nationality, 'last');
    const candidate = (firstName + ' ' + lastName).trim();
    const key = normalizePlayerNameKey(candidate);
    if (candidate && !registry.has(key)) {
      registry.add(key);
      return candidate;
    }
  }
  // Если популярные сочетания уже заняты, используем полный пул без потери уникальности.
  const uniqueName = takeUnique(pool);
  if (uniqueName) return uniqueName;
  const fallbackName = takeUnique({ first: FIRST, last: LAST });
  if (fallbackName) return fallbackName;
  const base = (pick(pool.first?.length ? pool.first : FIRST) + ' ' + pick(pool.last?.length ? pool.last : LAST)).trim();
  let candidate = base;
  let suffix = 2;
  while (registry.has(normalizePlayerNameKey(candidate))) candidate = base + ' ' + suffix++;
  registry.add(normalizePlayerNameKey(candidate));
  return candidate;
}
function genPlayer(position, targetOvr, opts = {}) {
  const isG = position === 'G';
  const age = pickAge(targetOvr);
  const attrs = {};
  const pool = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  for (const a of pool) attrs[a] = clamp(Math.round(gauss(targetOvr, 4)), 40, 99);
  const ovr = overallFromAttrs(attrs, isG);
  const attrPot = generateAttrPot(attrs, age, isG);
  const nat = opts.nationality || pickPlayerNationality();
  return {
    id: nextId(), name: generatePlayerName(nat), position, age, attrs, attrPot, nationality: nat,
    ovr, pot: overallFromAttrs(attrPot, isG),
    morale: randInt(65, 90), form: randInt(55, 85),
    character: opts.character || pickCharacter(),
    contract: opts.contract || contractFor(ovr, age),
    stats: null, playoffStats: null,
    careerStats: { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 },
    seasonHistory: [],
    seasonGoal: null,
    status: opts.status || 'contract',
    tryoutGames: opts.tryoutGames || 0,
    developmentFocus: null, onTradeBlock: false,
    injury: null, fatigue: 0,
    injuryPolicy: null,
    goalieStreak: 0, lastGameBad: false,
    playingThroughPain: false,
    mentorName: null,
    isStarAcademy: false,
    lastIndTraining: -10,
  };
}
