/* Проверенные сезонные результаты ВХЛ.
 * Названия клубов сохраняются в том виде, в котором они указаны в архиве сезона.
 * Не объединять исторические сущности без отдельной проверки правопреемства.
 */
window.VHL_SEASON_RESULTS = [
  {
    season: '2010/11',
    leagueParticipants: 20,
    regularSeason: {
      source: 'https://www.championat.com/hockey/_highleague/tournament/241/table/',
      sourceType: 'secondary_archive',
      verified: true,
      note: 'Итоговая общая таблица регулярного чемпионата; 56 матчей у каждой команды.'
    },
    playoffs: {
      source: 'https://www.championat.com/hockey/_highleague/tournament/325/table/',
      sourceType: 'secondary_archive',
      verified: true,
      format: 'Отдельные сетки Запада и Востока, затем финал чемпионата.'
    },
    teams: [
      { historicalId: 'rubin-tyumen', clubName: 'Рубин', regularPlace: 1, games: 56, wins: 38, overtimeWins: 2, shootoutWins: 2, shootoutLosses: 2, overtimeLosses: 0, losses: 12, goalsFor: 172, goalsAgainst: 104, points: 124, playoffStage: 'champion', playoffOpponent: 'Нефтяник', seriesScore: '4:0' },
      { historicalId: 'toros-neftekamsk', clubName: 'Торос', regularPlace: 2, games: 56, wins: 34, overtimeWins: 1, shootoutWins: 5, shootoutLosses: 3, overtimeLosses: 3, losses: 10, goalsFor: 183, goalsAgainst: 114, points: 120, playoffStage: 'conference_finalist', playoffOpponent: 'Рубин', seriesScore: '1:4' },
      { historicalId: 'neftyanik-almetyevsk', clubName: 'Нефтяник', regularPlace: 3, games: 56, wins: 26, overtimeWins: 4, shootoutWins: 3, shootoutLosses: 6, overtimeLosses: 1, losses: 16, goalsFor: 161, goalsAgainst: 140, points: 99, playoffStage: 'finalist', playoffOpponent: 'Рубин', seriesScore: '0:4' },
      { historicalId: 'molot-perm', clubName: 'Молот-Прикамье', regularPlace: 4, games: 56, wins: 25, overtimeWins: 3, shootoutWins: 4, shootoutLosses: 6, overtimeLosses: 1, losses: 17, goalsFor: 162, goalsAgainst: 156, points: 96, playoffStage: 'conference_semifinal', playoffOpponent: 'Торос', seriesScore: '0:3' },
      { historicalId: 'sarov', clubName: 'ХК Саров', regularPlace: 5, games: 56, wins: 25, overtimeWins: 3, shootoutWins: 6, shootoutLosses: 2, overtimeLosses: 0, losses: 20, goalsFor: 168, goalsAgainst: 149, points: 95, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Кристалл', seriesScore: '1:3' },
      { historicalId: 'yuzhny-ural', clubName: 'Южный Урал', regularPlace: 6, games: 56, wins: 25, overtimeWins: 3, shootoutWins: 3, shootoutLosses: 5, overtimeLosses: 2, losses: 18, goalsFor: 135, goalsAgainst: 132, points: 94, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Ермак', seriesScore: '2:3' },
      { historicalId: 'dizel-penza', clubName: 'Дизель', regularPlace: 7, games: 56, wins: 23, overtimeWins: 2, shootoutWins: 3, shootoutLosses: 8, overtimeLosses: 1, losses: 19, goalsFor: 132, goalsAgainst: 123, points: 88, playoffStage: 'conference_finalist', playoffOpponent: 'Нефтяник', seriesScore: '3:4' },
      { historicalId: 'ermak-angarsk', clubName: 'Ермак', regularPlace: 8, games: 56, wins: 27, overtimeWins: 1, shootoutWins: 0, shootoutLosses: 3, overtimeLosses: 1, losses: 24, goalsFor: 168, goalsAgainst: 139, points: 87, playoffStage: 'conference_semifinal', playoffOpponent: 'Рубин', seriesScore: '0:3' },
      { historicalId: 'kazzinc-torpedo', clubName: 'Казцинк-Торпедо', regularPlace: 9, games: 56, wins: 23, overtimeWins: 1, shootoutWins: 4, shootoutLosses: 6, overtimeLosses: 1, losses: 21, goalsFor: 151, goalsAgainst: 153, points: 86, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Молот-Прикамье', seriesScore: '2:3' },
      { historicalId: 'zauralye-kurgan', clubName: 'Зауралье', regularPlace: 10, games: 56, wins: 20, overtimeWins: 2, shootoutWins: 8, shootoutLosses: 3, overtimeLosses: 3, losses: 20, goalsFor: 153, goalsAgainst: 147, points: 86, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Торос', seriesScore: '1:3' },
      { historicalId: 'khk-vmf', clubName: 'ХК ВМФ', regularPlace: 11, games: 56, wins: 22, overtimeWins: 2, shootoutWins: 2, shootoutLosses: 5, overtimeLosses: 2, losses: 23, goalsFor: 142, goalsAgainst: 148, points: 81, playoffStage: 'conference_semifinal', playoffOpponent: 'Дизель', seriesScore: '0:3' },
      { historicalId: 'sputnik-nizhny-tagil', clubName: 'Спутник', regularPlace: 12, games: 56, wins: 20, overtimeWins: 4, shootoutWins: 5, shootoutLosses: 0, overtimeLosses: 3, losses: 24, goalsFor: 149, goalsAgainst: 144, points: 81, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Рубин', seriesScore: '1:3' },
      { historicalId: 'mechel-chelyabinsk', clubName: 'Мечел', regularPlace: 13, games: 56, wins: 20, overtimeWins: 1, shootoutWins: 4, shootoutLosses: 7, overtimeLosses: 4, losses: 20, goalsFor: 168, goalsAgainst: 174, points: 81, playoffStage: 'missed' },
      { historicalId: 'krylya-sovetov', clubName: 'Крылья Советов', regularPlace: 14, games: 56, wins: 19, overtimeWins: 3, shootoutWins: 7, shootoutLosses: 1, overtimeLosses: 0, losses: 26, goalsFor: 163, goalsAgainst: 172, points: 78, playoffStage: 'conference_quarterfinal', playoffOpponent: 'ХК ВМФ', seriesScore: '2:3' },
      { historicalId: 'ryazan', clubName: 'ХК Рязань', regularPlace: 15, games: 56, wins: 19, overtimeWins: 1, shootoutWins: 4, shootoutLosses: 6, overtimeLosses: 3, losses: 23, goalsFor: 153, goalsAgainst: 169, points: 76, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Дизель', seriesScore: '0:3' },
      { historicalId: 'izhstal-izhevsk', clubName: 'Ижсталь', regularPlace: 16, games: 56, wins: 17, overtimeWins: 1, shootoutWins: 6, shootoutLosses: 2, overtimeLosses: 2, losses: 28, goalsFor: 119, goalsAgainst: 132, points: 69, playoffStage: 'missed' },
      { historicalId: 'kristall-saratov', clubName: 'Кристалл', regularPlace: 17, games: 56, wins: 17, overtimeWins: 0, shootoutWins: 3, shootoutLosses: 2, overtimeLosses: 5, losses: 29, goalsFor: 149, goalsAgainst: 183, points: 64, playoffStage: 'conference_quarterfinal', playoffOpponent: 'ХК Саров', seriesScore: '3:1' },
      { historicalId: 'ariada-akpars', clubName: 'Ариада-Акпарс', regularPlace: 18, games: 56, wins: 18, overtimeWins: 0, shootoutWins: 0, shootoutLosses: 4, overtimeLosses: 4, losses: 30, goalsFor: 138, goalsAgainst: 193, points: 62, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Нефтяник', seriesScore: '0:3' },
      { historicalId: 'dynamo-moscow-region', clubName: 'Динамо', regularPlace: 19, games: 56, wins: 13, overtimeWins: 3, shootoutWins: 5, shootoutLosses: 3, overtimeLosses: 2, losses: 30, goalsFor: 150, goalsAgainst: 190, points: 60, playoffStage: 'missed' },
      { historicalId: 'lada-togliatti', clubName: 'Лада', regularPlace: 20, games: 56, wins: 15, overtimeWins: 1, shootoutWins: 2, shootoutLosses: 2, overtimeLosses: 0, losses: 36, goalsFor: 130, goalsAgainst: 184, points: 53, playoffStage: 'missed' }
    ]
  }
  {
    season: '2011/12',
    leagueParticipants: 23,
    regularSeason: {
      source: 'https://www.championat.com/hockey/_highleague/tournament/417/table/',
      sourceType: 'secondary_archive',
      verified: true,
      note: 'Общая таблица регулярного чемпионата. «Локомотив» провёл 22 матча после включения в соревнование.'
    },
    playoffs: {
      source: 'https://www.championat.com/hockey/_highleague/tournament/494/table/',
      sourceType: 'secondary_archive',
      verified: true,
      format: 'Четвертьфиналы и полуфиналы конференций, полуфиналы чемпионата, финал.'
    },
    teams: [
      { historicalId: 'rubin-tyumen', clubName: 'Рубин', regularPlace: 1, games: 53, wins: 36, overtimeWins: 2, shootoutWins: 3, shootoutLosses: 2, overtimeLosses: 1, losses: 9, goalsFor: 159, goalsAgainst: 92, points: 121, playoffStage: 'finalist', playoffOpponent: 'Торос', seriesScore: '1:4' },
      { historicalId: 'toros-neftekamsk', clubName: 'Торос', regularPlace: 2, games: 53, wins: 31, overtimeWins: 3, shootoutWins: 8, shootoutLosses: 1, overtimeLosses: 0, losses: 10, goalsFor: 191, goalsAgainst: 119, points: 116, playoffStage: 'champion', playoffOpponent: 'Рубин', seriesScore: '4:1' },
      { historicalId: 'donbass-donetsk', clubName: 'Донбасс', regularPlace: 3, games: 53, wins: 31, overtimeWins: 3, shootoutWins: 4, shootoutLosses: 2, overtimeLosses: 2, losses: 11, goalsFor: 179, goalsAgainst: 112, points: 111, playoffStage: 'championship_semifinal', playoffOpponent: 'Торос', seriesScore: '0:4' },
      { historicalId: 'yuzhny-ural', clubName: 'Южный Урал', regularPlace: 4, games: 53, wins: 29, overtimeWins: 1, shootoutWins: 3, shootoutLosses: 3, overtimeLosses: 4, losses: 13, goalsFor: 146, goalsAgainst: 114, points: 102, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Мечел', seriesScore: '2:3' },
      { historicalId: 'dizel-penza', clubName: 'Дизель', regularPlace: 5, games: 53, wins: 26, overtimeWins: 1, shootoutWins: 7, shootoutLosses: 3, overtimeLosses: 1, losses: 15, goalsFor: 167, goalsAgainst: 136, points: 98, playoffStage: 'championship_semifinal', playoffOpponent: 'Рубин', seriesScore: '2:4' },
      { historicalId: 'ermak-angarsk', clubName: 'Ермак', regularPlace: 6, games: 53, wins: 24, overtimeWins: 4, shootoutWins: 2, shootoutLosses: 7, overtimeLosses: 4, losses: 12, goalsFor: 164, goalsAgainst: 137, points: 95, playoffStage: 'conference_semifinal', playoffOpponent: 'Торос', seriesScore: '1:3' },
      { historicalId: 'neftyanik-almetyevsk', clubName: 'Нефтяник', regularPlace: 7, games: 53, wins: 26, overtimeWins: 1, shootoutWins: 4, shootoutLosses: 4, overtimeLosses: 1, losses: 17, goalsFor: 156, goalsAgainst: 125, points: 93, playoffStage: 'conference_semifinal', playoffOpponent: 'Донбасс', seriesScore: '0:3' },
      { historicalId: 'kazzinc-torpedo', clubName: 'Казцинк-Торпедо', regularPlace: 8, games: 53, wins: 23, overtimeWins: 4, shootoutWins: 3, shootoutLosses: 2, overtimeLosses: 0, losses: 21, goalsFor: 154, goalsAgainst: 140, points: 85, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Ермак', seriesScore: '2:3' },
      { historicalId: 'ariada-akpars', clubName: 'Ариада-Акпарс', regularPlace: 9, games: 53, wins: 20, overtimeWins: 6, shootoutWins: 1, shootoutLosses: 7, overtimeLosses: 3, losses: 16, goalsFor: 156, goalsAgainst: 159, points: 84, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Нефтяник', seriesScore: '2:3' },
      { historicalId: 'mechel-chelyabinsk', clubName: 'Мечел', regularPlace: 10, games: 53, wins: 24, overtimeWins: 1, shootoutWins: 2, shootoutLosses: 1, overtimeLosses: 1, losses: 24, goalsFor: 174, goalsAgainst: 160, points: 80, playoffStage: 'conference_semifinal', playoffOpponent: 'Рубин', seriesScore: '2:3' },
      { historicalId: 'khk-vmf', clubName: 'ХК ВМФ', regularPlace: 11, games: 53, wins: 19, overtimeWins: 2, shootoutWins: 5, shootoutLosses: 4, overtimeLosses: 2, losses: 21, goalsFor: 142, goalsAgainst: 134, points: 77, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Локомотив', seriesScore: '2:3' },
      { historicalId: 'molot-perm', clubName: 'Молот-Прикамье', regularPlace: 12, games: 53, wins: 19, overtimeWins: 2, shootoutWins: 1, shootoutLosses: 11, overtimeLosses: 2, losses: 18, goalsFor: 150, goalsAgainst: 149, points: 76, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Торос', seriesScore: '0:3' },
      { historicalId: 'lada-togliatti', clubName: 'Лада', regularPlace: 13, games: 53, wins: 18, overtimeWins: 3, shootoutWins: 2, shootoutLosses: 5, overtimeLosses: 3, losses: 22, goalsFor: 160, goalsAgainst: 152, points: 72, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Дизель', seriesScore: '1:3' },
      { historicalId: 'sputnik-nizhny-tagil', clubName: 'Спутник', regularPlace: 14, games: 53, wins: 20, overtimeWins: 2, shootoutWins: 2, shootoutLosses: 3, overtimeLosses: 0, losses: 26, goalsFor: 130, goalsAgainst: 164, points: 71, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Рубин', seriesScore: '1:3' },
      { historicalId: 'titan-klin', clubName: 'Титан', regularPlace: 15, games: 53, wins: 18, overtimeWins: 0, shootoutWins: 5, shootoutLosses: 2, overtimeLosses: 5, losses: 23, goalsFor: 136, goalsAgainst: 157, points: 70, playoffStage: 'conference_quarterfinal', playoffOpponent: 'Донбасс', seriesScore: '0:3' },
      { historicalId: 'zauralye-kurgan', clubName: 'Зауралье', regularPlace: 16, games: 53, wins: 17, overtimeWins: 2, shootoutWins: 4, shootoutLosses: 6, overtimeLosses: 1, losses: 23, goalsFor: 140, goalsAgainst: 159, points: 70, playoffStage: 'missed' },
      { historicalId: 'sarov', clubName: 'ХК Саров', regularPlace: 17, games: 53, wins: 15, overtimeWins: 2, shootoutWins: 3, shootoutLosses: 3, overtimeLosses: 2, losses: 28, goalsFor: 128, goalsAgainst: 166, points: 60, playoffStage: 'missed' },
      { historicalId: 'sokol-krasnoyarsk', clubName: 'Сокол', regularPlace: 18, games: 53, wins: 14, overtimeWins: 1, shootoutWins: 5, shootoutLosses: 3, overtimeLosses: 2, losses: 28, goalsFor: 139, goalsAgainst: 178, points: 59, playoffStage: 'missed' },
      { historicalId: 'izhstal-izhevsk', clubName: 'Ижсталь', regularPlace: 19, games: 53, wins: 17, overtimeWins: 0, shootoutWins: 1, shootoutLosses: 3, overtimeLosses: 1, losses: 31, goalsFor: 108, goalsAgainst: 149, points: 57, playoffStage: 'missed' },
      { historicalId: 'dynamo-moscow-region', clubName: 'Динамо', regularPlace: 20, games: 53, wins: 11, overtimeWins: 2, shootoutWins: 7, shootoutLosses: 0, overtimeLosses: 2, losses: 31, goalsFor: 132, goalsAgainst: 173, points: 53, playoffStage: 'missed' },
      { historicalId: 'ryazan', clubName: 'ХК Рязань', regularPlace: 21, games: 53, wins: 13, overtimeWins: 0, shootoutWins: 3, shootoutLosses: 3, overtimeLosses: 4, losses: 30, goalsFor: 134, goalsAgainst: 205, points: 52, playoffStage: 'missed' },
      { historicalId: 'lokomotiv-yaroslavl', clubName: 'Локомотив', regularPlace: 22, games: 22, wins: 13, overtimeWins: 0, shootoutWins: 0, shootoutLosses: 2, overtimeLosses: 1, losses: 6, goalsFor: 68, goalsAgainst: 47, points: 42, playoffStage: 'conference_semifinal', playoffOpponent: 'Дизель', seriesScore: '2:3', note: 'Команда была включена в чемпионат после трагедии 7 сентября 2011 года; сыграла 22 матча регулярного чемпионата.' },
      { historicalId: 'kristall-saratov', clubName: 'Кристалл', regularPlace: 23, games: 53, wins: 8, overtimeWins: 3, shootoutWins: 2, shootoutLosses: 0, overtimeLosses: 3, losses: 37, goalsFor: 108, goalsAgainst: 194, points: 37, playoffStage: 'missed' }
    ]
  },
];

// Допустимые playoffStage: missed, conference_quarterfinal,
// conference_semifinal, conference_finalist, championship_semifinal,
// finalist, champion.
// Исторические идентификаторы здесь не являются утверждением о правопреемстве.
