#!/usr/bin/env node
/* Сбор сезонной статистики ВХЛ из официальных таблиц статистики лиги.
 * Контроль качества блокирует публикацию массово повторённых сезонных строк.
 * Загружает шесть сезонных таблиц (регулярный чемпионат и плей-офф),
 * сопоставляет игроков с текущими составами и дополняет карьерную историю.
 */
import fs from 'node:fs/promises';
import { findSuspiciousCrossSeasonDuplicates } from './player-stats-quality.mjs';
import { parseVhlTournamentOptions } from './vhl-tournament-map.mjs';
import { parseVhlPlayerCareer } from './vhl-player-career-parser.mjs';
import { parseVhlSeasonStats } from './vhl-season-stats-parser.mjs';

const BASE = 'https://www.vhlru.ru';
const USER_AGENT = 'HockeyManagerVHLStatsBot/1.0 (low-frequency statistics import)';
const INPUT_FILE = 'data/vhl-rosters.js';
const OUTPUT_FILE = 'data/vhl-player-stats.js';
const HISTORY_FILE = 'data/player-league-history.js';
const REPORT_FILE = 'vhl-player-stats-report.md';
const DELAY_MS = 1100;
const SEASONS_TO_IMPORT = 10;

function seasonLabel(endYear) {
  return String(endYear - 1).slice(-2) + '/' + String(endYear).slice(-2);
}
function decode(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOf(value) {
  return decode(String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function cellsOf(row) {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => textOf(match[1]));
}
function numeric(value) {
  if (value === undefined || value === null || value === '' || value === '-' || value === '—') return null;
  const parsed = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function minutes(value) {
  const match = /^(\d+):(\d{2})$/.exec(String(value || '').trim());
  return match ? Number(match[1]) + Number(match[2]) / 60 : null;
}
function robotsAllowsPath(robotsText, targetPath) {
  const lines = robotsText.split(/\r?\n/).map(line => line.split('#')[0].trim()).filter(Boolean);
  const groups = [];
  let current = null;
  for (const line of lines) {
    const match = /^(user-agent|disallow|allow)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === 'user-agent') {
      if (!current || current.hasRules) { current = { agents: [], rules: [], hasRules: false }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      current.rules.push({ type: key, path: value }); current.hasRules = true;
    }
  }
  const applicable = groups.filter(group => group.agents.includes('*') ||
    group.agents.some(agent => USER_AGENT.toLowerCase().includes(agent)));
  const rules = applicable.flatMap(group => group.rules)
    .filter(rule => rule.path && (targetPath.startsWith(rule.path) || rule.path.startsWith(targetPath)))
    .sort((a, b) => b.path.length - a.path.length);
  return !rules.length || rules[0].type === 'allow';
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function getText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html, text/plain;q=0.9, */*;q=0.8'
    },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

const sourceText = await fs.readFile(INPUT_FILE, 'utf8');
const rosterMatch = sourceText.match(/window\.VHL_ROSTER_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
if (!rosterMatch) throw new Error('Не удалось прочитать data/vhl-rosters.js.');
const rosterData = JSON.parse(rosterMatch[1]);
const rosterPlayers = new Map();
for (const team of rosterData.teams || []) {
  for (const player of team.players || []) {
    if (player.playerId && player.position) rosterPlayers.set(String(player.playerId), {
      playerId: Number(player.playerId), position: player.position, name: player.name
    });
  }
}
if (!rosterPlayers.size) throw new Error('В текущей базе составов не найдено игроков.');

const robotsText = await getText(`${BASE}/robots.txt`);
if (!robotsAllowsPath(robotsText, '/en/stats/players/') ||
    !robotsAllowsPath(robotsText, '/en/calendar/') ||
    !robotsAllowsPath(robotsText, '/players/')) {
  throw new Error('robots.txt не разрешает автоматическое обращение к календарю, статистике или карточкам игроков. Сбор остановлен.');
}

// В URL статистики нужен не год сезона, а внутренний tournament ID (tn).
// Его нельзя вычислять арифметически: ВХЛ назначает отдельный ID каждому этапу.
let tournamentHtml = await getText(`${BASE}/en/calendar/`);
let tournaments;
try {
  tournaments = parseVhlTournamentOptions(tournamentHtml);
} catch (calendarError) {
  // The stats page exposes the same tournament selector; use it if the calendar
  // response is an incomplete shell or is temporarily served without its options.
  tournamentHtml = await getText(`${BASE}/en/stats/players/`);
  try {
    tournaments = parseVhlTournamentOptions(tournamentHtml);
  } catch (statsError) {
    await fs.writeFile(REPORT_FILE, [
      '# Ошибка чтения списка турниров ВХЛ',
      '',
      '- Календарь: ' + calendarError.message,
      '- Страница статистики: ' + statsError.message,
      '- Фрагмент ответа: ' + String(tournamentHtml).slice(0, 500).replace(/</g, '&lt;')
    ].join('\n') + '\n', 'utf8');
    throw new Error('Не удалось прочитать список турниров ни из календаря, ни из статистики ВХЛ.');
  }
}
const selectedYears = [...new Set(tournaments.map(item => item.endYear))]
  .sort((a, b) => b - a).slice(0, SEASONS_TO_IMPORT);
const selectedYearSet = new Set(selectedYears);
const targets = tournaments
  .filter(item => selectedYearSet.has(item.endYear))
  .sort((a, b) => b.endYear - a.endYear || (Number(a.stage !== 'regular') - Number(b.stage !== 'regular')));
const seasons = [...selectedYears].sort((a, b) => b - a).map(seasonLabel);
console.log(`Найдены турниры ВХЛ: ${targets.length}; сезоны: ${seasons.join(', ')}`);

const outputPlayers = {};
const failures = [];
const pageReports = [];
const emptyPages = [];
for (const target of targets) {
  const label = seasonLabel(target.endYear);
  const url = `${BASE}/en/stats/players/${target.tn}/`;
  try {
    const html = await getText(url);
    const sourcePlayerRows = [...html.matchAll(/href=["'][^"']*\/players\/(\d+)\/?(?:\?[^"']*)?["']/gi)].length;
    const seasonPlayers = parseVhlSeasonStats(html, label, target.stage, rosterPlayers);
    let rowsAdded = 0;
    for (const [id, records] of seasonPlayers) {
      if (!outputPlayers[id]) outputPlayers[id] = { position: rosterPlayers.get(id).position, seasons: [] };
      outputPlayers[id].seasons.push(...records);
      rowsAdded += records.length;
    }
    pageReports.push(`- ${label} (${target.stage}, tn=${target.tn}): ${sourcePlayerRows} строк источника, ${seasonPlayers.size} игроков из текущих составов, ${rowsAdded} строк статистики`);
    // Пустой источник — ошибка. Ноль совпадений с текущими составами допустим для старых сезонов.
    if (!sourcePlayerRows) emptyPages.push({ season: label, stage: target.stage, tn: target.tn });
    console.log(`Загружен ${label} / ${target.stage} (tn=${target.tn}): ${seasonPlayers.size} игроков текущих составов из ${sourcePlayerRows} строк`);
  } catch (error) {
    failures.push(`${label} ${target.stage} (tn=${target.tn}): ${error.message}`);
  }
  await sleep(DELAY_MS);
}

// Для игроков с пробелами в сезонных таблицах используем их официальные карточки:
// в них есть полная разбивка ВХЛ по сезонам, этапам и клубам.
const seasonsNeedingCareerFallback = new Set(emptyPages.map(gap => gap.season));
const careerCandidateIds = new Set(
  [...rosterPlayers.entries()]
    .filter(([id]) => {
      const rows = outputPlayers[id]?.seasons || [];
      return !rows.length || rows.some(row => seasonsNeedingCareerFallback.has(row.season));
    })
    .map(([id]) => id)
);
const careerReports = [];
const careerFailures = [];
let careerRowsAdded = 0;
for (const id of careerCandidateIds) {
  const player = rosterPlayers.get(id);
  if (!player) continue;
  try {
    const html = await getText(`${BASE}/players/${id}/`);
    const career = parseVhlPlayerCareer(html, id, player.position);
    if (!outputPlayers[id]) outputPlayers[id] = { position: career.position || player.position, seasons: [] };
    const existing = new Set(outputPlayers[id].seasons.map(row =>
      [row.season, row.stage, row.team].join('|')
    ));
    let added = 0;
    for (const row of career.seasons) {
      const key = [row.season, row.stage, row.team].join('|');
      if (existing.has(key)) continue;
      outputPlayers[id].seasons.push(row);
      existing.add(key);
      added++;
      careerRowsAdded++;
      if (!seasons.includes(row.season)) seasons.push(row.season);
    }
    careerReports.push(`- ${id} ${player.name}: ${career.seasons.length} строк в карточке, добавлено ${added}`);
  } catch (error) {
    careerFailures.push(`${id} ${player.name}: ${error.message}`);
  }
  await sleep(DELAY_MS);
}
seasons.sort((a, b) => {
  const endYear = value => {
    const match = /^(\d{2})\/(\d{2})$/.exec(value);
    return match ? 2000 + Number(match[2]) : 0;
  };
  return endYear(b) - endYear(a);
});
const unresolvedEmptyPages = emptyPages.filter(gap =>
  !Object.values(outputPlayers).some(player =>
    (player.seasons || []).some(row => row.season === gap.season && row.stage === gap.stage)
  )
);
if (unresolvedEmptyPages.length) {
  const diagnostic = [
    '# Отчёт проверки качества сезонной статистики ВХЛ',
    '',
    '- Импорт остановлен: для пустых сезонных таблиц не удалось восстановить статистику из карточек игроков.',
    '- Невосстановленные выборки: ' + unresolvedEmptyPages.map(gap => `${gap.season} (${gap.stage}, tn=${gap.tn})`).join(', '),
    `- Карточек игроков проверено: ${careerCandidateIds.size}`,
    `- Строк добавлено из карточек: ${careerRowsAdded}`,
    ...pageReports,
    '',
    'Новые данные не опубликованы.'
  ].join('\n');
  await fs.writeFile(REPORT_FILE, diagnostic + '\n', 'utf8');
  throw new Error('Не удалось восстановить статистику из карточек игроков для: ' +
    unresolvedEmptyPages.map(gap => `${gap.season} ${gap.stage}`).join(', '));
}

const suspiciousDuplicates = findSuspiciousCrossSeasonDuplicates(outputPlayers);
const duplicateLimit = Math.max(10, Math.ceil(Object.keys(outputPlayers).length * 0.05));
if (suspiciousDuplicates.length > duplicateLimit) {
  const sample = suspiciousDuplicates.slice(0, 8).map(item =>
    item.playerId + ': ' + item.first.season + '/' + item.first.stage +
    ' повторяется в ' + item.repeated.season + '/' + item.repeated.stage
  ).join('; ');
  throw new Error(
    'Обнаружено слишком много подозрительно одинаковых записей между сезонами: ' +
    suspiciousDuplicates.length + ' (допустимый порог ' + duplicateLimit +
    '). Новые данные не будут опубликованы. Примеры: ' + sample
  );
}

const historyText = await fs.readFile(HISTORY_FILE, 'utf8');
const existingHistoryIds = new Set(
  [...historyText.matchAll(/^\s{4}"(\d+)":\s*\{/gm)].map(match => match[1])
);
// История должна покрывать всех игроков текущих составов, а не старый лимит в 500 записей.
const historyAdditions = [];
const historyIdsAfterImport = new Set(existingHistoryIds);
for (const [id, playerStats] of Object.entries(outputPlayers)) {
  if (existingHistoryIds.has(id)) continue;
  const seasons = (playerStats.seasons || []).filter(row => Number(row.gp) > 0).map(row => ({
    season: row.season,
    league: 'VHL',
    gp: row.gp,
    ...(row.team ? { team: row.team } : {}),
    stage: row.stage === 'playoff' ? 'playoffs' : 'regular'
  }));
  if (!seasons.length) continue;
  historyAdditions.push(
    `    // Источник: ${BASE}/en/stats/players/ — официальная сезонная статистика ВХЛ.\n` +
    `    "${id}": ${JSON.stringify({ position: playerStats.position, seasons })}`
  );
}
const historyTotal = existingHistoryIds.size + historyAdditions.length;
if (failures.length) {
  throw new Error(`Не удалось полностью загрузить все выбранные турнирные таблицы. Публикация отменена: ${failures.join(' | ')}`);
}
if (missingRosterHistory.length) {
  throw new Error(`Карьерная история не покрывает ${missingRosterHistory.length} игроков текущих составов ВХЛ. Примеры ID: ${missingRosterHistory.slice(0, 20).join(', ')}. Публикация отменена.`);
}

const updatedHistory = historyText.replace(
  /\n  }\n};\s*$/,
  '\n' + historyAdditions.join(',\n') + ',\n  }\n};\n'
);
if (historyAdditions.length && updatedHistory === historyText) {
  throw new Error('Не удалось безопасно обновить конец player-league-history.js.');
}
if (historyAdditions.length) await fs.writeFile(HISTORY_FILE, updatedHistory, 'utf8');

const payload = {
  schemaVersion: 1,
  source: 'vhlru',
  sourceUrl: `${BASE}/en/stats/players/{tournamentId}/ (tournamentId resolved from the official calendar)`,
  importedAt: new Date().toISOString(),
  seasons,
  players: outputPlayers
};
await fs.writeFile(OUTPUT_FILE, '/* Сезонная статистика ВХЛ; формируется tools/vhl-player-stats-sync.mjs. */\nwindow.VHL_PLAYER_STATS_DATA = ' + JSON.stringify(payload) + ';\n', 'utf8');

const report = [
  '# Отчёт импорта статистики игроков ВХЛ', '',
  `- Игроков в текущих составах: ${rosterPlayers.size}`,
  `- Игроков с сезонной статистикой за выбранные сезоны: ${Object.keys(outputPlayers).length}`,
  `- Игроков текущих составов с карьерной историей: ${rosterPlayers.size - missingRosterHistory.length}/${rosterPlayers.size}`,
  `- Игроков в карьерной истории после импорта: ${historyTotal}`,
  `- Новых игроков добавлено в карьерную историю: ${historyAdditions.length}`,
  `- Сезоны: ${seasons.join(', ')}`,
  `- Дата импорта: ${payload.importedAt}`, '',
  '## Загруженные таблицы',
  ...pageReports,
  '', '## Ошибки',
  ...(failures.length ? failures.map(value => '- ' + value) : ['- Нет'])
].join('\n');
await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
console.log(report);
