/* Каталог клубов МХЛ и РХЛ сезона 2026/27.
   Источники — официальные сайты лиг. Логотипы подключаются через logoUrl,
   а при отсутствии локального файла UI должен показывать текстовый fallback.
   Важно: внешние URL пока являются источниками, не офлайн-копиями. */

window.YOUTH_LEAGUE_CLUBS = {
  schemaVersion: 1,
  season: '2026/27',
  leagues: [
    {
      id: 'mhl',
      name: 'МХЛ',
      country: 'Россия / Беларусь / Казахстан',
      source: 'https://mhl.khl.ru/game/',
      leagueLogoUrl: 'https://mhl.khl.ru/local/templates/mhl2022/i/2026/JHL_Logo_OLIMP_Four_2026_2027_RU_plus_text.svg',
      logoProvider: 'https://img.khl.ru/clubs/ru/{logoId}/40.png',
      clubs: [
        {id:'academy-mikhailov',name:'Академия Михайлова',city:'Тульская область',conference:'Запад',division:'Золотой',logoId:671},
        {id:'dynamo-shinnik',name:'Динамо-Шинник',city:'Бобруйск',conference:'Запад',division:'Золотой',logoId:322},
        {id:'krasnaya-armiya',name:'Красная Армия',city:'Москва',conference:'Запад',division:'Золотой',logoId:222},
        {id:'loko',name:'Локо',city:'Ярославль',conference:'Запад',division:'Золотой',logoId:215},
        {id:'dynamo-moscow',name:'МХК Динамо-Москва',city:'Москва',conference:'Запад',division:'Золотой',logoId:224},
        {id:'dynamo-spb',name:'МХК Динамо Санкт-Петербург',city:'Санкт-Петербург',conference:'Запад',division:'Золотой',logoId:422},
        {id:'spartak',name:'МХК Спартак',city:'Москва',conference:'Запад',division:'Золотой',logoId:217},
        {id:'ska-1946',name:'СКА-1946',city:'Санкт-Петербург',conference:'Запад',division:'Золотой',logoId:220},
        {id:'taifun',name:'Тайфун',city:'Приморский край',conference:'Запад',division:'Золотой',logoId:569},
        {id:'academy-ska',name:'Академия СКА',city:'Санкт-Петербург',conference:'Запад',division:'Серебряный',logoId:454},
        {id:'almaz',name:'Алмаз',city:'Череповец',conference:'Запад',division:'Серебряный',logoId:214},
        {id:'amur-tigers',name:'Амурские Тигры',city:'Хабаровск',conference:'Запад',division:'Серебряный',logoId:275},
        {id:'red-machine-atlant',name:'Красная Машина Атлант',city:'Московская область',conference:'Запад',division:'Серебряный',logoId:218},
        {id:'red-machine-junior',name:'Красная Машина Юниор',city:'Московская область',conference:'Запад',division:'Серебряный',logoId:920},
        {id:'krylya-sovetov',name:'Крылья Советов',city:'Москва',conference:'Запад',division:'Серебряный',logoId:258},
        {id:'spartak-max',name:'МХК Спартак МАХ',city:'Москва',conference:'Запад',division:'Серебряный',logoId:914},
        {id:'sakhalin-sharks',name:'Сахалинские Акулы',city:'Сахалинская область',conference:'Запад',division:'Серебряный',logoId:385},
        {id:'avto',name:'Авто',city:'Екатеринбург',conference:'Восток',division:'Золотой',logoId:225},
        {id:'white-bears',name:'Белые Медведи',city:'Челябинск',conference:'Восток',division:'Золотой',logoId:227},
        {id:'irbis',name:'Ирбис',city:'Казань',conference:'Восток',division:'Золотой',logoId:226},
        {id:'loko-76',name:'Локо-76',city:'Ярославль',conference:'Восток',division:'Золотой',logoId:425},
        {id:'omskie-yastreby',name:'Омские Ястребы',city:'Омск',conference:'Восток',division:'Золотой',logoId:230},
        {id:'siberian-snipers',name:'Сибирские Снайперы',city:'Новосибирская область',conference:'Восток',division:'Золотой',logoId:232},
        {id:'steel-foxes',name:'Стальные Лисы',city:'Магнитогорск',conference:'Восток',division:'Золотой',logoId:233},
        {id:'tolpar',name:'Толпар',city:'Уфа',conference:'Восток',division:'Золотой',logoId:234},
        {id:'chaika',name:'Чайка',city:'Нижний Новгород',conference:'Восток',division:'Золотой',logoId:223},
        {id:'akm-junior',name:'АКМ-Юниор',city:'Тульская область',conference:'Восток',division:'Серебряный',logoId:790},
        {id:'krasnoyarsk-lynx',name:'Красноярские Рыси',city:'Красноярск',conference:'Восток',division:'Серебряный',logoId:264},
        {id:'kuznetsk-bears',name:'Кузнецкие Медведи',city:'Новокузнецк',conference:'Восток',division:'Серебряный',logoId:228},
        {id:'mammoths-yugra',name:'Мамонты Югры',city:'Ханты-Мансийск',conference:'Восток',division:'Серебряный',logoId:320},
        {id:'molot',name:'МХК Молот',city:'Пермь',conference:'Восток',division:'Серебряный',logoId:435},
        {id:'reaktor',name:'Реактор',city:'Нижнекамск',conference:'Восток',division:'Серебряный',logoId:231},
        {id:'snow-bary',name:'Снежные Барсы',city:'Астана',conference:'Восток',division:'Серебряный',logoId:321},
        {id:'sputnik-almetyevsk',name:'Спутник Альметьевск',city:'Альметьевск',conference:'Восток',division:'Серебряный',logoId:386}
      ]
    },
    {
      id: 'rhl',
      name: 'РХЛ',
      country: 'Россия',
      source: 'https://rhl.fhr.ru/teams/',
      leagueLogoUrl: 'https://fhr.ru/upload/resize_cache/iblock/630/800_600_2/Montazhnaya-oblast-1-kopiya-3-_5_.png',
      logoProvider: null,
      clubs: [
        {id:'arktika',name:'Арктика',city:'Мурманская область',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/66/'},
        {id:'ahmat-granit',name:'Ахмат-Гранит',city:'Чеченская Республика',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/74/'},
        {id:'vityaz-podolsk',name:'Витязь-Подольск',city:'Подольск',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/88/'},
        {id:'dynamo-576',name:'Динамо-576',city:'Санкт-Петербург',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/60/'},
        {id:'kaluga-rockets',name:'Калужские Ракеты',city:'Калуга',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/78/'},
        {id:'red-machine-academy',name:'Красная Машина Академия',city:'Московская область',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/89/'},
        {id:'leningradets',name:'Ленинградец',city:'Ленинградская область',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/80/'},
        {id:'dynamo-karelia',name:'МХК Динамо-Карелия',city:'Кондопога',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/59/'},
        {id:'metallurg-cherepovets',name:'Металлург',city:'Вологодская область',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/56/'},
        {id:'polet',name:'Полёт',city:'Рыбинск',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/54/'},
        {id:'tverichi',name:'Тверичи-СШОР',city:'Тверь',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/31/'},
        {id:'fakel-yamal',name:'Факел Ямал',city:'Салехард',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/67/'},
        {id:'bryansk',name:'ХК Брянск',city:'Брянск',conference:'Запад',teamPage:'https://rhl.fhr.ru/teams/44/'},
        {id:'dizelist',name:'Дизелист',city:'Пенза',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/2/'},
        {id:'belgorod',name:'МХК Белгород',city:'Белгород',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/27/'},
        {id:'ermak',name:'МХК Ермак',city:'Ангарск',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/16/'},
        {id:'kristall',name:'МХК Кристалл',city:'Саратов',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/57/'},
        {id:'rostov',name:'МХК Ростов',city:'Ростов-на-Дону',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/87/'},
        {id:'ryazan-vdv',name:'МХК Рязань-ВДВ',city:'Рязань',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/22/'},
        {id:'tambov',name:'МХК Тамбов',city:'Мичуринск',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/69/'},
        {id:'progress',name:'Прогресс',city:'Глазов',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/9/'},
        {id:'proton',name:'Протон',city:'Нововоронеж',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/70/'},
        {id:'sokol-chuvashia',name:'Сокол',city:'Чувашская Республика',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/61/'},
        {id:'krasnodar',name:'ХК Краснодар',city:'Краснодарский край',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/75/'},
        {id:'samara',name:'ХК Самара',city:'Самара',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/81/'},
        {id:'econiva-bobrov',name:'ЭкоНива-Бобров',city:'Бобров',conference:'Восток',teamPage:'https://rhl.fhr.ru/teams/64/'}
      ]
    }
  ]
};

// Возвращает официальный источник эмблемы, если он установлен.
// До появления локального SVG/PNG интерфейс обязан использовать безопасный fallback.
window.getYouthClubLogoUrl = function(leagueId, clubId) {
  const league = window.YOUTH_LEAGUE_CLUBS.leagues.find(item => item.id === leagueId);
  const club = league?.clubs.find(item => item.id === clubId);
  if (!league || !club) return null;
  if (league.id === 'mhl' && club.logoId) return league.logoProvider.replace('{logoId}', club.logoId);
  if (league.id === 'rhl' && club.teamPage) {
    const teamId = club.teamPage.match(/\\/teams\\/(\\d+)\\//)?.[1];
    if (teamId) return 'https://ss.fhr.ru/files/images/league/teams/200_200/' + teamId + '.png?1=';
  }
  return club.logoUrl || null;
};
