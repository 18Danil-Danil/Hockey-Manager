/* Игровые справочники зарубежных хоккейных лиг.
   Составы клубов генерируются отдельно при создании карьеры. */
window.INTERNATIONAL_LEAGUES = [
  {
    id: 'kazakhstan', region: 'kazakhstan', country: 'Казахстан', countryCode: 'KAZ',
    leagueName: 'Чемпионат Казахстана', transferMultiplier: 0.88, salaryMultiplier: 0.82,
    minOvr: 64, maxOvr: 78,
    nationalities: ['Казахстан', 'Казахстан', 'Казахстан', 'Россия', 'Беларусь'],
    clubs: [
      { id: 'arlan-kokshetau', name: 'Арлан', city: 'Кокшетау', strength: 1.04 },
      { id: 'saryarka-karaganda', name: 'Сарыарка', city: 'Караганда', strength: 1.02 },
      { id: 'nomad-astana', name: 'Номад', city: 'Астана', strength: 1.08 },
      { id: 'torpedo-oskemen', name: 'Торпедо', city: 'Усть-Каменогорск', strength: 0.98 }
    ]
  },
  {
    id: 'belarus', region: 'belarus', country: 'Беларусь', countryCode: 'BLR',
    leagueName: 'Белорусская экстралига', transferMultiplier: 0.94, salaryMultiplier: 0.88,
    minOvr: 65, maxOvr: 80,
    nationalities: ['Беларусь', 'Беларусь', 'Беларусь', 'Россия', 'Канада'],
    clubs: [
      { id: 'yunost-minsk', name: 'Юность', city: 'Минск', strength: 1.08 },
      { id: 'shakhtyor-soligorsk', name: 'Шахтёр', city: 'Солигорск', strength: 1.06 },
      { id: 'neman-grodno', name: 'Неман', city: 'Гродно', strength: 1.02 },
      { id: 'gomel', name: 'Гомель', city: 'Гомель', strength: 0.98 }
    ]
  },
  {
    id: 'finland-liiga', region: 'europe', country: 'Финляндия', countryCode: 'FIN',
    leagueName: 'Финляндия · Liiga', transferMultiplier: 1.28, salaryMultiplier: 1.18,
    minOvr: 70, maxOvr: 84,
    nationalities: ['Финляндия', 'Финляндия', 'Швеция', 'Канада', 'Россия'],
    clubs: [
      { id: 'tappara', name: 'Tappara', city: 'Тампере', strength: 1.10 },
      { id: 'ilves', name: 'Ilves', city: 'Тампере', strength: 1.08 }
    ]
  },
  {
    id: 'sweden-shl', region: 'europe', country: 'Швеция', countryCode: 'SWE',
    leagueName: 'Швеция · SHL', transferMultiplier: 1.38, salaryMultiplier: 1.28,
    minOvr: 72, maxOvr: 86,
    nationalities: ['Швеция', 'Швеция', 'Финляндия', 'Канада', 'Россия'],
    clubs: [
      { id: 'frolunda', name: 'Frölunda', city: 'Гётеборг', strength: 1.12 },
      { id: 'farjestad', name: 'Färjestad', city: 'Карлстад', strength: 1.10 }
    ]
  },
  {
    id: 'czech-extraliga', region: 'europe', country: 'Чехия', countryCode: 'CZE',
    leagueName: 'Чехия · Extraliga', transferMultiplier: 1.18, salaryMultiplier: 1.08,
    minOvr: 69, maxOvr: 83,
    nationalities: ['Чехия', 'Чехия', 'Словакия', 'Канада', 'Россия'],
    clubs: [
      { id: 'pardubice', name: 'Dynamo Pardubice', city: 'Пардубице', strength: 1.12 },
      { id: 'trinec', name: 'Oceláři Třinec', city: 'Тршинец', strength: 1.10 }
    ]
  },
  {
    id: 'germany-del', region: 'europe', country: 'Германия', countryCode: 'GER',
    leagueName: 'Германия · DEL', transferMultiplier: 1.24, salaryMultiplier: 1.16,
    minOvr: 70, maxOvr: 84,
    nationalities: ['Германия', 'Германия', 'Канада', 'США', 'Россия'],
    clubs: [
      { id: 'eisbaren-berlin', name: 'Eisbären Berlin', city: 'Берлин', strength: 1.10 },
      { id: 'adler-mannheim', name: 'Adler Mannheim', city: 'Мангейм', strength: 1.08 }
    ]
  },
  {
    id: 'switzerland-nl', region: 'europe', country: 'Швейцария', countryCode: 'SUI',
    leagueName: 'Швейцария · National League', transferMultiplier: 1.48, salaryMultiplier: 1.38,
    minOvr: 73, maxOvr: 87,
    nationalities: ['Швейцария', 'Швейцария', 'Канада', 'Финляндия', 'Швеция'],
    clubs: [
      { id: 'zsc-lions', name: 'ZSC Lions', city: 'Цюрих', strength: 1.14 },
      { id: 'ev-zug', name: 'EV Zug', city: 'Цуг', strength: 1.12 }
    ]
  },
  {
    id: 'slovakia-extraliga', region: 'europe', country: 'Словакия', countryCode: 'SVK',
    leagueName: 'Словакия · Extraliga', transferMultiplier: 1.02, salaryMultiplier: 0.96,
    minOvr: 67, maxOvr: 81,
    nationalities: ['Словакия', 'Словакия', 'Чехия', 'Россия', 'Канада'],
    clubs: [
      { id: 'kosice', name: 'HC Košice', city: 'Кошице', strength: 1.06 },
      { id: 'slovan-bratislava', name: 'Slovan Bratislava', city: 'Братислава', strength: 1.08 }
    ]
  }
];
