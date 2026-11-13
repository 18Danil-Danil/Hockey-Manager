#!/usr/bin/env node
/* Сбор сезонной статистики ВХЛ из официальных таблиц статистики лиги.
 * Загружает шесть сезонных таблиц (регулярный чемпионат и плей-офф),
 * сопоставляет игроков с текущими составами и дополняет карьерную историю.
 */
import fs from 'node:fs/promises';

const BASE = 'https://www.vhlru.ru';
const USER_AGENT = 'HockeyManagerVHLStatsBot/1.0 (low-frequency statistics import)';
const INPUT_FILE = 'data/vhl-rosters.js';
const OUTPUT_FILE = 'data/vhl-player-stats.js';
const HISTORY_FILE = 'data/player-league-history.js';
const REPORT_FILE = 'vhl-player-stats-report.md';
const DELAY_MS = 900;
const SEASONS = lastCompletedSeasons();

function lastCompletedSeasons(now = new Date()) {
  const currentStartYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [1, 2, 3].map(offset => {
    const endYear = currentStartYear - offset + 1;
    return {
      endYear,
      label: String(endYear - 1).slice(-2) + '/' + String(endYear).slice(-2)
    };
  });
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
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html, text/plain;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

function parseSeasonStats(html, season, stage, rosterPlayers) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const parsed = new Map();
  for (const match of rows) {
    const rowHtml = match[1];
    const idMatch = rowHtml.match(/href=["'][^"']*\/players\/(\d+)\/?(?:\?[^"']*)?["']/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    const player = rosterPlayers.get(id);
    if (!player) continue;
    const c = cellsOf(rowHtml);
    if (c.length < 4) continue;
    const gp = numeric(c[3]);
    if (!gp || gp <= 0) continue;

    let record;
    if (player.position === 'goaltender') {
      if (c.length < 17) continue;
      record = {
        season, stage, gp, team: c[2],
        wins: numeric(c[4]), losses: numeric(c[5]),
        shotsAgainst: numeric(c[7]), goalsAgainst: numeric(c[8]),
        saves: numeric(c[9]), savePct: numeric(c[10]), gaa: numeric(c[11]),
        goals: numeric(c[12]), assists: numeric(c[13]), shutouts: numeric(c[14]),
        pim: numeric(c[15]), minutes: minutes(c[16])
      };
    } else {
      if (c.length < 27) continue;
      record = {
        season, stage, gp, team: c[2],
        goals: numeric(c[4]), assists: numeric(c[5]), points: numeric(c[6]),
        plusMinus: numeric(c[7]), pim: numeric(c[10]), ppGoals: numeric(c[12]),
        shots: numeric(c[17]), shootingPct: numeric(c[18]),
        faceoffs: numeric(c[20]), faceoffsWon: numeric(c[21]),
        faceoffPct: numeric(c[22]), toiPerGame: minutes(c[23]),
        shiftsPerGame: numeric(c[24]), hits: numeric(c[25]), blocks: numeric(c[26])
      };
    }
    if (!parsed.has(id)) parsed.set(id, []);
    parsed.get(id).push(record);
  }
  return parsed;
}

const sourceText = await fs.readFile(INPUT_FILE, 'utf8');
const rosterMatch = sourceText.match(/window\.VHL_ROSTER_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
if (!rosterMatch) throw new Error('Не удалось прочитать data/vhl-rosters.js.');
const rosterData = JSON.parse(rosterMatch[1]);
const rosterPlayers = new Map();
for (const team of rosterData.teams || []) {
  for (const player of team.players || []) {
    if (player.playerId && player.position) rosterPlayers.set(String(player.playerId), {
      playerId: Number(player.playerId), position: player.position
    });
  }
}
if (!rosterPlayers.size) throw new Error('В текущей базе составов не найдено игроков.');

const robotsResponse = await fetch(`${BASE}/robots.txt`, {
  headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/plain' },
  signal: AbortSignal.timeout(15000)
});
if (!robotsResponse.ok) throw new Error(`Не удалось проверить robots.txt: HTTP ${robotsResponse.status}`);
const robotsText = await robotsResponse.text();
if (!robotsAllowsPath(robotsText, '/en/stats/players/')) {
  throw new Error('robots.txt не разрешает автоматическое обращение к сезонной статистике. Сбор остановлен.');
}

const outputPlayers = {};
const failures = [];
const pageReports = [];
for (const seasonInfo of SEASONS) {
  for (const stage of ['regular', 'playoff']) {
    const url = `${BASE}/en/stats/players/${seasonInfo.endYear}/?stage=${stage}`;
    try {
      const html = await getText(url);
      const seasonPlayers = parseSeasonStats(html, seasonInfo.label, stage, rosterPlayers);
      let rowsAdded = 0;
      for (const [id, records] of seasonPlayers) {
        if (!outputPlayers[id]) outputPlayers[id] = { position: rosterPlayers.get(id).position, seasons: [] };
        outputPlayers[id].seasons.push(...records);
        rowsAdded += records.length;
      }
      pageReports.push(`- ${seasonInfo.label} (${stage}): ${seasonPlayers.size} игроков, ${rowsAdded} строк статистики`);
      console.log(`Загружен сезон ${seasonInfo.label} / ${stage}: ${seasonPlayers.size} игроков`);
    } catch (error) {
      failures.push(`${seasonInfo.label} ${stage}: ${error.message}`);
    }
    await sleep(DELAY_MS);
  }
}

const historyText = await fs.readFile(HISTORY_FILE, 'utf8');
const existingHistoryIds = new Set(
  [...historyText.matchAll(/^\s{4}"(\d+)":\s*\{/gm)].map(match => match[1])
);
const historyTarget = 500;
const historyAdditions = [];
for (const [id, playerStats] of Object.entries(outputPlayers)) {
  if (existingHistoryIds.has(id) || historyAdditions.length >= historyTarget - existingHistoryIds.size) continue;
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
if (failures.length === SEASONS.length * 2) {
  throw new Error(`Не удалось загрузить ни одну сезонную таблицу: ${failures.join(' | ')}`);
}
if (historyTotal < historyTarget) {
  throw new Error(`Недостаточно подтверждённых игроков для цели ${historyTarget}: собрано ${historyTotal}, новых ${historyAdditions.length}. История не перезаписывается.`);
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
  sourceUrl: `${BASE}/en/stats/players/{season}/?stage={regular|playoff}`,
  importedAt: new Date().toISOString(),
  seasons: SEASONS.map(item => item.label),
  players: outputPlayers
};
await fs.writeFile(OUTPUT_FILE, '/* Сезонная статистика ВХЛ; формируется tools/vhl-player-stats-sync.mjs. */\nwindow.VHL_PLAYER_STATS_DATA = ' + JSON.stringify(payload) + ';\n', 'utf8');

const report = [
  '# Отчёт импорта статистики игроков ВХЛ', '',
  `- Игроков в текущих составах: ${rosterPlayers.size}`,
  `- Игроков с сезонной статистикой за выбранные сезоны: ${Object.keys(outputPlayers).length}`,
  `- Игроков в карьерной истории после импорта: ${historyTotal}`,
  `- Новых игроков добавлено в карьерную историю: ${historyAdditions.length}`,
  `- Сезоны: ${SEASONS.map(item => item.label).join(', ')}`,
  `- Дата импорта: ${payload.importedAt}`, '',
  '## Загруженные таблицы',
  ...pageReports,
  '', '## Ошибки',
  ...(failures.length ? failures.map(value => '- ' + value) : ['- Нет'])
].join('\n');
await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
console.log(report);
