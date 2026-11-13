/* Единый каталог лиг и источников статистики.
   Новая лига добавляется здесь и в конфигурацию клубов; импортёр должен
   сохранять единый формат игрока, сезон и статистику без генерации фиктивных строк. */
window.HOCKEY_LEAGUE_REGISTRY = {
  schemaVersion: 1,
  playerSchema: ['key','league','club','name','position','nationality','gp','g','a','pim','pm','svPct','gaa','w','l','so','statsSource'],
  leagues: [
    {id:'vhl',name:'ВХЛ',country:'Россия',status:'active',dataset:'VHL_PLAYER_STATS_DATA',rosters:'VHL_ROSTER_DATA',source:'https://www.vhlru.ru/',importMode:'official-tournament-seasons'},
    {id:'khl',name:'КХЛ',country:'Россия',status:'active',dataset:'INTERNATIONAL_PLAYER_STATS_DATA',source:'https://www.sport-express.net/hockey/L/khl/2026-2027/statistic/',importMode:'verified-season-snapshot'},
    {id:'belarus',name:'Betera-Экстралига',country:'Беларусь',status:'active',dataset:'INTERNATIONAL_PLAYER_STATS_DATA',source:'https://scangoal.com/hockey/league/belarus-extraleague',importMode:'verified-season-snapshot'},
    {id:'kazakhstan',name:'Pro Hokei Ligasy',country:'Казахстан',status:'active',dataset:'INTERNATIONAL_PLAYER_STATS_DATA',source:'https://pro.ligasy.kz/ru/stats',importMode:'official-season-snapshot'},
    {id:'nhl',name:'NHL',country:'США / Канада',status:'planned',source:'https://www.nhl.com/stats/'},
    {id:'ahl',name:'AHL',country:'США / Канада',status:'planned',source:'https://theahl.com/stats/'},
    {id:'mhl',name:'МХЛ',country:'Россия',status:'planned',source:'https://mhl.ru/'},
    {id:'rhl',name:'РХЛ',country:'Россия',status:'planned',source:'https://rhl.fhr.ru/'},
    {id:'shl',name:'SHL',country:'Швеция',status:'active',source:'https://www.shl.se/'},
    {id:'liiga',name:'Liiga',country:'Финляндия',status:'active',source:'https://www.liiga.fi/'},
    {id:'del',name:'DEL',country:'Германия',status:'active',source:'https://www.penny-del.org/'},
    {id:'czech-extraliga',name:'Чешская Экстралига',country:'Чехия',status:'active',source:'https://www.hokej.cz/'},
    {id:'swiss-nl',name:'National League',country:'Швейцария',status:'active',source:'https://www.nationalleague.ch/'},
    {id:'slovakia-extraliga',name:'Extraliga',country:'Словакия',status:'active',source:'https://www.hockeyslovakia.sk/'},
    {id:'echl',name:'ECHL',country:'США / Канада',status:'planned',source:'https://echl.com/stats'}
  ]
};
