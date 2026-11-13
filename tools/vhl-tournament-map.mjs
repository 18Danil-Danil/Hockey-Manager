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
  const selects = [...String(html).matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
  const select = selects.find(match => /\bname\s*=\s*["']tournament["']/i.test(match[1]));
  if (!select) throw new Error('В календаре ВХЛ не найден select[name="tournament"].');

  const tournaments = [];
  const seen = new Set();
  for (const option of select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const value = /\bvalue\s*=\s*["']([^"']+)["']/i.exec(option[1])?.[1] || '';
    const tnMatch = /\/calendar\/(\d+)\//i.exec(decodeHtml(value));
    const label = plainText(option[2]);
    const seasonMatch = /(\d{2,4})\s*\/\s*(\d{2,4})/.exec(label);
    if (!tnMatch || !seasonMatch) continue;

    const stageText = label.toLowerCase();
    const stage = /play.?offs?|плей.?офф/i.test(stageText) ? 'playoff'
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
    throw new Error('В списке турниров ВХЛ не удалось распознать ни одного сезона и этапа.');
  }
  return tournaments.sort((a, b) => b.endYear - a.endYear || (a.stage === 'regular' ? -1 : 1));
}
