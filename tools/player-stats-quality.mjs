export function findSuspiciousCrossSeasonDuplicates(players) {
  const suspicious = [];
  for (const [playerId, player] of Object.entries(players || {})) {
    const signatures = new Map();
    for (const row of player.seasons || []) {
      const signature = JSON.stringify(Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== 'season' && key !== 'stage')
      ));
      const previous = signatures.get(signature);
      if (previous && (previous.season !== row.season || previous.stage !== row.stage)) {
        suspicious.push({
          playerId,
          first: { season: previous.season, stage: previous.stage, team: previous.team },
          repeated: { season: row.season, stage: row.stage, team: row.team }
        });
      } else {
        signatures.set(signature, row);
      }
    }
  }
  return suspicious;
}

