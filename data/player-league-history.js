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
    },
    // Источник: https://www.vhlru.ru/lenta/542659/ — 545 матчей в КХЛ.
    "16502": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 545 }
      ]
    },
    // Источник: https://sportmail.ru/news/hockey/72077591/ — 540 матчей с плей-офф, 2026.
    "16386": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 540 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/nikita-lisov/career/
    // 156 матчей регулярного чемпионата + 6 матчей Кубка Гагарина.
    "17625": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 162 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/ziyat-paygin/career/
    // 386 матчей регулярного чемпионата + 36 матчей Кубка Гагарина.
    "18686": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 422 }
      ]
    },
    // Источник: https://www.dynamo-spb.com/news/aleksandr-komaristyy-stal-igrokom-dinamo/
    // 378 матчей; опубликованный итог до завершения его выступлений в КХЛ.
    "15450": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 378 }
      ]
    },
    // Источник: https://spartak.ru/news/transfers/spartak-poluchil-prava-na-eduarda-gimatova/
    // Проверка актуальной разбивки: 174 регулярных + 22 матча плей-офф.
    "17632": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 196 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/maxim-kazakov/career/
    // 242 матча регулярного чемпионата + 9 матчей Кубка Гагарина.
    "16458": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 251 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/denis-golubev/career/
    // 478 матчей регулярного чемпионата + 45 матчей Кубка Гагарина.
    "15649": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 523 }
      ]
    },
    // Источник: https://s-cdn.sportbox.ru/Vidy_sporta/Hokkej/Stanislav-Vladimirovich-Alishevskiy-Hokkey-09051991
    // 161 матч регулярного чемпионата + 2 матча плей-офф; Кубок Надежды исключён.
    "15778": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 163 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/1117291272-34-letnij-makeev-pereshel-v-gornyak-ugmk-kontrakt-s-farmom-avtomobilis.html
    // 701 матч в КХЛ с учётом плей-офф, подтверждено в 2026 году.
    "19368": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 701 }
      ]
    },
    // Источник: https://hctraktor.org/media/news/49632-artyem-borodkin-na-prosmotre-v-traktore/
    // 530 матчей в КХЛ, завершил выступления в лиге в 2022/23.
    "15979": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 530 }
      ]
    },
    // Источник: https://vhlru.ru/lenta/619944/ — 57 матчей в КХЛ, подтверждено в октябре 2026.
    "16005": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 57 }
      ]
    },
    // Источник: https://www.vhlru.ru/lenta/290243/ — 28 матчей за «Амур».
    "15399": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 28 }
      ]
    },
    // Источник: https://www.sports.ru/hockey/person/vladimir-sokhatskiy/
    // 121 матч регулярного чемпионата; плей-офф в эту цифру не включён.
    "15802": {
      position: "goaltender",
      career: [
        { scope: "career", league: "KHL", gp: 121 }
      ]
    }
    // Максим Кицын: сезонная статистика Sport-Express; регулярные чемпионаты.
    // Охвачены КХЛ, МХЛ, ВХЛ, OHL, AHL и ECHL; плей-офф не смешан с регуляркой.
    // Источник: https://www.sport-express.net/hockey/nhl/reviews/1010345/
    "15277": {
      position: "forward",
      seasons: [
        { season: "08/09", league: "KHL", gp: 31, team: "Металлург Новокузнецк" },
        { season: "09/10", league: "KHL", gp: 21, team: "Металлург Новокузнецк" },
        { season: "09/10", league: "MHL", gp: 11, team: "Кузнецкие Медведи" },
        { season: "10/11", league: "KHL", gp: 18, team: "Металлург Новокузнецк" },
        { season: "10/11", league: "MHL", gp: 3, team: "Кузнецкие Медведи" },
        { season: "10/11", league: "OHL", gp: 32, team: "Mississauga" },
        { season: "11/12", league: "KHL", gp: 32, team: "Металлург Новокузнецк" },
        { season: "11/12", league: "VHL", gp: 6, team: "Ермак" },
        { season: "11/12", league: "MHL", gp: 10, team: "Кузнецкие Медведи" },
        { season: "12/13", league: "KHL", gp: 8, team: "Торпедо" },
        { season: "12/13", league: "VHL", gp: 29, team: "ХК Саров" },
        { season: "13/14", league: "AHL", gp: 20, team: "Manchester Monarchs" },
        { season: "13/14", league: "ECHL", gp: 33, team: "Ontario Reign" },
        { season: "14/15", league: "AHL", gp: 7, team: "Manchester Monarchs" },
        { season: "14/15", league: "ECHL", gp: 57, team: "Ontario Reign" },
        { season: "15/16", league: "AHL", gp: 2, team: "Ontario Reign" },
        { season: "15/16", league: "ECHL", gp: 65, team: "Manchester Monarchs" }
      ]
    },
    // Даниил Апальков: МХЛ — официальная суммарная статистика; КХЛ — 516 матчей
    // с плей-офф по сообщению клуба (2023); сезонные ВХЛ — Forchecking.
    // Источники: https://mhl.khl.ru/news/1/763883/
    // https://www.championat.com/hockey/news-5261158-eks-forvard-lokomotiva-apalkov-podpisal-kontrakt-s-karagandinskoj-sary-arkoj.html
    // https://www.forchecking.ru/player.php?id=7475
    "16003": {
      position: "forward",
      career: [
        { scope: "career", league: "MHL", gp: 146 },
        { scope: "career", league: "KHL", gp: 516 }
      ],
      seasons: [
        { season: "11/12", league: "VHL", gp: 17, team: "Локомотив" },
        { season: "12/13", league: "VHL", gp: 5, team: "Локомотив" },
        { season: "21/22", league: "VHL", gp: 41, team: "Ермак" },
        { season: "24/25", league: "VHL", gp: 35, team: "Металлург Новокузнецк" },
        { season: "25/26", league: "VHL", gp: 56, team: "Металлург Новокузнецк" },
        { season: "26/27", league: "VHL", gp: 11, team: "Металлург Новокузнецк" }
      ]
    },
    // Святослав Гребенщиков: КХЛ — 262 матча по сообщению клуба в 2025 году;
    // ВХЛ — суммарная статистика официальной карточки игрока, обновлённая в 2026 году.
    // Также 9 матчей в HockeyAllsvenskan за Västerås в сезоне 2021/22.
    // Источники: https://www.vhlru.ru/lenta/542540/
    // https://www.vhlru.ru/players/17829/
    // https://www.eliteprospects.com/player/160625/svyatoslav-grebenshchikov
    "17829": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 262 },
        { scope: "career", league: "VHL", gp: 359 },
        { scope: "career", league: "ALLSVENSKAN", gp: 9 }
      ]
    },
    // Денис Баранцев — 635 матчей в КХЛ по сообщению ВХЛ от 01.06.2026.
    // Источник: https://www.vhlru.ru/lenta/603866/
    "16082": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 635 }
      ]
    },
    // Динар Хамидуллин: 142 матча регулярного чемпионата + 8 матчей плей-офф.
    // Источник: https://www.sports.ru/hockey/person/dinar-khamidullin/career/
    "16411": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 150 }
      ]
    },
    // Павел Махановский: сезонные матчи регулярного чемпионата КХЛ.
    // Кубок Надежды 2014 не включён; плей-офф не добавлен без отдельной разбивки.
    // Источник: https://static.sportbox.ru/Vidy_sporta/Hokkej/Pavel-Mahanovskiy-Hokkey-02091993/turnir_19041
    "16457": {
      position: "forward",
      seasons: [
        { season: "13/14", league: "KHL", gp: 12, team: "Авангард" },
        { season: "16/17", league: "KHL", gp: 15, team: "Авангард" },
        { season: "17/18", league: "KHL", gp: 45, team: "Адмирал" },
        { season: "22/23", league: "KHL", gp: 68, team: "Амур" },
        { season: "23/24", league: "KHL", gp: 35, team: "Адмирал" }
      ]
    },
  }
};
