#!/usr/bin/env node
/**
 * Проверяет связку: автоматически собранная база -> настоящий импортёр -> генератор состава.
 * Запускается в GitHub Actions после каждой полной синхронизации.
 */
import fs from 'node:fs/promises';
import vm from 'node:vm';

const storage = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
globalThis.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
globalThis.gauss = () => 0;
globalThis.genPlayer = (position, ovr) => ({ position, ovr, age: 25, contract: null });
globalThis.contractFor = () => ({ years: 1 });

const bundle = await fs.readFile('data/vhl-rosters.js', 'utf8');
const importer = await fs.readFile('data/vhl-player-import.js', 'utf8');
vm.runInThisContext(bundle, { filename: 'data/vhl-rosters.js' });
vm.runInThisContext(importer, { filename: 'data/vhl-player-import.js' });

if (typeof window.validateVhlImport !== 'function' ||
    typeof window.buildImportedVhlRoster !== 'function') {
  throw new Error('Импортёр не открыл необходимые функции.');
}

const validated = window.validateVhlImport(window.VHL_ROSTER_DATA);
if (validated.teams.length !== 30) {
  throw new Error(\`Ожидалось 30 клубов, получено \${validated.teams.length}.\`);
}

let totalPlayers = 0;
for (const team of validated.teams) {
  const roster = window.buildImportedVhlRoster({
    slug: team.teamSlug,
    name: team.teamName,
    ratings: { att: 70, def: 70, gk: 70 }
  });
  if (!roster) throw new Error(\`Для клуба \${team.teamSlug} импортёр вернул пустой состав.\`);
  if (roster.players.length !== team.players.length) {
    throw new Error(\`Для клуба \${team.teamSlug} потерялись игроки.\`);
  }
  const counts = {
    forwards: roster.players.filter(p => ['C', 'LW', 'RW'].includes(p.position)).length,
    defense: roster.players.filter(p => p.position === 'D').length,
    goalies: roster.players.filter(p => p.position === 'G').length
  };
  if (counts.forwards < 12 || counts.defense < 6 || counts.goalies < 2) {
    throw new Error(\`Некорректное распределение амплуа в \${team.teamSlug}.\`);
  }
  if (roster.players.some(p => p.source !== 'vhlru' || !p.sourcePlayerId || !p.name)) {
    throw new Error(\`Не заполнены исходные данные игроков в \${team.teamSlug}.\`);
  }
  totalPlayers += roster.players.length;
  console.log(\`OK \${team.teamSlug}: \${roster.players.length} игроков\`);
}

if (totalPlayers !== validated.teams.reduce((sum, team) => sum + team.players.length, 0)) {
  throw new Error('Итоговое количество игроков не совпало.');
}
console.log(\`Успешно: \${validated.teams.length} клубов, \${totalPlayers} игроков прошли реальный импортёр и генератор состава.\`);
