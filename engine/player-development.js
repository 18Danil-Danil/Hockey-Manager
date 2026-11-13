/* ============================================================
   ТРЕНИРОВКИ / РАЗВИТИЕ / КАРЬЕРА
   ============================================================ */
const DEV_FOCUSES = {
  attack:      { label: 'Атака', attrs: ['shooting', 'passing'] },
  defense:     { label: 'Защита', attrs: ['defense', 'iq'] },
  physical:    { label: 'Физика', attrs: ['physical', 'skating'] },
  reflexes:    { label: 'Реакция', attrs: ['reflexes'], goalie: true },
  positioning: { label: 'Позиция', attrs: ['positioning', 'stick'], goalie: true },
};
function setDevelopmentFocus(player, key) { player.developmentFocus = key; }
function developPlayer(p, team) {
  const isG = p.position === 'G'; p.fatigue = 0; p.injury = null; p.playingThroughPain = false;
  if (p.age <= 27) {
    const growth = p.age <= 21 ? 3 : p.age <= 24 ? 2 : 1;
    const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
    const focus = p.developmentFocus ? DEV_FOCUSES[p.developmentFocus] : null;
    for (let i = 0; i < growth; i++) {
      const cands = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (!cands.length) break;
      let pool = cands;
      if (focus) { const fc = cands.filter(a => focus.attrs.includes(a)); if (fc.length && rng() < 0.7) pool = fc; }
      p.attrs[pick(pool)]++;
    }
    const mentor = getMentor(team, p.id);
    const mentorBonus = mentor ? 0.30 : 0;
    if (mentor) p.mentorName = mentor.name; else p.mentorName = null;
    const youthBonus = getYouthLineBonus(team, p.id);
    const extraChance = ((team?.infrastructure?.youthAcademy || 0) * 0.08) + ((team?.staff?.youthCoach?.level || 0) * 0.05) + ((team?.infrastructure?.training || 0) * 0.03) + youthBonus + mentorBonus;
    if (rng() < extraChance) { const elig = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (elig.length) p.attrs[pick(elig)]++; }
  } else if (p.age >= 32) {
    const decline = isG ? ['reflexes', 'stick'] : ['skating', 'physical']; const a = pick(decline);
    p.attrs[a] = Math.max(40, p.attrs[a] - 1);
  }
  p.ovr = overallFromAttrs(p.attrs, isG); p.pot = overallFromAttrs(p.attrPot, isG);
  p.age++; p.contract.years--;
  if (p.contract.years <= 0) p.status = p.age < 28 ? 'rfa' : 'ufa';
}
function developPlayers(teams) { teams.forEach(t => t.roster.forEach(p => developPlayer(p, t))); }
