#!/usr/bin/env node
/* NHL and historic major-league career seasons from Hockey Databank v13.0.
 * The source license permits commercial use with the required in-game attribution.
 */
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergePlayerSeasons } from './vhl-career-history-sync.mjs';

const HISTORY_FILE = 'data/player-league-history.js';
const REPORT_FILE = 'hockey-databank-report.md';
const BASE = 'https://raw.githubusercontent.com/rippinrobr/hockey-databank/master/';
const USER_AGENT = 'HockeyManagerCareerHistoryBot/1.0 (Hockey Databank attribution included)';

export function parseCsv(source) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const text = String(source).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some(value => value !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function normalizeName(value) {
  return String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
function nameVariants(value) {
  const base = normalizeName(value);
  const variants = new Set([base]);
  variants.add(base.replace(/ey/g, 'ei'));
  variants.add(base.replace(/ei/g, 'ey'));
  variants.add(base.replace(/iy$/g, 'y'));
  variants.add(base.replace(/ii$/g, 'y'));
  variants.add(base.replace(/y$/g, 'i'));
  variants.add(base.replace(/i$/g, 'y'));
  variants.add(base.replace(/kh/g, 'h'));
  variants.add(base.replace(/h/g, 'kh'));
  variants.add(base.replace(/ya/g, 'ia'));
  variants.add(base.replace(/ia/g, 'ya'));
  return [...variants].filter(Boolean);
}
function namesEquivalent(left, right) {
  const rightVariants = new Set(nameVariants(right));
  return nameVariants(left).some(value => rightVariants.has(value));
}
function numberOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const result = Number(String(value).trim());
  return Number.isFinite(result) ? result : null;
}
function dateFromMaster(player) {
  const year = numberOrNull(player.birthYear);
  const month = numberOrNull(player.birthMon);
  const day = numberOrNull(player.birthDay);
  if (!year || !month || !day) return null;
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
export function matchMasterPlayer(identity, masterRows) {
  if (!identity?.nameEn || !identity?.birthDate) return null;
  const parts = String(identity.nameEn).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const candidates = masterRows.filter(player => {
    if (dateFromMaster(player) !== identity.birthDate) return false;
    const firstOrderMatch = namesEquivalent(parts[0], player.lastName) &&
      (namesEquivalent(parts.slice(1).join(' '), player.firstName) || namesEquivalent(parts[1], player.firstName));
    const reverseOrderMatch = namesEquivalent(parts[parts.length - 1], player.lastName) &&
      namesEquivalent(parts.slice(0, -1).join(' '), player.firstName);
    return firstOrderMatch || reverseOrderMatch;
  });
  if (candidates.length === 1) return candidates[0];
  return null;
}
function seasonLabel(year) {
  const start = numberOrNull(year);
  if (!start) return null;
  return String(start % 100).padStart(2, '0') + '/' + String((start + 1) % 100).padStart(2, '0');
}
function teamNameFor(teamMap, row) {
  return teamMap.get([row.year, row.lgID, row.tmID].join('|')) || row.tmID || 'Team unknown';
}
function stat(value) {
  return numberOrNull(value);
}
function buildSkaterRow(row, stage, teamMap) {
  const prefix = stage === 'playoffs' ? 'Post' : '';
  const gp = stat(row[prefix + 'GP']);
  if (!gp || gp <= 0) return null;
  const fields = {
    season: seasonLabel(row.year),
    league: row.lgID,
    gp,
    goals: stat(row[prefix + 'G']),
    assists: stat(row[prefix + 'A']),
    points: stat(row[prefix + 'Pts']),
    pim: stat(row[prefix + 'PIM']),
    plusMinus: stat(row[prefix + '+/-']),
    powerPlayGoals: stat(row[prefix + 'PPG']),
    powerPlayAssists: stat(row[prefix + 'PPA']),
    shortHandedGoals: stat(row[prefix + 'SHG']),
    shortHandedAssists: stat(row[prefix + 'SHA']),
    gameWinningGoals: stat(row[prefix + 'GWG']),
    gameTyingGoals: stage === 'playoffs' ? null : stat(row.GTG),
    shotsOnGoal: stat(row[prefix + 'SOG']),
    team: teamNameFor(teamMap, row),
    stage,
    source: 'Hockey Databank v13.0'
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null && value !== undefined));
}
function buildGoalieRow(row, stage, teamMap) {
  const prefix = stage === 'playoffs' ? 'Post' : '';
  const gp = stat(row[prefix + 'GP']);
  if (!gp || gp <= 0) return null;
  const shotsAgainst = stat(row[prefix + 'SA']);
  const goalsAgainst = stat(row[prefix + 'GA']);
  const saves = shotsAgainst !== null && goalsAgainst !== null ? Math.max(0, shotsAgainst - goalsAgainst) : null;
  const minutes = stat(row[prefix + 'Min']);
  const fields = {
    season: seasonLabel(row.year),
    league: row.lgID,
    gp,
    wins: stat(row[prefix + 'W']),
    losses: stat(row[prefix + 'L']),
    tiesOrOvertimeLosses: stat(row[prefix + 'T/OL'] ?? row[prefix + 'T']),
    emptyNetGoals: stat(row[prefix + 'ENG']),
    shutouts: stat(row[prefix + 'SHO']),
    goalsAgainst,
    shotsAgainst,
    saves,
    savePercentage: shotsAgainst > 0 && saves !== null ? Math.round((saves / shotsAgainst) * 10000) / 100 : null,
    goalsAgainstAverage: minutes > 0 && goalsAgainst !== null ? Math.round((goalsAgainst * 60 / minutes) * 100) / 100 : null,
    minutes,
    team: teamNameFor(teamMap, row),
    stage,
    source: 'Hockey Databank v13.0'
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null && value !== undefined));
}

async function downloadCsv(file) {
  const response = await fetch(BASE + file, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/csv, text/plain;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error('Hockey Databank ' + file + ': HTTP ' + response.status);
  return parseCsv(await response.text());
}

async function main() {
  const historyTextOriginal = await fs.readFile(HISTORY_FILE, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(historyTextOriginal, sandbox, { timeout: 5000 });
  const history = sandbox.window.VHL_PLAYER_LEAGUE_HISTORY;
  if (!history?.players) throw new Error('Не удалось прочитать player-league-history.js');

  const [masterRows, scoringRows, goalieRows, teamRows] = await Promise.all([
    downloadCsv('Master.csv'),
    downloadCsv('Scoring.csv'),
    downloadCsv('Goalies.csv'),
    downloadCsv('Teams.csv')
  ]);

  const teamMap = new Map(teamRows.map(row => [
    [row.year, row.lgID, row.tmID].join('|'),
    row.name || row.tmID
  ]));
  const matched = new Map();
  const ambiguous = [];
  for (const [playerId, player] of Object.entries(history.players)) {
    const master = matchMasterPlayer(player.identity, masterRows);
    if (master) matched.set(playerId, master.playerID);
    else if (player.identity?.nameEn && player.identity?.birthDate) ambiguous.push(playerId);
  }

  const rowsByPlayer = new Map();
  const addRow = (vhlId, row) => {
    if (!row) return;
    if (!rowsByPlayer.has(vhlId)) rowsByPlayer.set(vhlId, []);
    rowsByPlayer.get(vhlId).push(row);
  };
  const vhlIdByMasterId = new Map([...matched.entries()].map(([vhlId, masterId]) => [masterId, vhlId]));

  for (const row of scoringRows) {
    const vhlId = vhlIdByMasterId.get(row.playerID);
    if (!vhlId || !row.lgID || !seasonLabel(row.year)) continue;
    addRow(vhlId, buildSkaterRow(row, 'regular', teamMap));
    addRow(vhlId, buildSkaterRow(row, 'playoffs', teamMap));
  }
  for (const row of goalieRows) {
    const vhlId = vhlIdByMasterId.get(row.playerID);
    if (!vhlId || !row.lgID || !seasonLabel(row.year)) continue;
    addRow(vhlId, buildGoalieRow(row, 'regular', teamMap));
    addRow(vhlId, buildGoalieRow(row, 'playoffs', teamMap));
  }

  let added = 0, enriched = 0, playersWithDatabankHistory = 0;
  let historyText = historyTextOriginal;
  for (const [vhlId, rows] of rowsByPlayer) {
    const player = history.players[vhlId];
    const merged = mergePlayerSeasons(historyText, vhlId, rows, player.position, player.identity);
    historyText = merged.text;
    added += merged.added;
    enriched += merged.enriched;
    if (rows.length) playersWithDatabankHistory++;
  }

  await fs.writeFile(HISTORY_FILE, historyText, 'utf8');
  const report = [
    '# Hockey Databank — импорт исторических сезонов',
    '',
    '- Игроков из истории ВХЛ: ' + Object.keys(history.players).length,
    '- Игроков однозначно сопоставлено с Hockey Databank: ' + matched.size,
    '- Игроков с найденными историческими сезонами: ' + playersWithDatabankHistory,
    '- Сезонных строк добавлено: ' + added,
    '- Существующих строк обогащено: ' + enriched,
    '- Игроков с identity без точного совпадения: ' + ambiguous.length,
    '- Строк в Hockey Databank Scoring.csv: ' + scoringRows.length,
    '- Строк в Hockey Databank Goalies.csv: ' + goalieRows.length,
    '- Дата импорта: ' + new Date().toISOString(),
    '',
    '## Источник и лицензия',
    'Hockey Databank v13.0, 10 июля 2018 года. Использование, включая коммерческий продукт, разрешено при публикации полного обязательного уведомления в игре.',
    'Покрытие исходного набора: NHL, NHA, WHA, PCHA и WCHL; данные до сезона 2017/18.'
  ].join('\n');
  await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
