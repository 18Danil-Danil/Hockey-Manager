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
function cells(row) {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => ({
    html: match[1], text: textOf(match[1])
  }));
}
function number(value) {
  if (value == null || value === '' || value === '-' || value === '—') return null;
  const parsed = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function timeMinutes(value) {
  const match = /^(\d+):(\d{2})$/.exec(String(value || '').trim());
  return match ? Number(match[1]) + Number(match[2]) / 60 : null;
}
function cellValue(row, headers, key) {
  const index = headers.indexOf(key);
  return index < 0 ? null : row[index]?.text ?? null;
}
function stat(row, headers, key) {
  return number(cellValue(row, headers, key));
}
function verifyTournament(html, season, stage) {
  const select = /<select\b[^>]*name\s*=\s*["']?tournament["']?[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1];
  if (!select) throw new Error('На странице отсутствует селектор выбранного турнира');
  const option = /<option\b(?=[^>]*\bselected\b)[^>]*>([\s\S]*?)<\/option>/i.exec(select);
  if (!option) throw new Error('На странице не отмечен выбранный турнир');
  const label = textOf(option[1]).toLowerCase();
  const stageMatches = stage === 'regular' ? /regular season/.test(label) : /playoffs?/.test(label);
  if (!label.includes(season.toLowerCase()) || !stageMatches) {
    throw new Error('Источник вернул другой турнир: ' + label + ', ожидался ' + season + ' ' + stage);
  }
}
export function parseVhlSeasonStats(html, season, stage, rosterPlayers) {
  verifyTournament(html, season, stage);
  const result = new Map();
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  let parsedTables = 0;
  for (const tableMatch of tables) {
    const table = tableMatch[0];
    const headerMatch = /<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(table);
    if (!headerMatch) continue;
    const headers = cells(headerMatch[1]).map(cell => cell.text);
    const goalie = headers.includes('SOP') && headers.includes('Sv');
    const skater = headers.includes('PTS') && headers.includes('G') && headers.includes('A');
    if (!goalie && !skater) continue;
    parsedTables++;
    const body = table.slice(headerMatch.index + headerMatch[0].length);
    for (const tr of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = cells(tr[1]);
      const href = /href\s*=\s*["']([^"']*\/players\/(\d+)\/?(?:\?[^"']*)?)["']/i.exec(row[0]?.html || '') ||
        /\/players\/(\d+)\//i.exec(tr[1]);
      const id = href ? String(href[2] || href[1]) : null;
      if (!id || !rosterPlayers.has(id) || row.length < headers.length) continue;
      const player = rosterPlayers.get(id);
      const team = cellValue(row, headers, 'Team');
      const record = { season, stage, team: team || undefined, gp: stat(row, headers, 'GP') };
      if (goalie || player.position === 'goaltender') {
        Object.assign(record, {
          wins: stat(row, headers, 'W'),
          losses: stat(row, headers, 'L'),
          shotsAgainst: stat(row, headers, 'SOG'),
          goalsAgainst: stat(row, headers, 'GA'),
          saves: stat(row, headers, 'Sv'),
          savePct: stat(row, headers, '%Sv'),
          gaa: stat(row, headers, 'GAA'),
          goals: stat(row, headers, 'G'),
          assists: stat(row, headers, 'A'),
          shutouts: stat(row, headers, 'SO'),
          pim: stat(row, headers, 'PIM'),
          minutes: timeMinutes(cellValue(row, headers, 'TOI'))
        });
      } else {
        Object.assign(record, {
          goals: stat(row, headers, 'G'),
          assists: stat(row, headers, 'A'),
          points: stat(row, headers, 'PTS'),
          plusMinus: stat(row, headers, '+/-'),
          pim: stat(row, headers, 'PIM'),
          ppGoals: stat(row, headers, 'PPG'),
          shots: stat(row, headers, 'SOG'),
          shootingPct: stat(row, headers, '%SOG'),
          faceoffs: stat(row, headers, 'FO'),
          faceoffsWon: stat(row, headers, 'FOW'),
          faceoffPct: stat(row, headers, '%FO'),
          toiPerGame: timeMinutes(cellValue(row, headers, 'TOI/G')),
          shiftsPerGame: stat(row, headers, 'Sft/G'),
          hits: stat(row, headers, 'Hits'),
          blocks: stat(row, headers, 'BLS')
        });
      }
      if (!result.has(id)) result.set(id, []);
      result.get(id).push(record);
    }
  }
  if (!parsedTables) throw new Error('Не найдены распознаваемые таблицы статистики игроков');
  return result;
}
