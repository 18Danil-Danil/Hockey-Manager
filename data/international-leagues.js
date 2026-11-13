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
    clubs:[{id:'tappara',name:'Tappara',city:'Тампере',strength:1.10},{id:'ilves',name:'Ilves',city:'Тампере',strength:1.08},{id:'hifk-helsinki',name:'HIFK',city:'Хельсинки',strength:1.00},{id:'kiekko-espoo',name:'Kiekko-Espoo',city:'Эспоо',strength:1.00},{id:'jukurit',name:'Jukurit',city:'Миккели',strength:1.00},{id:'jyp',name:'JYP',city:'Ювяскюля',strength:1.00},{id:'tps',name:'TPS',city:'Турку',strength:1.00},{id:'hpk',name:'HPK',city:'Хямеэнлинна',strength:1.00},{id:'assat',name:'Ässät',city:'Пори',strength:1.00},{id:'jokerit',name:'Jokerit',city:'Хельсинки',strength:1.00},{id:'lukko',name:'Lukko',city:'Раума',strength:1.00},{id:'sport',name:'Vaasan Sport',city:'Вааса',strength:1.00},{id:'saipa',name:'SaiPa',city:'Лаппеэнранта',strength:1.00},{id:'karpat',name:'Kärpät',city:'Оулу',strength:1.00},{id:'kalpa',name:'KalPa',city:'Куопио',strength:1.00},{id:'kookoo',name:'KooKoo',city:'Коувола',strength:1.00}]
  },
  {
    id:'sweden-shl',region:'europe',country:'Швеция',countryCode:'SWE',
    leagueName:'Швеция · SHL',transferMultiplier:1.38,salaryMultiplier:1.28,
    minOvr:72,maxOvr:86,nationalities:['Швеция','Финляндия','Канада','Россия'],
    clubs:[{id:'frolunda',name:'Frölunda',city:'Гётеборг',strength:1.12},{id:'farjestad',name:'Färjestad',city:'Карлстад',strength:1.10},{id:'skelleftea',name:'Skellefteå AIK',city:'Шеллефтео',strength:1.00},{id:'vaxjo',name:'Växjö Lakers',city:'Векшё',strength:1.00},{id:'brynas',name:'Brynäs IF',city:'Евле',strength:1.00},{id:'rogle',name:'Rögle BK',city:'Энгельхольм',strength:1.00},{id:'malmo',name:'Malmö Redhawks',city:'Мальмё',strength:1.00},{id:'malmo-redhawks',name:'Malmö Redhawks',city:'Мальмё',strength:1.00},{id:'orebro',name:'Örebro HK',city:'Эребру',strength:1.00},{id:'lulea',name:'Luleå HF',city:'Лулео',strength:1.00},{id:'djurgarden',name:'Djurgårdens IF',city:'Стокгольм',strength:1.00},{id:'timra',name:'Timrå IK',city:'Тимро',strength:1.00},{id:'hv71',name:'HV71',city:'Йёнчёпинг',strength:1.00},{id:'linkoping',name:'Linköping HC',city:'Линчёпинг',strength:1.00}]
  },
  {
    id:'czech-extraliga',region:'europe',country:'Чехия',countryCode:'CZE',
    leagueName:'Чехия · Extraliga',transferMultiplier:1.18,salaryMultiplier:1.08,
    minOvr:69,maxOvr:83,nationalities:['Чехия','Словакия','Канада','Россия'],
    clubs:[{id:'pardubice',name:'Dynamo Pardubice',city:'Пардубице',strength:1.12},{id:'trinec',name:'Oceláři Třinec',city:'Тршинец',strength:1.10},{id:'sparta-praha',name:'HC Sparta Praha',city:'Прага',strength:1.00},{id:'energie-karlovy-vary',name:'Energie Karlovy Vary',city:'Карловы Вары',strength:1.00},{id:'kladno',name:'Rytíři Kladno',city:'Кладно',strength:1.00},{id:'motor-ceske-budejovice',name:'Motor České Budějovice',city:'Ческе-Будеёвице',strength:1.00},{id:'kometa-brno',name:'Kometa Brno',city:'Брно',strength:1.00}]
  },
  {
    id:'germany-del',region:'europe',country:'Германия',countryCode:'GER',
    leagueName:'Германия · DEL',transferMultiplier:1.24,salaryMultiplier:1.16,
    minOvr:70,maxOvr:84,nationalities:['Германия','Канада','США','Россия'],
    clubs:[{id:'eisbaren-berlin',name:'Eisbären Berlin',city:'Берлин',strength:1.10},{id:'adler-mannheim',name:'Adler Mannheim',city:'Мангейм',strength:1.08},{id:'loewen-frankfurt',name:'Löwen Frankfurt',city:'Франкфурт',strength:1.00},{id:'nuernberg',name:'Nürnberg Ice Tigers',city:'Нюрнберг',strength:1.00},{id:'augsburger-panther',name:'Augsburger Panther',city:'Аугсбург',strength:1.00},{id:'fischtown',name:'Fischtown Pinguins',city:'Бремерхафен',strength:1.00},{id:'ehc-munich',name:'EHC München',city:'Мюнхен',strength:1.00},{id:'iserlohn',name:'Iserlohn Roosters',city:'Изерлон',strength:1.00},{id:'straubing',name:'Straubing Tigers',city:'Штраубинг',strength:1.00},{id:'koelner-haie',name:'Kölner Haie',city:'Кёльн',strength:1.00},{id:'krefeld-pinguine',name:'Krefeld Pinguine',city:'Крефельд',strength:1.00}]
  },
  {
    id:'switzerland-nl',region:'europe',country:'Швейцария',countryCode:'SUI',
    leagueName:'Швейцария · National League',transferMultiplier:1.48,salaryMultiplier:1.38,
    minOvr:73,maxOvr:87,nationalities:['Швейцария','Канада','Финляндия','Швеция'],
    clubs:[{id:'zsc-lions',name:'ZSC Lions',city:'Цюрих',strength:1.14},{id:'ev-zug',name:'EV Zug',city:'Цуг',strength:1.12},{id:'ambri-piotta',name:'HC Ambrì-Piotta',city:'Амбри',strength:1.00},{id:'ajoie',name:'HC Ajoie',city:'Поррантрюи',strength:1.00},{id:'fribourg',name:'HC Fribourg-Gottéron',city:'Фрибур',strength:1.00},{id:'scl-tigers',name:'SCL Tigers',city:'Лангнау',strength:1.00},{id:'ehc-kloten',name:'EHC Kloten',city:'Клотен',strength:1.00},{id:'lausanne',name:'Lausanne HC',city:'Лозанна',strength:1.00},{id:'davos',name:'HC Davos',city:'Давос',strength:1.00},{id:'sc-bern',name:'SC Bern',city:'Берн',strength:1.00},{id:'geneve-servette',name:'Genève-Servette HC',city:'Женева',strength:1.00},{id:'biel-bienne',name:'EHC Biel-Bienne',city:'Биль',strength:1.00},{id:'rapperswil',name:'SC Rapperswil-Jona Lakers',city:'Рапперсвиль',strength:1.00},{id:'lugano',name:'HC Lugano',city:'Лугано',strength:1.00}]
  },
  {
    id:'slovakia-extraliga',region:'europe',country:'Словакия',countryCode:'SVK',
    leagueName:'Словакия · Extraliga',transferMultiplier:1.02,salaryMultiplier:0.96,
    minOvr:67,maxOvr:81,nationalities:['Словакия','Чехия','Россия','Канада'],
    clubs:[{id:'kosice',name:'HC Košice',city:'Кошице',strength:1.06},{id:'slovan-bratislava',name:'Slovan Bratislava',city:'Братислава',strength:1.08},{id:'spisska-nova-ves',name:'HK Spišská Nová Ves',city:'Спишска-Нова-Вес',strength:1.00},{id:'nitra',name:'HK Nitra',city:'Нитра',strength:1.00},{id:'poprad',name:'HK Poprad',city:'Попрад',strength:1.00},{id:'banska-bystrica',name:'HC Banská Bystrica',city:'Банска-Бистрица',strength:1.00},{id:'dukla-trencin',name:'HK Dukla Trenčín',city:'Тренчин',strength:1.00},{id:'vlci-zilina',name:'Vlci Žilina',city:'Жилина',strength:1.00},{id:'liptovsky-mikulas',name:'HK 32 Liptovský Mikuláš',city:'Липтовски-Микулаш',strength:1.00},{id:'dukla-michalovce',name:'HK Dukla Michalovce',city:'Михаловце',strength:1.00},{id:'presov',name:'HC Prešov',city:'Прешов',strength:1.00},{id:'zilina',name:'Vlci Žilina',city:'Жилина',strength:1.00}]
  },
  {
    id:'khl', region:'russia', country:'Россия', countryCode:'RUS',
    leagueName:'Континентальная хоккейная лига (КХЛ)', transferMultiplier:1.55, salaryMultiplier:1.55,
    minOvr:76, maxOvr:90, nationalities:['Россия','Беларусь','Казахстан','Канада','США','Финляндия','Швеция','Чехия','Словакия'],
    clubs:[
      {id:'khl-cska',name:'ЦСКА',city:'Москва',strength:1.04},
      {id:'khl-lokomotiv',name:'Локомотив',city:'Ярославль',strength:1.04},
      {id:'khl-torpedo',name:'Торпедо',city:'Нижний Новгород',strength:1.02},
      {id:'khl-severstal',name:'Северсталь',city:'Череповец',strength:1.00},
      {id:'khl-spartak',name:'Спартак',city:'Москва',strength:1.00},
      {id:'khl-shanghai',name:'Шанхай Дрэгонс',city:'Шанхай',strength:1.00},
      {id:'khl-dynamo-minsk',name:'Динамо Минск',city:'Минск',strength:1.00},
      {id:'khl-dynamo-moscow',name:'Динамо Москва',city:'Москва',strength:1.00},
      {id:'khl-ska',name:'СКА',city:'Санкт-Петербург',strength:1.00},
      {id:'khl-sochi',name:'ХК Сочи',city:'Сочи',strength:0.96},
      {id:'khl-lada',name:'Лада',city:'Тольятти',strength:0.96},
      {id:'khl-metallurg',name:'Металлург Магнитогорск',city:'Магнитогорск',strength:1.04},
      {id:'khl-neftekhimik',name:'Нефтехимик',city:'Нижнекамск',strength:1.00},
      {id:'khl-ak-bars',name:'Ак Барс',city:'Казань',strength:1.02},
      {id:'khl-avangard',name:'Авангард',city:'Омск',strength:1.02},
      {id:'khl-amur',name:'Амур',city:'Хабаровск',strength:0.98},
      {id:'khl-barys',name:'Барыс',city:'Астана',strength:0.98},
      {id:'khl-avtomobilist',name:'Автомобилист',city:'Екатеринбург',strength:1.02},
      {id:'khl-traktor',name:'Трактор',city:'Челябинск',strength:1.02},
      {id:'khl-salavat',name:'Салават Юлаев',city:'Уфа',strength:1.00},
      {id:'khl-admiral',name:'Адмирал',city:'Владивосток',strength:0.96},
      {id:'khl-sibir',name:'Сибирь',city:'Новосибирск',strength:0.96}
    ]
  }
];