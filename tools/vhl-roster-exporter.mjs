#!/usr/bin/env node
/* One-team VHL roster exporter for the Hockey Manager prototype.
 * Usage: node tools/vhl-roster-exporter.mjs 378 ryazan-vdv
 * Fetches one public team page and writes a normalized JSON file.
 * This is a technical prototype, not permission to redistribute VHL data.
 */
import fs from 'node:fs/promises';

const [teamPageIdArg, teamSlugArg] = process.argv.slice(2);
const teamPageId = Number(teamPageIdArg);
const teamSlug = String(teamSlugArg || '').trim();
if (!Number.isInteger(teamPageId) || teamPageId <= 0 || !/^[a-z0-9-]{2,40}$/.test(teamSlug)) {
  console.error('Usage: node tools/vhl-roster-exporter.mjs <team-page-id> <game-team-slug>');
  process.exit(1);
}

const url = `https://www.vhlru.ru/teams/${teamPageId}/`;
const response = await fetch(url, {
  headers: { 'User-Agent': 'HockeyManager-VHL-roster-prototype/0.1 (manual single-team import)' }
});
if (!response.ok) throw new Error(`VHL returned HTTP ${response.status}`);
const html = await response.text();

function decode(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOf(value) {
  return decode(value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function parseTable(tableHtml) {
  const players = [];
  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1];
    const idMatch = row.match(/href=["'][^"']*\/players\/(\d+)\/[^"']*["']/i);
    if (!idMatch) continue;
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => textOf(match[1]));
    if (cells.length < 4) continue;
    const playerId = Number(idMatch[1]);
    const positionText = cells.find(value => /вратарь|защитник|нападающ/i.test(value)) || '';
    const position = /вратарь/i.test(positionText) ? 'goaltender'
      : /защитник/i.test(positionText) ? 'defense'
      : /нападающ/i.test(positionText) ? 'forward' : null;
    const born = cells.find(value => /^\d{2}\.\d{2}\.\d{4}$/.test(value)) || '';
    const name = cells.find(value => value.length > 3 && /[А-ЯЁа-яё]/.test(value) && !/^\d+$/.test(value) &&
      !/вратарь|защитник|нападающ/i.test(value) && value !== born) || '';
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
  return players;
}

const marker = html.search(/Основной\s+состав/i);
if (marker < 0) throw new Error('Не найден раздел «Основной состав» на странице ВХЛ.');
const tableStart = html.indexOf('<table', marker);
const tableEnd = html.indexOf('</table>', tableStart);
if (tableStart < 0 || tableEnd < 0) throw new Error('Не удалось найти таблицу основного состава.');
const players = parseTable(html.slice(tableStart, tableEnd + 8));
if (players.length < 20) {
  throw new Error(`Получено только ${players.length} игроков. Экспорт остановлен: проверьте структуру страницы вручную.`);
}
const ids = new Set();
const uniquePlayers = players.filter(player => !ids.has(player.playerId) && ids.add(player.playerId));
const rosterAsOf = (textOf(html.slice(Math.max(0, marker - 6000), marker)).match(/По состоянию на\s+(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || null;
const output = {
  schemaVersion: 1,
  source: 'vhlru',
  sourceUrl: url,
  exportedAt: new Date().toISOString(),
  teams: [{
    teamPageId, teamSlug, teamName: teamSlug,
    rosterAsOf, players: uniquePlayers
  }]
};
const outputPath = `vhl-${teamSlug}-roster.json`;
await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Exported ${uniquePlayers.length} players from ${url} -> ${outputPath}`);
console.log('Review the generated JSON and verify source permissions before redistribution.');
