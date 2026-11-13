/* Разбор официального списка турниров ВХЛ из select[name="tournament"]. */
function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function plainText(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVhlTournamentOptions(html) {
  const source = String(html);
  const selects = [...source.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
  const tournamentSelect = selects.find(match => /\bname\s*=\s*["']tournament["']/i.test(match[1]));
  // If the select name changes, inspect option lists but accept only calendar IDs with season/stage labels.
  const optionSource = tournamentSelect ? tournamentSelect[2] : source;

  const tournaments = [];
  const seen = new Set();
  for (const option of optionSource.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const value = /\bvalue\s*=\s*["']([^"']+)["']/i.exec(option[1])?.[1] || '';
    const tnMatch = /\/calendar\/(\d+)\//i.exec(decodeHtml(value));
    const label = plainText(option[2]);
    const seasonMatch = /(\d{2,4})\s*\/\s*(\d{2,4})/.exec(label);
    if (!tnMatch || !seasonMatch) continue;

    const stageText = label.toLowerCase();
    const stage = /playoffs?|плей.?офф/i.test(stageText) ? 'playoff'
      : /regular|регуляр/i.test(stageText) ? 'regular' : null;
    if (!stage) continue;

    let endYear = Number(seasonMatch[2]);
    if (endYear < 100) endYear += Math.floor(new Date().getUTCFullYear() / 100) * 100;
    if (endYear > new Date().getUTCFullYear() + 20) endYear -= 100;
    const tn = Number(tnMatch[1]);
    const key = endYear + ':' + stage;
    if (!Number.isSafeInteger(tn) || tn <= 0 || seen.has(key)) continue;
    seen.add(key);
    tournaments.push({ endYear, stage, tn, label });
  }

  if (!tournaments.length) {
    throw new Error('В календаре ВХЛ не удалось распознать ни одного ID турнира с сезоном и этапом.');
  }
  return tournaments.sort((a, b) => b.endYear - a.endYear || (Number(a.stage !== 'regular') - Number(b.stage !== 'regular')));
}
