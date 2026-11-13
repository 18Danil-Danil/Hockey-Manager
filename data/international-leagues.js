/* Зарубежные хоккейные лиги. Реальные ростеры загружаются из international-player-stats.js. */
window.INTERNATIONAL_LEAGUES = [
  {
    id:'kazakhstan', region:'kazakhstan', country:'Казахстан', countryCode:'KAZ',
    leagueName:'Pro Hokei Ligasy', transferMultiplier:0.88, salaryMultiplier:0.82,
    minOvr:64, maxOvr:78, nationalities:['Казахстан','Россия','Беларусь'],
    clubs:[
      {id:'arlan-kokshetau',name:'Арлан',city:'Кокшетау',strength:1.04,sourceName:'Arlan Kokshetau'},
      {id:'saryarka-karaganda',name:'Сарыарка',city:'Караганда',strength:1.02,sourceName:'Saryarka Karaganda'},
      {id:'nomad-astana',name:'Номад',city:'Астана',strength:1.08,sourceName:'Nomad Astana'},
      {id:'torpedo-oskemen',name:'Торпедо',city:'Усть-Каменогорск',strength:1.08,sourceName:'Torpedo Ust-Kamenogorsk'},
      {id:'gornyak-rudny',name:'Горняк',city:'Рудный',strength:1.00,sourceName:'Gornyak Rudny'},
      {id:'kulager-petropavlovsk',name:'Кулагер',city:'Петропавловск',strength:0.98,sourceName:'Kulager Petropavlovsk'},
      {id:'almaty',name:'Алматы',city:'Алматы',strength:0.94,sourceName:'HK Almaty'},
      {id:'aktobe',name:'Актобе',city:'Актобе',strength:0.92,sourceName:'HK Aktobe'},
      {id:'ertis-pavlodar',name:'Ертис',city:'Павлодар',strength:0.88,sourceName:'Ertis Pavlodar'},
      {id:'beibarys-atyrau',name:'Бейбарыс',city:'Атырау',strength:0.94,sourceName:'Beibarys Atyrau'}
    ]
  },
  {
    id:'belarus', region:'belarus', country:'Беларусь', countryCode:'BLR',
    leagueName:'Betera-Экстралига', transferMultiplier:0.94, salaryMultiplier:0.88,
    minOvr:65, maxOvr:80, nationalities:['Беларусь','Россия'],
    clubs:[
      {id:'yunost-minsk',name:'Юность',city:'Минск',strength:1.08,sourceName:'Yunost Minsk'},
      {id:'shakhtyor-soligorsk',name:'Шахтёр',city:'Солигорск',strength:1.06,sourceName:'Shakhter Soligorsk'},
      {id:'neman-grodno',name:'Неман',city:'Гродно',strength:1.02,sourceName:'Neman Grodno'},
      {id:'gomel',name:'Гомель',city:'Гомель',strength:1.00,sourceName:'HK Gomel'},
      {id:'metallurg-zhlobin',name:'Металлург',city:'Жлобин',strength:1.06,sourceName:'Metallurg Zhlobin'},
      {id:'brest',name:'Брест',city:'Брест',strength:0.98,sourceName:'HK Brest'},
      {id:'vitebsk',name:'Витебск',city:'Витебск',strength:0.98,sourceName:'HK Vitebsk'},
      {id:'lida',name:'Лида',city:'Лида',strength:0.96,sourceName:'HK Lida'},
      {id:'aviator-baranovichi',name:'Авиатор',city:'Барановичи',strength:0.92,sourceName:'Aviator Baranovichi'},
      {id:'lokomotiv-orsha',name:'Локомотив',city:'Орша',strength:0.94,sourceName:'Lokomotiv Orsha'},
      {id:'mogilev',name:'Могилёв',city:'Могилёв',strength:0.92,sourceName:'HK Mogilev'},
      {id:'dinamo-molodechno',name:'Динамо-Молодечно',city:'Молодечно',strength:1.00,sourceName:'Dinamo-Molodechno'},
      {id:'khimik-novopolotsk',name:'Химик',city:'Новополоцк',strength:0.90,sourceName:'Khimik Novopolotsk'},
      {id:'slavutich-smolensk',name:'Славутич',city:'Смоленск',strength:0.98,sourceName:'Slavutich Smolensk'}
    ]
  },
  {
    id:'finland-liiga',region:'europe',country:'Финляндия',countryCode:'FIN',
    leagueName:'Финляндия · Liiga',transferMultiplier:1.28,salaryMultiplier:1.18,
    minOvr:70,maxOvr:84,nationalities:['Финляндия','Швеция','Канада','Россия'],
    clubs:[{id:'tappara',name:'Tappara',city:'Тампере',strength:1.10},{id:'ilves',name:'Ilves',city:'Тампере',strength:1.08}]
  },
  {
    id:'sweden-shl',region:'europe',country:'Швеция',countryCode:'SWE',
    leagueName:'Швеция · SHL',transferMultiplier:1.38,salaryMultiplier:1.28,
    minOvr:72,maxOvr:86,nationalities:['Швеция','Финляндия','Канада','Россия'],
    clubs:[{id:'frolunda',name:'Frölunda',city:'Гётеборг',strength:1.12},{id:'farjestad',name:'Färjestad',city:'Карлстад',strength:1.10}]
  },
  {
    id:'czech-extraliga',region:'europe',country:'Чехия',countryCode:'CZE',
    leagueName:'Чехия · Extraliga',transferMultiplier:1.18,salaryMultiplier:1.08,
    minOvr:69,maxOvr:83,nationalities:['Чехия','Словакия','Канада','Россия'],
    clubs:[{id:'pardubice',name:'Dynamo Pardubice',city:'Пардубице',strength:1.12},{id:'trinec',name:'Oceláři Třinec',city:'Тршинец',strength:1.10}]
  },
  {
    id:'germany-del',region:'europe',country:'Германия',countryCode:'GER',
    leagueName:'Германия · DEL',transferMultiplier:1.24,salaryMultiplier:1.16,
    minOvr:70,maxOvr:84,nationalities:['Германия','Канада','США','Россия'],
    clubs:[{id:'eisbaren-berlin',name:'Eisbären Berlin',city:'Берлин',strength:1.10},{id:'adler-mannheim',name:'Adler Mannheim',city:'Мангейм',strength:1.08}]
  },
  {
    id:'switzerland-nl',region:'europe',country:'Швейцария',countryCode:'SUI',
    leagueName:'Швейцария · National League',transferMultiplier:1.48,salaryMultiplier:1.38,
    minOvr:73,maxOvr:87,nationalities:['Швейцария','Канада','Финляндия','Швеция'],
    clubs:[{id:'zsc-lions',name:'ZSC Lions',city:'Цюрих',strength:1.14},{id:'ev-zug',name:'EV Zug',city:'Цуг',strength:1.12}]
  },
  {
    id:'slovakia-extraliga',region:'europe',country:'Словакия',countryCode:'SVK',
    leagueName:'Словакия · Extraliga',transferMultiplier:1.02,salaryMultiplier:0.96,
    minOvr:67,maxOvr:81,nationalities:['Словакия','Чехия','Россия','Канада'],
    clubs:[{id:'kosice',name:'HC Košice',city:'Кошице',strength:1.06},{id:'slovan-bratislava',name:'Slovan Bratislava',city:'Братислава',strength:1.08}]
  }
];
