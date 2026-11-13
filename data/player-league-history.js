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
    // Дмитрий Лютов — 871 матч ВХЛ по актуальной суммарной статистике;
    // отдельно 28 матчей КХЛ по клубной публикации.
    // Источники: https://www.vhlru/stats/players/all/
    // https://www.vhlru/lenta/290243/
    "15399": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 871 },
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
    },
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
    // Илья Бочков — 891 матч ВХЛ; 108 матчей Первой лиги сохранены отдельно.
    // Источники: https://www.vhlru/stats/players/all/
    // https://vhlru.ru/lenta/403623/
    "14585": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 891 },
        { scope: "career", league: "RUSSIAN_FIRST", gp: 108 }
      ]
    },
    // Александр Угольников — 549 матчей ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "15644": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 549 }
      ]
    },
    // Григорий Глебов: 826 матчей ВХЛ по актуальной суммарной статистике;
    // также 42 КХЛ, 81 Первая лига и 3 МХЛ-Б по юбилейной новости ВХЛ (2024).
    // Источники: https://www.vhlru/stats/players/all/
    // https://www.vhlru/lenta/506696/
    "17229": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 826 },
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
    // Максим Салахов: ВХЛ — 640 матчей по актуальной статистике; РХЛ — 88.
    // Источники: https://www.vhlru/stats/players/all/
    // https://rhl.fhr.ru/players/13184/183/
    "13184": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 640 },
        { scope: "career", league: "RHL", gp: 88 }
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
    // Виталий Каменев — 955 матчей ВХЛ по официальной таблице статистики лиги.
    // Источник: https://www.vhlru.ru/players/15796/
    "15796": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 955 }
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
    // Антон Андриянов: 579 матчей регулярных чемпионатов + 41 плей-офф ВХЛ.
    // Источник: https://www.vhlru.ru/players/16491/
    "16491": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 579, stage: "regular" },
        { scope: "career", league: "VHL", gp: 41, stage: "playoffs" }
      ]
    },
    // Николай Тимашов: КХЛ — 436 регулярных + 27 плей-офф;
    // ВХЛ — 169 регулярных + 41 плей-офф по сезонной статистике до 26/27.
    // Источники: https://www.sports.ru/hockey/person/nikolai-timashov/career/
    // https://silasporta.ru/athletes/nikolay-timashov/
    "17312": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 436, stage: "regular" },
        { scope: "career", league: "KHL", gp: 27, stage: "playoffs" },
        { scope: "career", league: "VHL", gp: 169, stage: "regular" },
        { scope: "career", league: "VHL", gp: 41, stage: "playoffs" }
      ]
    },
    // Денис Вихарев — 286 матчей регулярных чемпионатов + 49 плей-офф ВХЛ.
    // Источник: https://www.vhlru.ru/players/17788/
    "17788": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 286, stage: "regular" },
        { scope: "career", league: "VHL", gp: 49, stage: "playoffs" }
      ]
    },
    // Александр Сумин — 892 матча ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "15605": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 892 }
      ]
    },
    // Павел Куликов: 561 матч в КХЛ, 69 матчей в чемпионате Беларуси;
    // ВХЛ — 57 регулярных матчей + 15 плей-офф.
    // Источники: https://ahc-neftyanik.ru/article.asp?id=Pavel-Kulikov-%E2%80%93-novichok-Neftjanika-7351
    // https://silasporta.ru/athletes/pavel-kulikov/
    "15998": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 561 },
        { scope: "career", league: "BELARUS", gp: 69 },
        { scope: "career", league: "VHL", gp: 57, stage: "regular" },
        { scope: "career", league: "VHL", gp: 15, stage: "playoffs" }
      ]
    },
    // Максим Мальцев — 387 матчей регулярных чемпионатов + 96 плей-офф ВХЛ.
    // Источник: https://www.vhlru.ru/players/19509/
    "19509": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 387, stage: "regular" },
        { scope: "career", league: "VHL", gp: 96, stage: "playoffs" }
      ]
    },
    // Алексей Князев — 795 матчей ВХЛ по актуальной официальной таблице лиги.
    // Источник: https://www.vhlru.ru/players/19426/
    "19426": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 795 }
      ]
    },
    // Михаил Тихонов: 375 матчей регулярных чемпионатов и 51 матч плей-офф ВХЛ.
    // Источник: https://silasporta.ru/athletes/mikhail-tikhonov/
    "18985": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 375, stage: "regular" },
        { scope: "career", league: "VHL", gp: 51, stage: "playoffs" }
      ]
    },
    // Денис Александров — 143 матча в КХЛ по полной таблице карьеры.
    // Источник: https://hawk.ru/match-center/15290/player/18972/
    "18972": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 143 }
      ]
    },
    // Вадим Хлопотов — 512 матчей регулярных чемпионатов + 71 плей-офф ВХЛ
    // по суммарной карточке после сезона 2025/26.
    // Источник: https://www.vhlru.ru/players/17362/
    "17362": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 512, stage: "regular" },
        { scope: "career", league: "VHL", gp: 71, stage: "playoffs" }
      ]
    },
    // Фёдор Беляков — 303 матча регулярных чемпионатов + 50 плей-офф ВХЛ.
    // Источник: https://vhlru.ru/players/16672/
    "16672": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 303, stage: "regular" },
        { scope: "career", league: "VHL", gp: 50, stage: "playoffs" }
      ]
    },
    // Илья Коренев — 548 матчей регулярных чемпионатов + 69 плей-офф ВХЛ.
    // Источник: https://vhlru.ru/players/17953/
    "17953": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 548, stage: "regular" },
        { scope: "career", league: "VHL", gp: 69, stage: "playoffs" }
      ]
    },
    // Даниил Ильин: 294 матча регулярных чемпионатов + 34 плей-офф ВХЛ.
    // Источник: https://silasporta.ru/athletes/daniil-ilin/
    "17708": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 294, stage: "regular" },
        { scope: "career", league: "VHL", gp: 34, stage: "playoffs" }
      ]
    },
    // Артём Прохоров: 521 матч регулярных чемпионатов + 19 плей-офф ВХЛ.
    // Источник: https://silasporta.ru/athletes/artem-prokhorov/
    "19038": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 521, stage: "regular" },
        { scope: "career", league: "VHL", gp: 19, stage: "playoffs" }
      ]
    },
    // Георгий Бусаров: 761 матч ВХЛ по актуальной суммарной статистике;
    // 50 матчей КХЛ с плей-офф по публикации клуба.
    // Источники: https://www.vhlru/stats/players/all/
    // https://vmf.ska.ru/news/view/485609-ska-podpisal-kontrakt-s-georgiem-busarovym/
    "17519": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 761 },
        { scope: "career", league: "KHL", gp: 50 }
      ]
    },
    // Максим Верёвкин — 721 матч ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru.ru/stats/players/all/
    "15128": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 721 }
      ]
    },
    // Денис Давыдов — 789 матчей ВХЛ по официальной таблице статистики лиги.
    // Источник: https://www.vhlru.ru/stats/players/all/
    "16359": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 789 }
      ]
    },
    // Игорь Исаев — 302 матча регулярных чемпионатов + 38 плей-офф ВХЛ.
    // Источник: https://www.vhlru.ru/players/19407/
    "19407": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 302, stage: "regular" },
        { scope: "career", league: "VHL", gp: 38, stage: "playoffs" }
      ]
    },
    // Илья Павлюков — 508 матчей регулярных чемпионатов + 40 плей-офф ВХЛ.
    // Источник: https://vhlru.ru/players/20147/
    "20147": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 508, stage: "regular" },
        { scope: "career", league: "VHL", gp: 40, stage: "playoffs" },
        { scope: "career", league: "KHL", gp: 16 },
        { scope: "career", league: "MHL", gp: 156, stage: "regular" },
        { scope: "career", league: "MHL", gp: 54, stage: "playoffs" }
      ]
    },
    // Александр Тарасов — 633 матча ВХЛ по сообщению клуба от 03.11.2026.
    // Источник: https://www.vhlru.ru/lenta/620961/
    "17522": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 633 }
      ]
    },
    // Александр Сорокин: ВХЛ — 610 матчей; МХЛ — 148;
    // РХЛ — 44; КХЛ — 7 (5 регулярных + 2 плей-офф).
    // Источники: https://www.vhlru.ru/stats/players/all/
    // https://mhl.khl.ru/players/17097/
    // https://rhl.fhr.ru/players/17097/
    // https://forchecking.ru/player.php?id=9997
    "17097": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 610 },
        { scope: "career", league: "MHL", gp: 148 },
        { scope: "career", league: "RHL", gp: 44 },
        { scope: "career", league: "KHL", gp: 7 }
      ]
    },
    // Кирилл Маслов — 8 матчей регулярных чемпионатов КХЛ.
    // Источник: https://www.sports.ru/hockey/person/kirill-maslov/career/
    "17643": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 8, stage: "regular" }
      ]
    },
    // Александр Шевченко — 311 матчей регулярных чемпионатов КХЛ.
    // Источник: https://www.sports.ru/hockey/person/alexander-shevchenko/
    "16036": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 311, stage: "regular" }
      ]
    },
    // Николай Владимиров — 8 матчей регулярных чемпионатов КХЛ.
    // Источник: https://www.sports.ru/hockey/person/nikolai-vladimirov/
    "17644": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 8, stage: "regular" }
      ]
    },
    // Георгий Бердюков — 558 матчей ВХЛ с учётом 19 матчей сезона 2026/27
    // на 12.11.2026; предыдущий итог 539 (455 регулярных + 84 плей-офф).
    // Источники: https://www.vhlru.ru/stats/players/all/
    // https://www.vhlru.ru/players/15836/
    "15836": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 558 }
      ]
    },
    // Максим Березин — ВХЛ 63 матча; МХЛ 64 (57 регулярных + 7 плей-офф).
    // Источники: https://www.vhlru.ru/players/15567/
    // https://engmhl.khl.ru/players/15567/
    "15567": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 63 },
        { scope: "career", league: "MHL", gp: 64 }
      ]
    },
    // Роман Абросимов — 104 матча ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru.ru/players/17968/
    "17968": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 104 }
      ]
    },
    // Олег Погоришный — 248 матчей ВХЛ (223 регулярных + 25 плей-офф).
    // Источник: https://vhlru.ru/players/17803/
    "17803": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 248 }
      ]
    },
    // Арсений Ерохин — 653 матча ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "17636": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 653 }
      ]
    },
    // Валерий Поляков — 567 матчей ВХЛ, 213 МХЛ и 43 в чемпионате Беларуси;
    // также 12 матчей чемпионата Казахстана по карьерной статистике Elite Prospects.
    // Источники: https://www.vhlru/stats/players/all/
    // https://www.eliteprospects.com/player/107755/valeri-polyakov
    "16757": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 567 },
        { scope: "career", league: "MHL", gp: 213 },
        { scope: "career", league: "BELARUS", gp: 43 },
        { scope: "career", league: "KAZAKHSTAN", gp: 12 }
      ]
    },
    // Евгений Ярославлев — ВХЛ 495, МХЛ 86 и НМХЛ 39 матчей.
    // Источники: https://www.vhlru/players/17714/
    // https://mhl.khl.ru/players/17714/
    // https://nmhl.fhr.ru/players/17714/
    "17714": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 495 },
        { scope: "career", league: "MHL", gp: 86 },
        { scope: "career", league: "NMHL", gp: 39 }
      ]
    },
    // Сергей Теряев — 630 матчей ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "19083": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 630 }
      ]
    },
    // Денис Горбунов — 477 матчей ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "19201": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 477 }
      ]
    },
    // Илья Хохлов — 496 матчей КХЛ, 199 МХЛ и 49 ВХЛ.
    // Источники: https://www.vhlru/players/17457/
    // https://mhl.khl.ru/players/17457/
    // https://www.vhlru/lenta/607707/
    "17457": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 496 },
        { scope: "career", league: "MHL", gp: 199 },
        { scope: "career", league: "VHL", gp: 49 }
      ]
    },
    // Константин Рыжов — 408 матчей ВХЛ и 69 матчей МХЛ-Б/НМХЛ.
    // Источники: https://www.vhlru/players/22109/
    // https://www.vhlru/lenta/542923/
    "22109": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 408 },
        { scope: "career", league: "MHLB", gp: 69 }
      ]
    },
    // Александр Борисенков — 468 матчей ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru/players/19316/
    "19316": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 468 }
      ]
    },
    // Егор Назаров — 498 матчей ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru/players/19405/
    "19405": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 498 }
      ]
    },
    // Илья Балаболкин — 142 матча ВХЛ и 155 матчей МХЛ (143 регулярных + 12 плей-офф).
    // Источники: https://www.vhlru/players/19850/
    // https://mhl.khl.ru/players/19850/
    "19850": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 142 },
        { scope: "career", league: "MHL", gp: 155 }
      ]
    },
    // Иван Ларичев — 364 матча ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru/players/21258/
    "21258": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 364 }
      ]
    },
    // Никита Жлоба — 437 матчей ВХЛ по суммарной статистике официальной карточки.
    // Источник: https://www.vhlru/players/19185/
    "19185": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 437 }
      ]
    },
    // Павел Медведев — 568 матчей ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/
    "18698": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 568 }
      ]
    },
    // Николай Глухов — 458 матчей ВХЛ (410 регулярных + 48 плей-офф).
    // Источник: https://www.vhlru/players/19007/
    "19007": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 458 }
      ]
    },
    // Алексей Митрофанов — 655 матчей ВХЛ, 55 МХЛ и 2 КХЛ.
    // Источники: https://www.vhlru/stats/players/all/
    // https://hc-kaluga.ru/players/mitrofanov-aleksei-14
    "18342": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 655 },
        { scope: "career", league: "MHL", gp: 55 },
        { scope: "career", league: "KHL", gp: 2 }
      ]
    },
    // Виктор Пластинин — 475 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/18824/
    "18824": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 475 }
      ]
    },
    // Никита Мокин — 654 матча ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/19113/
    "19113": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 654 }
      ]
    },
    // Егор Шалапов — 121 матч ВХЛ, 166 НМХЛ и 2 матча за «Номад» (Казахстан).
    // Источники: https://www.vhlru/players/21548/
    // https://nmhl.fhr.ru/players/21548/
    "21548": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 121 },
        { scope: "career", league: "NMHL", gp: 166 },
        { scope: "career", league: "KAZAKHSTAN", gp: 2 }
      ]
    },
    // Андрей Виноградов — 489 матчей ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/stats/players/all/
    "22535": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 489 }
      ]
    },
    // Андрей Ерофеев — 563 матча ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru/players/19050/
    "19050": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 563 }
      ]
    },
    // Денис Дюрягин — 604 матча ВХЛ по официальной карточке лиги.
    // Источник: https://www.vhlru/players/19503/
    "19503": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 604 }
      ]
    },
    // Дмитрий Шевченко — ВХЛ 104, МХЛ 85, КХЛ 291 и чемпионат Казахстана 13.
    // Сверено по ФИО и дате рождения 15.12.1995; источник содержит сезонные итоги.
    // Источник: https://ru.wikipedia.org/wiki/Шевченко,_Дмитрий_Эдуардович
    "21241": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 104 },
        { scope: "career", league: "MHL", gp: 85 },
        { scope: "career", league: "KHL", gp: 291 },
        { scope: "career", league: "KAZAKHSTAN", gp: 13 }
      ]
    },
    // Михаил Назаров — 322 матча ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/20841/
    "20841": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 322 }
      ]
    },
    // Эмиль Нургалиев — 135 матчей ВХЛ (117 регулярных + 18 плей-офф).
    // Источник: https://www.vhlru/players/21124/
    "21124": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 135 }
      ]
    },
    // Антон Угольников — 441 матч ВХЛ и 164 матча МХЛ.
    // Источники: https://www.vhlru/players/20650/
    // https://mhl.khl.ru/players/20650/
    "20650": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 441 },
        { scope: "career", league: "MHL", gp: 164 }
      ]
    },
    // Павел Пищальников — 199 матчей ВХЛ: 193 по клубной сводке июня 2026
    // плюс 6 матчей текущего сезона по официальной статистике лиги.
    // Источники: https://www.vhlru/lenta/603931/
    // https://www.vhlru/stats/players/1307/forwards/
    "21327": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 199 }
      ]
    },
    // Егор Яковлев — 276 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/20652/
    "20652": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 276 }
      ]
    },
    // Иван Силаев — 515 матчей ВХЛ (489 регулярных + 26 плей-офф).
    // Источник: https://www.vhlru/players/20594/
    "20594": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 515 }
      ]
    },
    // Максим Рыжков — 481 матч ВХЛ (438 регулярных + 43 плей-офф).
    // Источник: https://www.vhlru/players/20627/
    "20627": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 481 }
      ]
    },
    // Андрей Алексеев — 337 матчей ВХЛ и 16 матчей МХЛ.
    // Источники: https://www.vhlru/players/17850/
    // https://mhl.khl.ru/players/17850/
    "17850": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 337 },
        { scope: "career", league: "MHL", gp: 16 }
      ]
    },
    // Александр Шаров — 87 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/18993/
    "18993": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 87 }
      ]
    },
    // Артур Болтанов — 523 матча ВХЛ и 180 матчей МХЛ.
    // Источники: https://www.vhlru/players/20225/
    // https://mhl.khl.ru/players/20225/
    "20225": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 523 },
        { scope: "career", league: "MHL", gp: 180 }
      ]
    },
    // Николай Аверин — 370 матчей ВХЛ (329 регулярных + 41 плей-офф).
    // Источник: https://www.vhlru/players/20958/
    "20958": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 370 }
      ]
    },
    // Роман Опалев — 445 матчей ВХЛ: 434 по суммарной карточке
    // плюс 11 дополнительных матчей сезона 2026/27 по текущей статистике лиги.
    // Источники: https://www.vhlru/players/19302/
    // https://www.vhlru/stats/players/1103/forwards/
    "19302": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 445 }
      ]
    },
    // Павел Щербаков — 255 матчей ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/players/23169/
    "23169": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 255 }
      ]
    },
    // Алексей Краснов — 378 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/21174/
    "21174": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 378 }
      ]
    },
  }
};
