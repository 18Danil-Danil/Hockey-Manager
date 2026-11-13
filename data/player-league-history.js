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
        { scope: "career", league: "KHL", gp: 516 },
        { scope: "career", league: "VHL", gp: 201 }
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
        { scope: "career", league: "VHL", gp: 351 },
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
    // Никита Богданов: 274 матча в ВХЛ (данные на сентябрь 2026) и
    // 10 матчей регулярного чемпионата КХЛ: 8 в 2023/24 и 2 в 2026/27.
    // Источники: https://vhlru.ru/lenta/608000/
    // https://silasporta.ru/athletes/nikita-bogdanov/
    "14498": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 274 },
        { scope: "career", league: "KHL", gp: 10 }
      ]
    },
    // Илья Бочков: 870 матчей в ВХЛ по сообщению клуба от 01.06.2026.
    // Отдельно 108 матчей в Первой лиге/Первенстве ВХЛ по сообщению ВХЛ 2021 года.
    // Источники: https://www.vhlru.ru/lenta/603852/
    // https://vhlru.ru/lenta/403623/
    "14585": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 870 },
        { scope: "career", league: "RUSSIAN_FIRST", gp: 108 }
      ]
    },
    // Александр Угольников — 544 матча в ВХЛ с плей-офф, данные клуба 2026 года.
    // Источник: https://www.hcda.ru/press_center/news/sostav-dinamo-altay-popolnil-zashchitnik-aleksandr-ugolnikov/
    "15644": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 544 }
      ]
    },
    // Григорий Глебов: 823 матча ВХЛ по актуальной суммарной карточке;
    // также 42 КХЛ, 81 Первая лига и 3 МХЛ-Б по юбилейной новости ВХЛ (2024).
    // Источники: https://www.vhlru.ru/players/17229/
    // https://www.vhlru.ru/lenta/506696/
    "17229": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 823 },
        { scope: "career", league: "KHL", gp: 42 },
        { scope: "career", league: "RUSSIAN_FIRST", gp: 81 },
        { scope: "career", league: "MHLB", gp: 3 }
      ]
    },
    // Михаил Мокин: ВХЛ — 683 матча; МХЛ — 256 матчей (регулярка,
    // плей-офф и плей-аут) по официальным карточкам лиг.
    // Источники: https://www.vhlru.ru/players/16234/
    // https://mhl.khl.ru/players/16234/
    "16234": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 683 },
        { scope: "career", league: "MHL", gp: 256 }
      ]
    },
    // Максим Салахов: ВХЛ — 631 матч; МХЛ — 51 матч регулярного чемпионата
    // в сезоне 2014/15 (подтверждённая строка сезонной статистики).
    // Источники: https://www.vhlru.ru/players/13184/
    // https://mhl.khl.ru/stat/players/272/all/183/
    "13184": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 631 }
      ],
      seasons: [
        { season: "14/15", league: "MHL", gp: 51, team: "Капитан", stage: "regular" }
      ]
    },
    // Дмитрий Бойчук — 542 матча ВХЛ по официальной карточке лиги.
    // Источник: https://vhlru.ru/players/19054/
    "19054": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 542 }
      ]
    },
    // Виталий Каменев — 944 матча ВХЛ (784 регулярка + 160 плей-офф).
    // Источник: https://www.vhlru.ru/players/15796/
    "15796": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 944 }
      ]
    },
    // Александр Суворов: ВХЛ — 111 матчей регулярного чемпионата и 9 плей-офф
    // с учётом 15 игр сезона 26/27; КХЛ — 87 регулярных + 8 плей-офф.
    // Беларусь — 53 регулярных + 23 плей-офф; Belarus2 — 51 матч.
    // Источники: https://www.vhlru.ru/en/players/39993/
    // https://www.eliteprospects.com/player/595483/alexander-suvorov
    "39993": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 111, stage: "regular" },
        { scope: "career", league: "VHL", gp: 9, stage: "playoffs" },
        { scope: "career", league: "KHL", gp: 87, stage: "regular" },
        { scope: "career", league: "KHL", gp: 8, stage: "playoffs" },
        { scope: "career", league: "BELARUS", gp: 53, stage: "regular" },
        { scope: "career", league: "BELARUS", gp: 23, stage: "playoffs" },
        { scope: "career", league: "BELARUS2", gp: 51, stage: "regular" }
      ]
    },
    // Ю Сато: 117 матчей регулярного чемпионата ВХЛ за АКМ, Дизель,
    // Динамо-Алтай и Буран по официальной карточке лиги.
    // Источник: https://www.vhlru.ru/en/players/41532/
    "41532": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 117, stage: "regular" }
      ]
    },
    // Доминик Миканович: МХЛ — 81 матч (66 регулярных + 15 плей-офф);
    // ВХЛ — 55 матчей (49 регулярных + 6 плей-офф).
    // Источники: https://engmhl.khl.ru/players/43307/
    // https://www.vhlru.ru/players/43307/
    "43307": {
      position: "defense",
      career: [
        { scope: "career", league: "MHL", gp: 81 },
        { scope: "career", league: "VHL", gp: 55 }
      ]
    },
    // Илья Литвинов: ВХЛ — 252 регулярных + 7 плей-офф;
    // белорусская Экстралига — 71 регулярный + 18 матчей плей-офф.
    // Источник: https://www.hockeyledger.com/en/player/9212353-ilya-litvinov/
    "24612": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 252, stage: "regular" },
        { scope: "career", league: "VHL", gp: 7, stage: "playoffs" },
        { scope: "career", league: "BELARUS", gp: 71, stage: "regular" },
        { scope: "career", league: "BELARUS", gp: 18, stage: "playoffs" }
      ]
    },
  }
};
