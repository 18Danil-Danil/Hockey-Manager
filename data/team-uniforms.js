/* Авторские игровые комплекты для 30 клубов ВХЛ.
 * Палитры основаны на публичной клубной айдентике/цветах эмблем.
 * Это оригинальные игровые дизайны, не копии официальных свитеров и не используют клубные логотипы.
 * Домашний комплект тёмный, гостевой светлый — по принципу регламента ВХЛ.
 */
window.VHL_JERSEYS = {
  'akm': { primary:'#A71930', secondary:'#171717', accent:'#D5B15B', pattern:'diagonal' },
  'bars': { primary:'#08764B', secondary:'#0D3B2A', accent:'#D7B34A', pattern:'yoke' },
  'buran': { primary:'#174A83', secondary:'#75B8E8', accent:'#F2F7FC', pattern:'shoulders' },
  'gornyak': { primary:'#20252B', secondary:'#E2B323', accent:'#F4F4F4', pattern:'hoops' },
  'dizel': { primary:'#17191D', secondary:'#F0C52E', accent:'#F7F7F7', pattern:'diagonal' },
  'dinamo-spb': { primary:'#174A91', secondary:'#DDEBFA', accent:'#FFFFFF', pattern:'yoke' },
  'dinamo-altai': { primary:'#1D4E91', secondary:'#8CB5E2', accent:'#F5F8FC', pattern:'stripe' },
  'zauralye': { primary:'#12608F', secondary:'#DDEBF4', accent:'#C92735', pattern:'diagonal' },
  'zvezda': { primary:'#C51E32', secondary:'#F5F5F5', accent:'#171717', pattern:'yoke' },
  'izhstal': { primary:'#B51F35', secondary:'#171717', accent:'#F4F4F4', pattern:'stripe' },
  'kaluga': { primary:'#B51F32', secondary:'#1E355B', accent:'#F4F4F4', pattern:'diagonal' },
  'kristall': { primary:'#0877B9', secondary:'#CDEBFA', accent:'#FFFFFF', pattern:'shoulders' },
  'magnitka': { primary:'#17365E', secondary:'#B62332', accent:'#F4F4F4', pattern:'stripe' },
  'metallurg': { primary:'#B5121B', secondary:'#171717', accent:'#F5F5F5', pattern:'hoops' },
  'molot': { primary:'#B51F2C', secondary:'#17191D', accent:'#F3F3F3', pattern:'yoke' },
  'neftyanik': { primary:'#176B48', secondary:'#102B20', accent:'#F2F5F1', pattern:'diagonal' },
  'norilsk': { primary:'#087D98', secondary:'#12334A', accent:'#F1F7FA', pattern:'shoulders' },
  'olimpiya': { primary:'#174B87', secondary:'#DCEBFA', accent:'#D8B34D', pattern:'stripe' },
  'omskie-krylya': { primary:'#B71932', secondary:'#183451', accent:'#F4F4F4', pattern:'diagonal' },
  'rubin': { primary:'#9F1831', secondary:'#173A60', accent:'#F5F5F5', pattern:'yoke' },
  'ryazan-vdv': { primary:'#174477', secondary:'#C62838', accent:'#F4F6F8', pattern:'stripe' },
  'ska-vmf': { primary:'#173D70', secondary:'#D9E7F7', accent:'#FFFFFF', pattern:'yoke' },
  'sokol': { primary:'#17191D', secondary:'#C32635', accent:'#F5F5F5', pattern:'diagonal' },
  'tambov': { primary:'#142F50', secondary:'#4F8CB8', accent:'#F5F7FA', pattern:'hoops' },
  'toros': { primary:'#176B45', secondary:'#DDEFE4', accent:'#E0BD53', pattern:'stripe' },
  'khimik': { primary:'#174C86', secondary:'#DDEAF7', accent:'#C92736', pattern:'yoke' },
  'csk-vvs': { primary:'#174B83', secondary:'#C62837', accent:'#F4F5F7', pattern:'diagonal' },
  'chelmet': { primary:'#202124', secondary:'#D8B13D', accent:'#F5F5F5', pattern:'shoulders' },
  'yugra': { primary:'#08734D', secondary:'#123D31', accent:'#F3F7F3', pattern:'hoops' },
  'yuzhny-ural': { primary:'#17191D', secondary:'#C62836', accent:'#F4F4F4', pattern:'diagonal' },
};

window.getTeamJersey = function(team, side) {
  const slug = team && (team.slug || (window.VHL_TEAMS || []).find(t => t.id === team.id)?.slug);
  const palette = window.VHL_JERSEYS[slug] || {
    primary:'#334155', secondary:'#94A3B8', accent:'#FFFFFF', pattern:'stripe'
  };
  return side === 'away'
    ? { base:'#F4F6F8', secondary:palette.primary, accent:palette.secondary, pattern:palette.pattern }
    : { base:palette.primary, secondary:palette.secondary, accent:palette.accent, pattern:palette.pattern };
};
