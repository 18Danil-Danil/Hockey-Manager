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
    }
  }
};
