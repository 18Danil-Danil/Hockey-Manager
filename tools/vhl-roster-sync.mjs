#!/usr/bin/env node
/**
 * Автоматическая выгрузка составов текущих клубов ВХЛ.
 * Результат хранится только в GitHub Actions Artifact, не коммитится в репозиторий.
 * Node.js 20+.
 */
import fs from 'node:fs/promises';

const BASE = 'https://www.vhlru.ru';
const USER_AGENT = 'HockeyManagerVHLRosterBot/1.0 (GitHub Actions; low-frequency roster sync)';
const OUTPUT_FILE = 'vhl-rosters.json';
const REPORT_FILE = 'vhl-roster-sync-report.md';
const DELAY_MS = 1200;

const TEAMS = [
  ['akm', 'АКМ'], ['bars', 'Барс'], ['buran', 'Буран'],
  ['gornyak', 'Горняк-УГМК'], ['dizel', 'Дизель'],
  ['dinamo-spb', 'Динамо СПб'], ['dinamo-altai', 'Динамо-Алтай'],
  ['zauralye', 'Зауралье'], ['zvezda', 'Звезда'], ['izhstal', 'Ижсталь'],
  ['kaluga', 'Калуга'], ['kristall', 'Кристалл'], ['magnitka', 'Магнитка'],
  ['metallurg', 'Металлург'], ['molot', 'Молот'], ['neftyanik', 'Нефтяник'],
  ['norilsk', 'ХК Норильск'], ['olimpiya', 'Олимпия'],
  ['omskie-krylya', 'Омские Крылья'], ['rubin', 'Рубин'],
  ['ryazan-vdv', 'Рязань-ВДВ'], ['ska-vmf', 'СКА-ВМФ'], ['sokol', 'Сокол'],
  ['tambov', 'ХК Тамбов'], ['toros', 'Торос'], ['khimik', 'Химик'],
  ['csk-vvs', 'ЦСК ВВС'], ['chelmet', 'Челмет'], ['yugra', 'Югра'],
  ['yuzhny-ural', 'Южный Урал']
].map(([slug, name]) => ({ slug, name }));

const requestedTeam = process.argv.includes('--team')
  ? process.argv[process.argv.indexOf('--team') + 1]
  : 'all';

function decode(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOf(value) {
  return decode(value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function normalize(value) {
  return String(value || '').toLocaleLowerCase('ru')
    .replace(/^хк\s*/i, '').replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html, text/plain;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} при запросе ${url}`);
  return response.text();
}

function robotsAllowsTeams(robotsText) {
  const lines = robotsText.split(/\r?\n/).map(line => line.split('#')[0].trim()).filter(Boolean);
  const groups = [];
  let current = null;
  for (const line of lines) {
    const match = /^(user-agent|disallow|allow)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
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
  const applicable = groups.filter(group =>
    group.agents.includes('*') || group.agents.some(agent => USER_AGENT.toLowerCase().includes(agent))
  );
  const rules = applicable.flatMap(group => group.rules)
    .filter(rule => rule.path && ('/teams/'.startsWith(rule.path) || rule.path.startsWith('/teams/')))
    .sort((a, b) => b.path.length - a.path.length);
  if (!rules.length) return true;
  return rules[0].type === 'allow';
}

async function discoverTeams() {
  const robotsResponse = await fetch(`${BASE}/robots.txt`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/plain' },
    signal: AbortSignal.timeout(15000)
  });
  if (!robotsResponse.ok) {
    throw new Error(`Не удалось проверить robots.txt (HTTP ${robotsResponse.status}); автоматическая загрузка остановлена.`);
  }
  const robots = await robotsResponse.text();
  if (!robotsAllowsTeams(robots)) {
    throw new Error('robots.txt запрещает автоматическое обращение к разделу /teams/. Загрузка остановлена.');
  }

  const html = await getText(`${BASE}/teams/`);
  const links = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href=["'](?:https?:\/\/www\.vhlru\.ru)?\/teams\/(\d+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = Number(match[1]);
    const label = textOf(match[2]);
    if (id && label) links.set(id, label);
  }

  const discovered = [];
  const missing = [];
  for (const team of TEAMS) {
    const wanted = normalize(team.name);
    const found = [...links.entries()].find(([, label]) => {
      const actual = normalize(label);
      return actual === wanted || actual.startsWith(wanted);
    });
    if (!found) missing.push(team.name);
    else discovered.push({ ...team, teamPageId: found[0], directoryLabel: found[1] });
  }
  if (discovered.length < 25) {
    throw new Error(`В каталоге распознано только ${discovered.length} из ${TEAMS.length} клубов. Выгрузка остановлена, чтобы не получить неполную базу.`);
  }
  return { discovered, missing };
}

function parseRoster(html, team) {
  const marker = html.search(/Основной\s+состав/i);
  if (marker < 0) throw new Error('На странице не найден раздел «Основной состав».');
  const tableStart = html.indexOf('<table', marker);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('Не найдена таблица основного состава.');

  const table = html.slice(tableStart, tableEnd + 8);
  const players = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1];
    const idMatch = row.match(/href=["'][^"']*\/players\/(\d+)\/?[^"']*["']/i);
    if (!idMatch) continue;
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(match => textOf(match[1]));
    if (cells.length < 4) continue;
    const playerId = Number(idMatch[1]);
    const role = cells.find(value => /вратарь|защитник|нападающ/i.test(value)) || '';
    const position = /вратарь/i.test(role) ? 'goaltender'
      : /защитник/i.test(role) ? 'defense'
      : /нападающ/i.test(role) ? 'forward' : null;
    const born = cells.find(value => /^\d{2}\.\d{2}\.\d{4}$/.test(value)) || '';
    const name = cells.find(value => value.length > 3 && /[А-ЯЁа-яё]/i.test(value) &&
      !/^\d+$/.test(value) && !/вратарь|защитник|нападающ/i.test(value) && value !== born) || '';
    const jerseyCell = cells.find(value => /^\d{1,2}$/.test(value));
    const bornIndex = cells.indexOf(born);
    const country = bornIndex >= 0 ? (cells[bornIndex + 1] || '') : '';
    if (!position || !name) continue;
    players.push({
      playerId, name, position,
      jersey: jerseyCell === undefined ? null : Number(jerseyCell),
      born: born || null, country,
      heightCm: null, weightKg: null
    });
  }

  const unique = [...new Map(players.map(player => [player.playerId, player])).values()];
  const counts = {
    forwards: unique.filter(player => player.position === 'forward').length,
    defensemen: unique.filter(player => player.position === 'defense').length,
    goalies: unique.filter(player => player.position === 'goaltender').length
  };
  if (unique.length < 20 || counts.forwards < 12 || counts.defensemen < 6 || counts.goalies < 2) {
    throw new Error(`Состав не прошёл проверку: ${unique.length} игроков; нападающие ${counts.forwards}, защитники ${counts.defensemen}, вратари ${counts.goalies}.`);
  }
  const markerText = textOf(html.slice(Math.max(0, marker - 8000), marker));
  const rosterAsOf = (markerText.match(/По состоянию на\s+(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || null;
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    teamPageId: team.teamPageId,
    teamSlug: team.slug,
    teamName: heading ? textOf(heading[1]) : team.name,
    rosterAsOf,
    players: unique
  };
}

const startedAt = new Date().toISOString();
const results = [];
const failures = [];
let teamList = [];
try {
  const directory = await discoverTeams();
  teamList = requestedTeam === 'all'
    ? directory.discovered
    : directory.discovered.filter(team => team.slug === requestedTeam);
  if (requestedTeam !== 'all' && !teamList.length) {
    throw new Error(`Клуб «${requestedTeam}» не найден в актуальном каталоге ВХЛ или не сопоставлен с командами игры.`);
  }
  if (directory.missing.length) failures.push(`Не сопоставлены клубы: ${directory.missing.join(', ')}`);

  for (let index = 0; index < teamList.length; index++) {
    const team = teamList[index];
    try {
      console.log(`[${index + 1}/${teamList.length}] ${team.name}: ${BASE}/teams/${team.teamPageId}/`);
      const html = await getText(`${BASE}/teams/${team.teamPageId}/`);
      results.push(parseRoster(html, team));
      console.log(`  OK: ${results.at(-1).players.length} игроков`);
    } catch (error) {
      failures.push(`${team.name}: ${error.message}`);
      console.error(`  ERROR: ${error.message}`);
    }
    if (index < teamList.length - 1) await sleep(DELAY_MS);
  }
} catch (error) {
  failures.push(error.message);
}

const totalPlayers = results.reduce((sum, team) => sum + team.players.length, 0);
const output = {
  schemaVersion: 1,
  source: 'vhlru',
  sourceUrl: `${BASE}/teams/`,
  exportedAt: new Date().toISOString(),
  teams: results
};
await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
await fs.writeFile('data/vhl-rosters.js', '/* Автоматически обновляется GitHub Actions. Не редактировать вручную. */\nwindow.VHL_ROSTER_DATA = ' + JSON.stringify(output) + ';\n', 'utf8');

const report = [
  '# Отчёт синхронизации составов ВХЛ',
  '',
  `- Начало: ${startedAt}`,
  `- Завершение: ${new Date().toISOString()}`,
  `- Режим: ${requestedTeam}`,
  `- Успешно клубов: ${results.length}/${teamList.length}`,
  `- Игроков: ${totalPlayers}`,
  '',
  '## Успешно обработаны',
  ...(results.length ? results.map(team => `- ${team.teamName}: ${team.players.length} игроков; дата состава: ${team.rosterAsOf || 'не указана'}`) : ['- Нет']),
  '',
  '## Замечания и ошибки',
  ...(failures.length ? failures.map(message => `- ${message}`) : ['- Нет']),
  '',
  '> Данные сохранены как артефакт GitHub Actions и не коммитятся в репозиторий. Указание источника не заменяет разрешение на автоматизированное получение и повторное использование материалов.'
].join('\n');
await fs.writeFile(REPORT_FILE, report + '\n', 'utf8');
console.log(report);

if (!results.length || failures.length) process.exitCode = 1;
