#!/usr/bin/env node
/* Сбор сезонной статистики игроков ВХЛ по публичным карточкам игроков.
 * Данные используются как приблизительная основа игровых рейтингов.
 * Скрипт проверяет robots.txt, работает последовательно и делает паузу между запросами.
 */
import fs from 'node:fs/promises';

const BASE = 'https://www.vhlru.ru';
const USER_AGENT = 'HockeyManagerVHLStatsBot/1.0 (low-frequency statistics import)';
const INPUT_FILE = 'data/vhl-rosters.js';
const OUTPUT_FILE = 'data/vhl-player-stats.js';
const REPORT_FILE = 'vhl-player-stats-report.md';
const DELAY_MS = 1350;
const SEASONS = lastCompletedSeasons();

function lastCompletedSeasons(now = new Date()) {
  const currentStartYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [1, 2, 3].map(offset => {
    const start = currentStartYear - offset;
    return String(start).slice(-2) + '/' + String(start + 1).slice(-2);
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
function robotsAllowsPlayers(robotsText) {
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
    .filter(rule => rule.path && ('/players/'.startsWith(rule.path) || rule.path.startsWith('/players/')))
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

function parsePlayerProfile(html, expectedPosition, wantedSeasons) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => ({
    html: match[1], cells: cellsOf(match[1])
  }));
  let season = null, stage = null;
  const seasons = [];
  for (const row of rows) {
    const c = row.cells;
    if (c.length >= 2 && /^\d{2}\/\d{2}$/.test(c[0]) &&
        /регулярн|плей-офф/i.test(c[1])) {
      season = c[0];
      stage = /плей-офф/i.test(c[1]) ? 'playoff' : 'regular';
      continue;
    }
    if (!season || !stage || !wantedSeasons.includes(season) || c.length < 15) continue;
    // Строки команд содержат название клуба, номер игрока и статистические показатели.
    if (!/^\d{1,2}$/.test(c[1] || '')) continue;
    if (expectedPosition === 'goaltender') {
      if (c.length < 16) continue;
      const gp = numeric(c[2]);
      if (!gp) continue;
      seasons.push({
        season, stage, gp, team: c[0], wins: numeric(c[3]), losses: numeric(c[4]),
        shotsAgainst: numeric(c[6]), goalsAgainst: numeric(c[7]), saves: numeric(c[8]),
        savePct: numeric(c[9]), gaa: numeric(c[10]), goals: numeric(c[11]),
        assists: numeric(c[12]), shutouts: numeric(c[13]), pim: numeric(c[14]),
        minutes: minutes(c[15])
      });
    } else {
      if (c.length < 24) continue;
      const gp = numeric(c[2]);
      if (!gp) continue;
      seasons.push({
        season, stage, gp, team: c[0], goals: numeric(c[3]), assists: numeric(c[4]),
        points: numeric(c[5]), plusMinus: numeric(c[6]), pim: numeric(c[7]),
        ppGoals: numeric(c[9]), shots: numeric(c[14]), shootingPct: numeric(c[15]),
        faceoffs: numeric(c[17]), faceoffsWon: numeric(c[18]), faceoffPct: numeric(c[19]),
        toiPerGame: minutes(c[20]), shiftsPerGame: numeric(c[21]),
        hits: numeric(c[22]), blocks: numeric(c[23])
      });
    }
  }
  return seasons;
}

const sourceText = await fs.readFile(INPUT_FILE, 'utf8');
const rosterMatch = sourceText.match(/window\.VHL_ROSTER_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
if (!rosterMatch) throw new Error('Не удалось прочитать data/vhl-rosters.js.');
const rosterData = JSON.parse(rosterMatch[1]);
const players = new Map();
for (const team of rosterData.teams || []) {
  for (const player of team.players || []) {
    if (player.playerId && player.position) players.set(String(player.playerId), {
      playerId: Number(player.playerId), position: player.position
    });
  }
}
if (!players.size) throw new Error('В текущей базе составов не найдено игроков.');

const robotsResponse = await fetch(`${BASE}/robots.txt`, {
  headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/plain' },
  signal: AbortSignal.timeout(15000)
});
if (!robotsResponse.ok) throw new Error(`Не удалось проверить robots.txt: HTTP ${robotsResponse.status}`);
if (!robotsAllowsPlayers(await robotsResponse.text())) {
  throw new Error('robots.txt не разрешает автоматическое обращение к /players/. Сбор остановлен.');
}

const outputPlayers = {};
const failures = [];
let withStats = 0;
let processed = 0;
for (const [id, player] of players) {
  processed++;
  try {
    const html = await getText(`${BASE}/players/${id}/`);
    const seasons = parsePlayerProfile(html, player.position, SEASONS);
    if (seasons.length) {
      outputPlayers[id] = { position: player.position, seasons };
      withStats++;
    }
  } catch (error) {
    failures.push(`${id}: ${error.message}`);
  }
  if (processed % 50 === 0) console.log(`Обработано ${processed}/${players.size}; статистика найдена у ${withStats}`);
  if (processed < players.size) await sleep(DELAY_MS);
}

if (withStats < Math.min(50, Math.ceil(players.size * 0.2))) {
  throw new Error(`Слишком мало профилей со статистикой: ${withStats}/${players.size}. Старую базу не перезаписываем.`);
}

const HISTORY_FILE = 'data/player-league-history.js';
const historyText = await fs.readFile(HISTORY_FILE, 'utf8');
const existingHistoryIds = new Set(
  [...historyText.matchAll(/^\\s{4}"(\\d+)":\\s*\\{/gm)].map(match => match[1])
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
    `    // Источник: https://www.vhlru.ru/players/${id}/ — сезонная статистика по официальной карточке игрока.\n` +
    `    "${id}": ${JSON.stringify({ position: playerStats.position, seasons })}`
  );
}
const historyTotal = existingHistoryIds.size + historyAdditions.length;
if (historyTotal < historyTarget) {
  throw new Error(`Недостаточно подтверждённых профилей для цели ${historyTarget}: собрано ${historyTotal}. История не перезаписывается.`);
}
if (historyAdditions.length) {
  const updatedHistory = historyText.replace(
    /\\n  }\\n};\\s*$/,
    '\\n' + historyAdditions.join(',\\n') + ',\\n  }\\n};\\n'
  );
  if (updatedHistory === historyText) throw new Error('Не удалось безопасно обновить конец player-league-history.js.');
  await fs.writeFile(HISTORY_FILE, updatedHistory, 'utf8');
}

const payload = {
  schemaVersion: 1, source: 'vhlru', sourceUrl: `${BASE}/players/{playerId}/`,
  importedAt: new Date().toISOString(), seasons: SEASONS, players: outputPlayers
};
await fs.writeFile(OUTPUT_FILE, '/* Сезонная статистика ВХЛ; формируется tools/vhl-player-stats-sync.mjs. */\nwindow.VHL_PLAYER_STATS_DATA = ' + JSON.stringify(payload) + ';\n', 'utf8');
const report = [
  '# Отчёт импорта статистики игроков ВХЛ', '',
  `- Игроков в текущих составах: ${players.size}`,
  `- Профилей со статистикой за выбранные сезоны: ${withStats}`,\n  `- Игроков в карьерной истории после импорта: ${historyTotal}`,\n  `- Новых игроков добавлено в карьерную историю: ${historyAdditions.length}`,
  `- Сезоны: ${SEASONS.join(', ')}`,
  `- Дата импорта: ${payload.importedAt}`,
  `- Ошибок загрузки: ${failures.length}`, '',
  '## Ошибки',
  ...(failures.length ? failures.slice(0, 100).map(value => '- ' + value) : ['- Нет'])
].join('\n');
await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
console.log(report);
