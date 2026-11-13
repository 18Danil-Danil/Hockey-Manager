import assert from 'node:assert/strict';
import { parseVhlTournamentOptions } from '../tools/vhl-tournament-map.mjs';

const html = `
<select name="tournament">
  <option value="/en/calendar/1374/0/">2025/2026 | Regular Season</option>
  <option value="/en/calendar/1375/0/">2025/2026 | Playoffs</option>
  <option value="/en/calendar/1310/0/">2024/2025 | Regular Season</option>
  <option value="/en/calendar/1311/0/">2024/2025 | Playoffs</option>
</select>`;

const parsed = parseVhlTournamentOptions(html);
assert.deepEqual(parsed, [
  { endYear: 2026, stage: 'regular', tn: 1374, label: '2025/2026 | Regular Season' },
  { endYear: 2026, stage: 'playoff', tn: 1375, label: '2025/2026 | Playoffs' },
  { endYear: 2025, stage: 'regular', tn: 1310, label: '2024/2025 | Regular Season' },
  { endYear: 2025, stage: 'playoff', tn: 1311, label: '2024/2025 | Playoffs' }
]);

assert.throws(() => parseVhlTournamentOptions('<html></html>'));
console.log('VHL tournament mapping checks passed.');
