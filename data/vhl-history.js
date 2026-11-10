/* Исторические итоги чемпионатов ВХЛ с 2010/11 по 2025/26.
 * Назначение: единый источник исторических титулов, финалов и победителей регулярного сезона.
 * Не путать победителя регулярного чемпионата с обладателем главного трофея.
 */
window.VHL_HISTORICAL_SEASONS = [
  { season: '2010/11', participants: 20, champion: 'Рубин', championCity: 'Тюмень', finalist: 'Нефтяник', finalistCity: 'Альметьевск', regularWinner: 'Рубин', regularWinnerCity: 'Тюмень', status: 'completed' },
  { season: '2011/12', participants: 23, champion: 'Торос', championCity: 'Нефтекамск', finalist: 'Рубин', finalistCity: 'Тюмень', regularWinner: 'Рубин', regularWinnerCity: 'Тюмень', status: 'completed' },
  { season: '2012/13', participants: 27, champion: 'Торос', championCity: 'Нефтекамск', finalist: 'Сарыарка', finalistCity: 'Караганда', regularWinner: 'Сарыарка', regularWinnerCity: 'Караганда', status: 'completed' },
  { season: '2013/14', participants: 26, champion: 'Сарыарка', championCity: 'Караганда', finalist: 'Рубин', finalistCity: 'Тюмень', regularWinner: 'Торос', regularWinnerCity: 'Нефтекамск', status: 'completed' },
  { season: '2014/15', participants: 24, champion: 'Торос', championCity: 'Нефтекамск', finalist: 'Ижсталь', finalistCity: 'Ижевск', regularWinner: 'Сарыарка', regularWinnerCity: 'Караганда', status: 'completed' },
  { season: '2015/16', participants: 26, champion: 'Нефтяник', championCity: 'Альметьевск', finalist: 'Ижсталь', finalistCity: 'Ижевск', regularWinner: 'ТХК', regularWinnerCity: 'Тверь', status: 'completed' },
  { season: '2016/17', participants: 26, champion: 'Динамо', championCity: 'Балашиха', finalist: 'Торпедо', finalistCity: 'Усть-Каменогорск', regularWinner: 'Торпедо', regularWinnerCity: 'Усть-Каменогорск', status: 'completed' },
  { season: '2017/18', participants: 27, champion: 'Динамо', championCity: 'Санкт-Петербург', finalist: 'СКА-Нева', finalistCity: 'Санкт-Петербург', regularWinner: 'Динамо', regularWinnerCity: 'Санкт-Петербург', status: 'completed' },
  { season: '2018/19', participants: 29, champion: 'Сарыарка', championCity: 'Караганда', finalist: 'Рубин', finalistCity: 'Тюмень', regularWinner: 'СКА-Нева', regularWinnerCity: 'Санкт-Петербург', status: 'completed' },
  { season: '2019/20', participants: 34, champion: null, championCity: null, finalist: null, finalistCity: null, regularWinner: 'Звезда', regularWinnerCity: 'Москва', seasonWinner: 'Звезда', seasonWinnerCity: 'Москва', seasonSilver: 'Динамо СПб', seasonSilverCity: 'Санкт-Петербург', seasonBronze: 'СКА-Нева', seasonBronzeCity: 'Санкт-Петербург', status: 'season_awarded_playoffs_cancelled', note: 'Кубок Петрова не разыгран: плей-офф остановлен в четвертьфинале. 03.07.2020 ФХР и ВХЛ утвердили итоговые места: «Звезда» — победитель, «Динамо СПб» — серебряный призёр, СКА-Нева — бронзовый призёр Всероссийского соревнования.' },
  { season: '2020/21', participants: 26, champion: 'Югра', championCity: 'Ханты-Мансийск', finalist: 'Металлург', finalistCity: 'Новокузнецк', regularWinner: 'Югра', regularWinnerCity: 'Ханты-Мансийск', seasonSilver: 'Металлург', seasonSilverCity: 'Новокузнецк', seasonBronze: 'Рубин', seasonBronzeCity: 'Тюмень', status: 'completed', note: 'Югра выиграла Кубок Петрова и стала победителем регулярного чемпионата; Металлург — серебряный, Рубин — бронзовый призёр Всероссийского соревнования.' },
  { season: '2021/22', participants: 27, champion: 'Рубин', championCity: 'Тюмень', finalist: 'Динамо', finalistCity: 'Санкт-Петербург', regularWinner: 'Югра', regularWinnerCity: 'Ханты-Мансийск', status: 'completed' },
  { season: '2022/23', participants: 26, champion: 'Химик', championCity: 'Воскресенск', finalist: 'Сокол', finalistCity: 'Красноярск', regularWinner: 'Югра', regularWinnerCity: 'Ханты-Мансийск', status: 'completed' },
  { season: '2023/24', participants: 29, champion: 'Нефтяник', championCity: 'Альметьевск', finalist: 'АКМ', finalistCity: 'Тульская область', regularWinner: 'Молот', regularWinnerCity: 'Пермь', status: 'completed' },
  { season: '2024/25', participants: 33, champion: 'Торпедо-Горький', championCity: 'Нижний Новгород', finalist: 'Химик', finalistCity: 'Воскресенск', regularWinner: 'Металлург', regularWinnerCity: 'Новокузнецк', status: 'completed' },
  { season: '2025/26', participants: 32, champion: 'Югра', championCity: 'Ханты-Мансийск', finalist: 'Химик', finalistCity: 'Воскресенск', regularWinner: 'Металлург', regularWinnerCity: 'Новокузнецк', status: 'completed' }
];

// Сводные награды по историческим клубам, включая команды, которых нет в текущей базе.
window.VHL_HISTORICAL_CLUB_HONOURS = {
  'Звезда (Москва)': { championships: [], regularTitles: ['2019/20'], finals: [], seasonWins: ['2019/20'] },
  'Рубин (Тюмень)': { championships: ['2010/11', '2021/22'], regularTitles: ['2010/11', '2011/12'], finals: ['2011/12', '2013/14', '2018/19'], seasonBronzes: ['2020/21'] },
  'Торос (Нефтекамск)': { championships: ['2011/12', '2012/13', '2014/15'], regularTitles: ['2013/14'], finals: [] },
  'Сарыарка (Караганда)': { championships: ['2013/14', '2018/19'], regularTitles: ['2012/13', '2014/15'], finals: ['2012/13'] },
  'Нефтяник (Альметьевск)': { championships: ['2015/16', '2023/24'], regularTitles: [], finals: ['2010/11'] },
  'Динамо (Балашиха)': { championships: ['2016/17'], regularTitles: [], finals: [] },
  'Динамо СПб': { championships: ['2017/18'], regularTitles: ['2017/18'], finals: ['2021/22'] },
  'Югра (Ханты-Мансийск)': { championships: ['2020/21', '2025/26'], regularTitles: ['2020/21', '2021/22', '2022/23'], finals: [] },
  'Химик (Воскресенск)': { championships: ['2022/23'], regularTitles: [], finals: ['2024/25', '2025/26'] },
  'Торпедо-Горький (Нижний Новгород)': { championships: ['2024/25'], regularTitles: [], finals: [] },
  'Ижсталь (Ижевск)': { championships: [], regularTitles: [], finals: ['2014/15', '2015/16'] },
  'Торпедо (Усть-Каменогорск)': { championships: [], regularTitles: ['2016/17'], finals: ['2016/17'] },
  'Динамо (Санкт-Петербург)': { championships: ['2017/18'], regularTitles: ['2017/18'], finals: ['2021/22'], seasonSilvers: ['2019/20'] },
  'СКА-Нева (Санкт-Петербург)': { championships: [], regularTitles: ['2018/19'], finals: ['2017/18'], seasonBronzes: ['2019/20'] },
  'ТХК (Тверь)': { championships: [], regularTitles: ['2015/16'], finals: [] },
  'Металлург (Новокузнецк)': { championships: [], regularTitles: ['2024/25', '2025/26'], finals: ['2020/21'], seasonSilvers: ['2020/21'] },
  'Молот (Пермь)': { championships: [], regularTitles: ['2023/24'], finals: [] },
  'АКМ (Тульская область)': { championships: [], regularTitles: [], finals: ['2023/24'] },
  'Сокол (Красноярск)': { championships: [], regularTitles: [], finals: ['2022/23'] }
};


// Применяем проверенные исторические награды к действующим клубам по устойчивым slug.
// Названия команд в интерфейсе не меняются; ключи справочника — исторические идентификаторы.
const VHL_HONOURS_KEY_BY_SLUG = {
  zvezda: 'Звезда (Москва)',
  'ska-neva': 'СКА-Нева (Санкт-Петербург)',
  akm: 'АКМ (Тульская область)',
  'dinamo-spb': 'Динамо (Санкт-Петербург)',
  izhstal: 'Ижсталь (Ижевск)',
  khimik: 'Химик (Воскресенск)',
  metallurg: 'Металлург (Новокузнецк)',
  molot: 'Молот (Пермь)',
  neftyanik: 'Нефтяник (Альметьевск)',
  rubin: 'Рубин (Тюмень)',
  sokol: 'Сокол (Красноярск)',
  toros: 'Торос (Нефтекамск)',
  yugra: 'Югра (Ханты-Мансийск)'
};
if (Array.isArray(window.VHL_TEAMS)) {
  window.VHL_TEAMS.forEach(team => {
    const key = VHL_HONOURS_KEY_BY_SLUG[team.slug];
    const honours = key && window.VHL_HISTORICAL_CLUB_HONOURS[key];
    if (!honours) return;
    team.trophies = {
      ...(team.trophies || {}),
      petrov: [...honours.championships],
      regular: [...honours.regularTitles],
      finals: [...honours.finals],
      seasonWins: [...(honours.seasonWins || [])],
      seasonSilvers: [...(honours.seasonSilvers || [])],
      seasonBronzes: [...(honours.seasonBronzes || [])]
    };
  });
}
