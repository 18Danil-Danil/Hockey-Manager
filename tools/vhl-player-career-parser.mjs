function decode(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
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
function normalizeStage(value) {
  return /playoffs?/i.test(value) ? 'playoff' : /regular/i.test(value) ? 'regular' : null;
}

export function parseVhlPlayerCareer(html, playerId, fallbackPosition) {
  const source = String(html);
  const id = String(playerId);
  if (!new RegExp('/players/' + id + '/games/').test(source)) {
    throw new Error('Карточка ВХЛ не подтвердила ID игрока ' + id + '.');
  }
  const subtitle = source.match(/class=["'][^"']*player-card__subtitle[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  const positionText = subtitle ? textOf(subtitle[1]).toLowerCase() : '';
  const position = /goalkeeper|goaltender|вратар/i.test(positionText) ? 'goaltender'
    : /defen[cs]|защит/i.test(positionText) ? 'defense'
    : /forward|напада/i.test(positionText) ? 'forward' : fallbackPosition;
  const table = source.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) throw new Error('В карточке игрока ' + id + ' не найдена таблица карьеры ВХЛ.');

  const seasons = [];
  let scope = null;
  for (const match of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const cells = cellsOf(rowHtml);
    if (!cells.length) continue;
    const label = /^(\d{2,4}\/\d{2,4})\s*\|\s*(Regular Season|Playoffs?)$/i.exec(cells[0]);
    if (label) {
      scope = { season: label[1], stage: normalizeStage(label[2]) };
      continue;
    }
    if (!scope) continue;
    const teamLink = rowHtml.match(/href=["'][^"']*\/stats\/players\/(\d+)\/all\/(\d+)\/[^"']*["']/i);
    if (!teamLink) continue;

    const row = { ...scope, team: cells[0], gp: numeric(cells[2]) };
    if (!row.gp || row.gp <= 0) continue;
    if (position === 'goaltender') {
      if (cells.length < 16) continue;
      Object.assign(row, {
        wins: numeric(cells[3]), losses: numeric(cells[4]),
        shootoutsPlayed: numeric(cells[5]), shotsAgainst: numeric(cells[6]),
        goalsAgainst: numeric(cells[7]), saves: numeric(cells[8]),
        savePct: numeric(cells[9]), gaa: numeric(cells[10]),
        goals: numeric(cells[11]), assists: numeric(cells[12]),
        shutouts: numeric(cells[13]), pim: numeric(cells[14]),
        minutes: minutes(cells[15])
      });
    } else {
      if (cells.length < 24) continue;
      Object.assign(row, {
        goals: numeric(cells[3]), assists: numeric(cells[4]), points: numeric(cells[5]),
        plusMinus: numeric(cells[6]), pim: numeric(cells[7]), ppGoals: numeric(cells[9]),
        shots: numeric(cells[14]), shootingPct: numeric(cells[15]),
        faceoffs: numeric(cells[17]), faceoffsWon: numeric(cells[18]),
        faceoffPct: numeric(cells[19]), toiPerGame: minutes(cells[20]),
        shiftsPerGame: numeric(cells[21]), hits: numeric(cells[22]), blocks: numeric(cells[23])
      });
    }
    seasons.push(row);
  }
  return { position, seasons };
}
