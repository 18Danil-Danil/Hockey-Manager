/* Проверенная история выступлений игроков в других лигах.
 * Поддерживаются два типа данных:
 * - seasons: точные сезоны и матчи;
 * - career: карьерный итог по лиге, если источник не даёт сезонную разбивку.
 * Карьерные итоги не получают бонус за свежесть и учитываются с пониженным
 * коэффициентом доверия, чтобы не приравнивать их к свежему полному сезону.
 */
window.VHL_PLAYER_LEAGUE_HISTORY = {
  schemaVersion: 2,
  players: {
    "20987": {
      position: "forward",
      seasons: [
        { season: "20/21", league: "KHL", gp: 18, team: "Ак Барс" }
      ]
    },
    "15997": {
      position: "forward",
      seasons: [
        { season: "23/24", league: "KHL", gp: 20, team: "СКА" }
      ]
    },
    "16699": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 123 }
      ]
    },
    "19513": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 352 }
      ]
    },
    // Источник: https://www.khl.ru/players/17704/ — суммарно 374 матча.
    "17704": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 374 }
      ]
    },
    // Источник: https://www.khl.ru/players/25138/ — суммарно 87 матчей.
    "25138": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 87 }
      ]
    },
    // Источник: https://vhlru.ru/lenta/604901/ — 600 матчей на 12.08.2026.
    "17852": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 600 }
      ]
    },
    // Источник: https://vhlru.ru/lenta/575811/ — 274 матча на 13.01.2026.
    "17763": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 274 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/roman-rukavishnikov/career/
    // 552 матча регулярного чемпионата + 97 матчей плей-офф = 649.
    "16043": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 649 }
      ]
    },
    // Источник: https://vhlru.ru/lenta/603893/ — 41 матч в КХЛ.
    "17600": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 41 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/dmitri-sidlyarov/career/
    // 64 матча регулярного чемпионата + 6 матчей плей-офф = 70.
    "17602": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 70 }
      ]
    }
  }
};
