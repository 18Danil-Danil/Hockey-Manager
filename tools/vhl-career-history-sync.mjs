#!/usr/bin/env node
/* Полная сезонная история ВХЛ по официальным карточкам игроков.
 * Источник: https://www.vhlru.ru/en/players/{id}/
 * Существующие сведения о других лигах и карьерные итоги сохраняются.
 */
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = 'https://www.vhlru.ru';
const USER_AGENT = 'HockeyManagerCareerHistoryBot/1.0 (low-frequency public statistics sync)';
const ROSTER_FILE = 'data/vhl-rosters.js';
const HISTORY_FILE = 'data/player-league-history.js';
const REPORT_FILE = 'vhl-career-history-report.md';
const DELAY_MS = 750;
const MAX_ATTEMPTS = 3;

function decode(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOf(value) {
  return decode(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function numeric(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  if (!normalized || normalized === '-' || normalized === '—') return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}
function cellsOf(row) {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => ({
    html: match[1],
    text: textOf(match[1])
  }));
}
export function parseVhlCareer(html) {
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const result = [];
  let currentSeason = null;
  let currentStage = null;

  for (const match of rows) {
    const cells = cellsOf(match[1]);
    if (cells.length < 2) continue;
    const rowText = cells.map(cell => cell.text).join(' ');
    const seasonMatch = /\b(\d{2}\/\d{2})\b/.exec(rowText);
    if (seasonMatch && /regular|play[\s-]?offs?/i.test(rowText)) {
      currentSeason = seasonMatch[1];
      currentStage = /play[\s-]?offs?/i.test(rowText) ? 'playoffs' : 'regular';
      continue;
    }
    if (!currentSeason || !currentStage || cells.length < 4) continue;
    const teamLink = cells[0].html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    if (!teamLink) continue;
    const team = textOf(teamLink[1]);
    const gp = numeric(cells[2].text);
    if (!team || gp === null || gp <= 0) continue;
    result.push({
      season: currentSeason,
      league: 'VHL',
      gp: Math.round(gp),
      team,
      stage: currentStage
    });
  }

  const unique = new Map();
  for (const row of result) {
    const key = [row.season, row.league, row.team, row.stage].join('|');
    const previous = unique.get(key);
    if (!previous || row.gp > previous.gp) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) =>
    b.season.localeCompare(a.season, 'en', { numeric: true }) ||
    (a.stage === b.stage ? 0 : a.stage === 'regular' ? -1 : 1) ||
    a.team.localeCompare(b.team)
  );
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
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], hasRules: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      current.rules.push({ type: key, path: value });
      current.hasRules = true;
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
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html, text/plain;q=0.9, */*;q=0.8' },
        signal: AbortSignal.timeout(25000)
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

function extractIds(sourceText, pattern) {
  return new Set([...sourceText.matchAll(pattern)].map(match => String(match[1])));
}
function findObjectEnd(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return i + 1;
  }
  throw new Error('Не удалось определить конец объекта игрока в истории.');
}
function seasonSignature(row) {
  return [row.season, row.league, row.team || '', row.stage || ''].join('|');
}
function readSeasonSignatures(block) {
  const match = block.match(/\bseasons\s*:\s*\[([\s\S]*?)\]/);
  if (!match) return new Set();
  const signatures = new Set();
  for (const item of match[1].matchAll(/\{([^{}]*)\}/g)) {
    const body = item[1];
    const season = body.match(/\bseason\s*:\s*["']([^"']+)["']/)?.[1];
    const league = body.match(/\bleague\s*:\s*["']([^"']+)["']/)?.[1];
    const team = body.match(/\bteam\s*:\s*["']([^"']+)["']/)?.[1] || '';
    const stage = body.match(/\bstage\s*:\s*["']([^"']+)["']/)?.[1] || '';
    if (season && league) signatures.add([season, league, team, stage].join('|'));
  }
  return signatures;
}
function formatRows(rows) {
  return rows.map(row => '        { season: ' + JSON.stringify(row.season) +
    ', league: "VHL", gp: ' + row.gp + ', team: ' + JSON.stringify(row.team) +
    ', stage: ' + JSON.stringify(row.stage) + ' }');
}
function mergePlayerSeasons(historyText, playerId, rows, position) {
  const marker = new RegExp('(^[ \\t]*)"' + playerId + '"\\s*:\\s*\\{', 'm');
  const match = marker.exec(historyText);
  if (!match) {
    const finalObject = /\n  }\n};\s*$/.exec(historyText);
    if (!finalObject) throw new Error('Не найден конец объекта players в player-league-history.js');
    const safePosition = ['forward', 'defense', 'goaltender'].includes(position) ? position : 'forward';
    const insertion = '    "' + playerId + '": { position: ' + JSON.stringify(safePosition) + ', seasons: [\n' +
      formatRows(rows).join(',\n') + '\n    ] },\n';
    return { text: historyText.slice(0, finalObject.index + 1) + insertion +
      historyText.slice(finalObject.index + 1), added: rows.length };
  }

  const openIndex = historyText.indexOf('{', match.index);
  const endIndex = findObjectEnd(historyText, openIndex);
  const block = historyText.slice(openIndex, endIndex);
  const existing = readSeasonSignatures(block);
  const additions = rows.filter(row => !existing.has(seasonSignature(row)));
  if (!additions.length) return { text: historyText, added: 0 };

  const seasonsMatch = /\bseasons\s*:\s*\[([\s\S]*?)\]/.exec(block);
  if (seasonsMatch) {
    const arrayClose = openIndex + seasonsMatch.index + seasonsMatch[0].lastIndexOf(']');
    const existingItems = seasonsMatch[1].trim();
    const prefix = existingItems ? ',\n' : '\n';
    const insertion = prefix + formatRows(additions).join(',\n') + '\n      ';
    return {
      text: historyText.slice(0, arrayClose) + insertion + historyText.slice(arrayClose),
      added: additions.length
    };
  }

  const objectClose = endIndex - 1;
  const insertion = ',\n      seasons: [\n' + formatRows(additions).join(',\n') + '\n      ]\n    ';
  return {
    text: historyText.slice(0, objectClose) + insertion + historyText.slice(objectClose),
    added: additions.length
  };
}

async function main() {
  const rosterText = await fs.readFile(ROSTER_FILE, 'utf8');
  const rosterMatch = rosterText.match(/window\.VHL_ROSTER_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!rosterMatch) throw new Error('Не удалось прочитать data/vhl-rosters.js');
  const rosterData = JSON.parse(rosterMatch[1]);
  const rosterPositions = new Map();
  for (const team of rosterData.teams || []) {
    for (const player of team.players || []) {
      if (player.playerId && player.position) rosterPositions.set(String(player.playerId), player.position);
    }
  }
  const rosterIds = extractIds(rosterText, /"playerId"\s*:\s*(\d+)/g);

  let historyText = await fs.readFile(HISTORY_FILE, 'utf8');
  const historyIds = extractIds(historyText, /^\s{4}"(\d+)":\s*\{/gm);
  const playerIds = [...new Set([...rosterIds, ...historyIds])].sort((a, b) => Number(a) - Number(b));
  if (!playerIds.length) throw new Error('Не найдено ни одного ID игрока для синхронизации.');

  const robotsResponse = await fetch(BASE + '/robots.txt', {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/plain' },
    signal: AbortSignal.timeout(15000)
  });
  if (!robotsResponse.ok) throw new Error('Не удалось проверить robots.txt: HTTP ' + robotsResponse.status);
  const robotsText = await robotsResponse.text();
  if (!robotsAllowsPath(robotsText, '/en/players/')) {
    throw new Error('robots.txt не разрешает автоматическое обращение к карточкам игроков. Сбор остановлен.');
  }

  let successful = 0, notFound = 0, empty = 0, addedSeasons = 0;
  const failures = [];
  const reportRows = [];

  for (let index = 0; index < playerIds.length; index++) {
    const id = playerIds[index];
    const url = BASE + '/en/players/' + id + '/';
    try {
      const html = await getText(url);
      if (html === null) {
        notFound++;
        reportRows.push('- ' + id + ': карточка не найдена (404)');
      } else {
        successful++;
        const rows = parseVhlCareer(html);
        if (!rows.length) {
          empty++;
          reportRows.push('- ' + id + ': страница доступна, сезонные строки не обнаружены');
        } else {
          const merged = mergePlayerSeasons(historyText, id, rows, rosterPositions.get(id));
          historyText = merged.text;
          addedSeasons += merged.added;
          reportRows.push('- ' + id + ': найдено ' + rows.length + ' сезонных строк, добавлено ' + merged.added);
        }
      }
    } catch (error) {
      failures.push(id + ': ' + error.message);
      reportRows.push('- ' + id + ': ошибка — ' + error.message);
    }
    if ((index + 1) % 50 === 0) console.log('Обработано ' + (index + 1) + '/' + playerIds.length);
    if (index + 1 < playerIds.length) await sleep(DELAY_MS);
  }

  const minimumSuccessful = Math.ceil(playerIds.length * 0.75);
  if (successful < minimumSuccessful) {
    throw new Error('Недостаточно успешно прочитанных карточек (' + successful + '/' + playerIds.length + '); файл истории не перезаписан.');
  }

  await fs.writeFile(HISTORY_FILE, historyText, 'utf8');
  const totalSeasonRows = [...historyText.matchAll(/\{\s*season\s*:/g)].length;
  const report = [
    '# Отчёт полной сезонной истории ВХЛ', '',
    '- Уникальных игроков в обработке: ' + playerIds.length,
    '- Карточек прочитано: ' + successful,
    '- Карточек 404: ' + notFound,
    '- Страниц без распознанной сезонной таблицы: ' + empty,
    '- Ошибок после повторных попыток: ' + failures.length,
    '- Новых сезонных записей добавлено: ' + addedSeasons,
    '- Всего сезонных записей в файле истории: ' + totalSeasonRows,
    '- Дата обновления: ' + new Date().toISOString(), '',
    '## Результат по игрокам',
    ...reportRows,
    '', '## Ошибки',
    ...(failures.length ? failures.map(value => '- ' + value) : ['- Нет'])
  ].join('\n');
  await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
