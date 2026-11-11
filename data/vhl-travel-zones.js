/* Официальные логистические группы ВХЛ сезона 2026/27.
   Источник: https://www.vhlru.ru/lenta/604817/ */
window.VHL_TRAVEL_ZONES = {
  season: '2026/27',
  sourceUrl: 'https://www.vhlru.ru/lenta/604817/',
  zones: [
    { id: 1, name: 'Санкт-Петербург и Москва', shortName: 'Северо-Запад', teams: ['ska-vmf', 'dinamo-spb', 'zvezda', 'khimik'] },
    { id: 2, name: 'Центральная', shortName: 'Центральная', teams: ['buran', 'tambov', 'dizel', 'kristall'] },
    { id: 3, name: 'Рязанско-тульско-калужская', shortName: 'Рязань — Тула — Калуга', teams: ['kaluga', 'akm', 'ryazan-vdv'] },
    { id: 4, name: 'Поволжье', shortName: 'Поволжье', teams: ['csk-vvs', 'neftyanik', 'bars'] },
    { id: 5, name: 'Прикамье и Удмуртия', shortName: 'Прикамье', teams: ['olimpiya', 'izhstal', 'toros', 'molot'] },
    { id: 6, name: 'Южный Урал', shortName: 'Южный Урал', teams: ['yuzhny-ural', 'magnitka', 'chelmet', 'gornyak'] },
    { id: 7, name: 'Западная Сибирь', shortName: 'Западная Сибирь', teams: ['yugra', 'rubin', 'zauralye', 'omskie-krylya'] },
    { id: 8, name: 'Восточная Сибирь', shortName: 'Восточная Сибирь', teams: ['norilsk', 'sokol', 'metallurg', 'dinamo-altai'] },
  ],
};
window.VHL_TRAVEL_ZONE_BY_SLUG = {};
window.VHL_TRAVEL_ZONES.zones.forEach(zone => zone.teams.forEach(slug => {
  window.VHL_TRAVEL_ZONE_BY_SLUG[slug] = { id: zone.id, name: zone.name, shortName: zone.shortName };
}));
