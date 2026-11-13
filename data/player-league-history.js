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
    // Максим Кориневский — 535 матчей ВХЛ (512 регулярных + 23 плей-офф).
    // Источник: https://www.vhlru/players/20846/
    "20846": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 535 }
      ]
    },
    // Сергей Лапин — 243 матча ВХЛ и 175 матчей МХЛ.
    // Источники: https://www.vhlru/players/21180/
    // https://mhl.khl.ru/players/21180/
    "21180": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 243 },
        { scope: "career", league: "MHL", gp: 175 }
      ]
    },
    // Александр Локтев — 548 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/20003/
    "20003": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 548 }
      ]
    },
    // Данил Кудашев — 282 матча ВХЛ и 67 матчей МХЛ.
    // Источники: https://www.vhlru/players/20695/
    // https://mhl.khl.ru/players/20695/
    "20695": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 282 },
        { scope: "career", league: "MHL", gp: 67 }
      ]
    },
    // Иван Крылов — 481 матч ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/21214/
    "21214": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 481 }
      ]
    },
    // Илья Скворцов — 411 матчей ВХЛ и 70 матчей МХЛ.
    // Источники: https://www.vhlru/players/20309/
    // https://mhl.khl.ru/players/20309/
    "20309": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 411 },
        { scope: "career", league: "MHL", gp: 70 }
      ]
    },
    // Максим Лазарев — 441 матч ВХЛ (406 регулярных + 35 плей-офф).
    // Источник: https://vhlru.ru/players/20358/
    "20358": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 441 }
      ]
    },
    // Илья Зиновьев — 404 матча ВХЛ (384 регулярных + 20 плей-офф).
    // Источник: https://www.vhlru.ru/players/20335/
    "20335": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 404 }
      ]
    },
    // Марк Марин — 256 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru.ru/players/20359/
    "20359": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 256 }
      ]
    },
    // Владислав Наумов — 374 матча ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/defenses/
    "20642": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 374 }
      ]
    },
    // Илья Колганов — 332 матча регулярных чемпионатов ВХЛ;
    // плей-офф в доступной сводке отдельно не указан.
    // Источник: https://silasporta.ru/athletes/ilya-kolganov/
    "21265": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 332 }
      ]
    },
    // Вадим Никитин — 330 матчей ВХЛ: 314 регулярных + 16 плей-офф.
    // Источник: https://silasporta.ru/athletes/vadim-nikitin/
    "20672": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 330 }
      ]
    },
    // Максим Минеев — 222 матча ВХЛ (182 регулярных + 40 плей-офф).
    // Источник: https://www.vhlru/players/22129/
    "22129": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 222 }
      ]
    },
    // Олег Попов — 364 матча ВХЛ (328 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/22469/
    "22469": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 364 }
      ]
    },
    // Владимир Бобылёв — 477 матчей ВХЛ и 58 матчей МХЛ.
    // Источники: https://www.vhlru/players/21313/
    // https://mhl.khl.ru/players/21313/
    "21313": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 477 },
        { scope: "career", league: "MHL", gp: 58 }
      ]
    },
    // Артём Чмыхов — 309 матчей ВХЛ (255 регулярных + 54 плей-офф).
    // Источник: https://www.vhlru/players/22226/
    "22226": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 309 }
      ]
    },
    // Савва Андреев — 418 матчей ВХЛ (371 регулярный + 47 плей-офф).
    // Источник: https://www.vhlru/players/22239/
    "22239": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 418 }
      ]
    },
    // Алексей Богданов — 315 матчей ВХЛ по суммарной статистике лиги.
    // Источник: https://www.vhlru/players/25359/
    "25359": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 315 }
      ]
    },
    // Михаил Епишин — 360 матчей ВХЛ (320 регулярных + 40 плей-офф).
    // Источник: https://www.vhlru/players/22496/
    "22496": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 360 }
      ]
    },
    // Антон Ковалёв — 365 матчей ВХЛ (350 регулярных + 15 плей-офф).
    // Источник: https://www.vhlru/players/21981/
    "21981": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 365 }
      ]
    },
    // Владислав Лукин — 390 матчей ВХЛ (333 регулярных + 57 плей-офф).
    // Источник: https://www.vhlru/players/22196/
    "22196": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 390 }
      ]
    },
    // Игорь Мясищев — 553 матча ВХЛ (463 регулярных + 90 плей-офф).
    // Источник: https://www.vhlru/players/22187/
    "22187": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 553 }
      ]
    },
    // Кирилл Меляков — 408 матчей ВХЛ (337 регулярных + 71 плей-офф).
    // Источник: https://www.vhlru/players/21894/
    "21894": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 408 }
      ]
    },
    // Андрей Банников — 417 матчей ВХЛ (383 регулярных + 34 плей-офф).
    // Источник: https://www.vhlru/players/21554/
    "21554": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 417 }
      ]
    },
    // Руслан Петрищев — 404 матча ВХЛ (330 регулярных + 74 плей-офф).
    // Источник: https://www.vhlru/players/22254/
    "22254": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 404 }
      ]
    },
    // Данил Воеводин — 376 матчей ВХЛ (334 регулярных + 42 плей-офф).
    // Источник: https://www.vhlru/players/22769/
    "22769": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 376 }
      ]
    },
    // Егор Бабенко — 197 матчей ВХЛ по суммарной статистике лиги.
    // Источник: https://www.vhlru/players/21263/
    "21263": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 197 }
      ]
    },
    // Егор Попов — 337 матчей ВХЛ (278 регулярных + 59 плей-офф).
    // Источник: https://www.vhlru/players/22248/
    "22248": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 337 }
      ]
    },
    // Дмитрий Жукенов — 258 матчей ВХЛ (226 регулярных + 32 плей-офф).
    // Источник: https://www.vhlru/players/21980/
    "21980": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 258 }
      ]
    },
    // Владимир Барабанов — 442 матча ВХЛ и 208 матчей МХЛ.
    // Источники: https://www.vhlru/stats/players/all/
    // https://mhl.khl.ru/players/20973/
    "20973": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 442 },
        { scope: "career", league: "MHL", gp: 208 }
      ]
    },
    // Павел Ткаченко — 371 матч ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/players/21799/
    "21799": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 371 }
      ]
    },
    // Глеб Кузьмин — 309 матчей ВХЛ (160 регулярных + 21 плей-офф и другие сезоны).
    // Источник: https://www.vhlru/players/22170/
    "22170": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 309 }
      ]
    },
    // Игорь Угольников — 329 матчей ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/players/21132/
    "21132": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 329 }
      ]
    },
    // Евгений Киселёв — 246 матчей ВХЛ (240 регулярных + 6 плей-офф).
    // Источник: https://www.vhlru/players/22131/
    "22131": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 246 }
      ]
    },
    // Дамир Рахимуллин — 318 матчей ВХЛ (250 регулярных + 68 плей-офф).
    // Источник: https://www.vhlru/players/23638/
    "23638": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 318 }
      ]
    },
    // Юрий Крамаренко — 245 матчей ВХЛ (228 регулярных + 17 плей-офф).
    // Источник: https://www.vhlru/players/23757/
    "23757": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 245 }
      ]
    },
    // Николай Богатов — 388 матчей ВХЛ (364 регулярных + 24 плей-офф).
    // Источник: https://www.vhlru/players/22837/
    "22837": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 388 }
      ]
    },
    // Максим Баин — 432 матча ВХЛ (381 регулярный + 51 плей-офф).
    // Источник: https://www.vhlru/players/23192/
    "23192": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 432 }
      ]
    },
    // Михаил Мещеряков — 403 матча ВХЛ (375 регулярных + 28 плей-офф).
    // Источник: https://www.vhlru/players/22687/
    "22687": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 403 }
      ]
    },
    // Владислав Джиошвили — 206 матчей ВХЛ (170 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/23508/
    "23508": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 206 }
      ]
    },
    // Семён Сухов — 388 матчей ВХЛ (372 регулярных + 16 плей-офф).
    // Источник: https://www.vhlru/players/23717/
    "23717": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 388 }
      ]
    },
    // Степан Грымзин — 317 матчей ВХЛ (305 регулярных + 12 плей-офф).
    // Источник: https://www.vhlru/players/23743/
    "23743": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 317 }
      ]
    },
    // Никита Громов — 337 матчей ВХЛ (326 регулярных + 11 плей-офф).
    // Источник: https://www.vhlru/players/22615/
    "22615": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 337 }
      ]
    },
    // Константин Колмагоров — 176 матчей ВХЛ по официальной суммарной статистике.
    // Источник: https://www.vhlru/players/29696/
    "29696": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 176 }
      ]
    },
    // Андрей Сковронский — 175 матчей ВХЛ (157 регулярных + 18 плей-офф).
    // Источник: https://www.vhlru/players/23786/
    "23786": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 175 }
      ]
    },
    // Никита Лысенков — 194 матча ВХЛ и 157 матчей МХЛ.
    // Источники: https://www.vhlru/players/23358/
    // https://mhl.khl.ru/players/23358/
    "23358": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 194 },
        { scope: "career", league: "MHL", gp: 157 }
      ]
    },
    // Владислав Сухачёв — 268 матчей ВХЛ (226 регулярных + 42 плей-офф).
    // Источник: https://www.vhlru/players/21097/
    "21097": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 268 }
      ]
    },
    // Павел Воронков — 371 матч ВХЛ (336 регулярных + 35 плей-офф).
    // Источник: https://www.vhlru/players/23521/
    "23521": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 371 }
      ]
    },
    // Георгий Кузнецов — 171 матч ВХЛ (158 регулярных + 13 плей-офф).
    // Источник: https://www.vhlru/players/23337/
    "23337": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 171 }
      ]
    },
    // Владислав Курбатов — 443 матча ВХЛ (379 регулярных + 64 плей-офф).
    // Источник: https://www.vhlru/players/22590/
    "22590": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 443 }
      ]
    },
    // Александр Протапович — 410 матчей ВХЛ по карьерной статистике
    // (398 регулярных матчей и 12 матчей плей-офф).
    // Источники: https://www.vhlru/players/20363/
    // https://www.quanthockey.com/vhl/en/birth-year/active-vhl-players-born-in-1996.html
    "20363": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 410 }
      ]
    },
    // Илья Талалуев — 143 матча ВХЛ (97 регулярных + 46 плей-офф).
    // Источник: https://www.vhlru/players/24027/
    "24027": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 143 }
      ]
    },
    // Максим Афанасьев — 380 матчей ВХЛ по актуальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/defenses/
    "22616": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 380 }
      ]
    },
    // Дмитрий Лозебников — 194 матча ВХЛ (158 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/23157/
    "23157": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 194 }
      ]
    },
    // Артём Манукян — 152 матча ВХЛ (148 регулярных + 4 плей-офф).
    // Источник: https://www.vhlru/players/23242/
    "23242": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 152 }
      ]
    },
    // Александр Подкорытов — 454 матча ВХЛ (414 регулярных + 40 плей-офф).
    // Источник: https://www.vhlru/players/23250/
    "23250": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 454 }
      ]
    },
    // Никита Колесников — 291 матч ВХЛ (276 регулярных + 15 плей-офф).
    // Источник: https://www.vhlru/players/23780/
    "23780": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 291 }
      ]
    },
    // Даниил Лапин — 371 матч ВХЛ (340 регулярных + 31 плей-офф).
    // Источник: https://www.vhlru/players/23353/
    "23353": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 371 }
      ]
    },
    // Александр Шепелев — 148 матчей ВХЛ и 152 матча КХЛ.
    // Источники: https://www.vhlru/lenta/607845/
    // https://ru.wikipedia.org/wiki/Шепелев,_Александр_Сергеевич
    "23447": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 148 },
        { scope: "career", league: "KHL", gp: 152 }
      ]
    },
    // Владимир Михасёнок — 227 матчей ВХЛ (210 регулярных + 17 плей-офф).
    // Источники: https://www.vhlru/players/24406/
    // https://silasporta.ru/athletes/vladimir-mikhasenok/
    "24406": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 227 }
      ]
    },
    // Павел Синявский — 277 матчей ВХЛ (252 регулярных + 25 плей-офф).
    // Источник: https://www.vhlru/players/23928/
    "23928": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 277 }
      ]
    },
    // Сергей Голоднюк — 282 матча ВХЛ (242 регулярных + 40 плей-офф).
    // Источник: https://www.vhlru/players/23742/
    "23742": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 282 }
      ]
    },
    // Илья Авраменко — 503 матча ВХЛ и 111 матчей МХЛ.
    // Источники: https://www.vhlru/players/23483/
    // https://mhl.khl.ru/players/23483/
    "23483": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 503 },
        { scope: "career", league: "MHL", gp: 111 }
      ]
    },
    // Ильдар Абдеев — 383 матча ВХЛ (343 регулярных + 40 плей-офф).
    // Источник: https://www.vhlru/players/25357/
    "25357": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 383 }
      ]
    },
    // Денис Толпегин — 267 матчей ВХЛ (261 регулярный + 6 плей-офф).
    // Источник: https://www.vhlru/players/23526/
    "23526": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 267 }
      ]
    },
    // Дмитрий Зайцев — 272 матча ВХЛ (252 регулярных + 20 плей-офф).
    // Источник: https://www.vhlru/players/20988/
    "20988": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 272 }
      ]
    },
    // Антон Назаревич — 302 матча ВХЛ (220 регулярных + 82 плей-офф).
    // Источник: https://www.vhlru/players/23650/
    "23650": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 302 }
      ]
    },
    // Анатолий Елизаров — 477 матчей ВХЛ по публикации клуба от 16.06.2026.
    // Источник: https://www.vhlru/lenta/604253/
    "22749": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 477 }
      ]
    },
    // Александр Федотов — ВХЛ 517, МХЛ 109 и МХЛ-Б 53 матча.
    // Совпадают ФИО и дата рождения 22.08.1994.
    // Источники: https://forchecking.ru/player.php?id=10252
    // https://www.vhlru/stats/players/1306/all/14251/
    "20396": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 517 },
        { scope: "career", league: "MHL", gp: 109 },
        { scope: "career", league: "MHLB", gp: 53 }
      ]
    },
    // Артём Мальцев — ВХЛ 147, КХЛ 5, МХЛ 53, QMJHL 82 и Беларусь 44.
    // Совпадают ФИО и дата рождения 27.03.1998.
    // Источник: https://forchecking.ru/player.php?id=9314
    "22293": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 147 },
        { scope: "career", league: "KHL", gp: 5 },
        { scope: "career", league: "MHL", gp: 53 },
        { scope: "career", league: "QMJHL", gp: 82 },
        { scope: "career", league: "BELARUS", gp: 44 }
      ]
    },
    // Камиль Фазылзянов — КХЛ 121 матч; ВХЛ 66 (56 регулярных 25/26,
    // 2 регулярных 26/27 и 8 матчей плей-офф).
    // Источники: https://news.sportbox.ru/Vidy_sporta/Hokkej/Kamil_Fazylzanov_Khokkej_31101997
    // https://www.vhlru/stats/players/1306/skaters/
    "21133": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 121 },
        { scope: "career", league: "VHL", gp: 66 }
      ]
    },
    // Владислав Кара — 191 матч ВХЛ и 336 матчей КХЛ.
    // Источник: https://xn----8sbarradgag9a4bclbc2b.xn--p1ai/игроки/вхл/к/11154-кара-владислав.html
    "22888": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 191 },
        { scope: "career", league: "KHL", gp: 336 }
      ]
    },
    // Максим Рассейкин — 263 матча ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/players/22987/
    "22987": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 263 }
      ]
    },
    // Кирилл Кошурников — 66 матчей ВХЛ (60 регулярных + 6 плей-офф).
    // Источник: https://www.vhlru/players/23455/
    "23455": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 66 }
      ]
    },
    // Александр Севостьянов — 332 матча ВХЛ (295 регулярных + 37 плей-офф).
    // Источник: https://www.vhlru/players/23226/
    "23226": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 332 }
      ]
    },
    // Евгений Сорокин — 380 матчей ВХЛ (344 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/25292/
    "25292": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 380 }
      ]
    },
    // Павел Кукштель — 321 матч ВХЛ (240 регулярных + 81 плей-офф).
    // Источник: https://www.vhlru/players/23349/
    "23349": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 321 }
      ]
    },
    // Дмитрий Соколов — ВХЛ 164, КХЛ 115, МХЛ 35, OHL 214,
    // АХЛ 118 и ECHL 2 матча.
    // Источник: https://forchecking.ru/player.php?id=12296
    "21013": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 164 },
        { scope: "career", league: "KHL", gp: 115 },
        { scope: "career", league: "MHL", gp: 35 },
        { scope: "career", league: "OHL", gp: 214 },
        { scope: "career", league: "AHL", gp: 118 },
        { scope: "career", league: "ECHL", gp: 2 }
      ]
    },
    // Никита Соколов — ВХЛ 359, КХЛ 114, МХЛ 117 и NAHL 48 матчей.
    // Источник: https://forchecking.ru/player.php?id=17979
    "23884": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 359 },
        { scope: "career", league: "KHL", gp: 114 },
        { scope: "career", league: "MHL", gp: 117 },
        { scope: "career", league: "NAHL", gp: 48 }
      ]
    },
    // Игорь Швырёв — 98 матчей ВХЛ (73 регулярных + 25 плей-офф).
    // Источник: https://www.vhlru/players/23300/
    "23300": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 98 }
      ]
    },
    // Марсель Шолохов — 252 матча ВХЛ (235 регулярных + 17 плей-офф).
    // Источник: https://www.vhlru/players/23452/
    "23452": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 252 }
      ]
    },
    // Егор Фатеев — 226 матчей КХЛ по турнирной истории Sportbox.
    // Источник: https://s-cdn.sportbox.ru/Vidy_sporta/Hokkej/Jegor_Fatejev_Khokkej_03111997/turnir_16236
    "22746": {
      position: "forward",
      career: [
        { scope: "career", league: "KHL", gp: 226 }
      ]
    },
    // Егор Баранов — ВХЛ 274, КХЛ 41 и чемпионат Словакии 3 матча.
    // Совпадают ФИО и дата рождения 27.12.1998.
    // Источник: https://forchecking.ru/player.php?id=14959
    "25529": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 274 },
        { scope: "career", league: "KHL", gp: 41 },
        { scope: "career", league: "SLOVAK", gp: 3 }
      ]
    },
    // Дмитрий Алексеев — 43 матча КХЛ и 3 матча плей-офф ВХЛ.
    // Источник: https://s-cdn.sportbox.ru/Vidy_sporta/Hokkej/Dmitrij_Vitaljevich_Aleksejev_Khokkej_17021998/turnir_19795
    "23249": {
      position: "defense",
      career: [
        { scope: "career", league: "KHL", gp: 43 },
        { scope: "career", league: "VHL", gp: 3 }
      ]
    },
    // Семён Панкратов — ВХЛ 224, КХЛ 196 и МХЛ 165 матчей.
    // Совпадают ФИО и дата рождения 26.05.1998.
    // Источники: https://www.vhlru.ru/players/23546/
    // https://www.eliteprospects.com/player/337864/semyon-pankratov
    "23546": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 224 },
        { scope: "career", league: "KHL", gp: 196 },
        { scope: "career", league: "MHL", gp: 165 }
      ]
    },
    // Евгений Калабушкин — 301 матч ВХЛ (263 регулярных + 38 плей-офф).
    // Источник: https://www.vhlru/players/23835/
    "23835": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 301 }
      ]
    },
    // Булат Мотыгуллин — 218 матчей регулярных чемпионатов ВХЛ.
    // Источник: https://www.vhlru/players/27140/
    "27140": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 218 }
      ]
    },
    // Аким Тришин — 55 матчей ВХЛ по актуальной суммарной статистике.
    // Источник: https://www.vhlru/stats/players/1374/all/15024/
    "24805": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 55 }
      ]
    },
    // Владислав Червоненко — 228 матчей ВХЛ (205 регулярных + 23 плей-офф).
    // Источник: https://www.vhlru/players/24650/
    "24650": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 228 }
      ]
    },
    // Ислам Хасанов — 385 матчей ВХЛ (343 регулярных + 42 плей-офф).
    // Источник: https://www.vhlru/players/24904/
    "24904": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 385 }
      ]
    },
    // Ярослав Алексеев — 17 матчей ВХЛ в сезоне 2026/27 на 13.11.2026.
    // Источник: https://silasporta.ru/athletes/yaroslav-alekseev/
    "24571": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 17 }
      ]
    },
    // Никита Гончаров — 215 матчей МХЛ и 1 матч ВХЛ.
    // Источники: https://mhl.khl.ru/players/24857/
    // https://www.vhlru/players/24857/
    "24857": {
      position: "forward",
      career: [
        { scope: "career", league: "MHL", gp: 215 },
        { scope: "career", league: "VHL", gp: 1 }
      ]
    },
    // Кирилл Максимов — 117 матчей ВХЛ (101 регулярный + 16 плей-офф).
    // Источник: https://www.vhlru/players/24890/
    "24890": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 117 }
      ]
    },
    // Кирилл Устименко — 102 матча ВХЛ и 145 матчей МХЛ.
    // Источники: https://www.vhlru/players/24830/
    // https://mhl.khl.ru/players/24830/
    "24830": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 102 },
        { scope: "career", league: "MHL", gp: 145 }
      ]
    },
    // Никита Аноховский — 202 матча ВХЛ и 56 матчей НМХЛ.
    // Источники: https://www.vhlru/players/24389/
    // https://nmhl.fhr.ru/players/24389/
    "24389": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 202 },
        { scope: "career", league: "NMHL", gp: 56 }
      ]
    },
    // Иван Козлов — 298 матчей ВХЛ (257 регулярных + 41 плей-офф).
    // Источник: https://www.vhlru/players/24382/
    "24382": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 298 }
      ]
    },
    // Даниил Огирчук — 352 матча ВХЛ (309 регулярных + 43 плей-офф).
    // Источник: https://www.vhlru/players/24651/
    "24651": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 352 }
      ]
    },
    // Егор Круженков — 301 матч ВХЛ (280 регулярных + 21 плей-офф).
    // Источник: https://www.vhlru/players/24995/
    "24995": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 301 }
      ]
    },
    // Даниил Скориков — 342 матча ВХЛ (312 регулярных + 30 плей-офф).
    // Источник: https://www.vhlru/players/24539/
    "24539": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 342 }
      ]
    },
    // Владислав Рыбаков — 243 матча ВХЛ (213 регулярных + 30 плей-офф).
    // Источник: https://www.vhlru/players/24386/
    "24386": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 243 }
      ]
    },
    // Кирилл Спиценко — 272 матча ВХЛ и 10 матчей КХЛ.
    // Источники: https://www.vhlru/players/24781/
    // https://ru.wikipedia.org/wiki/Спиценко,_Кирилл_Максимович
    "24781": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 272 },
        { scope: "career", league: "KHL", gp: 10 }
      ]
    },
    // Иван Ширяев — 195 матчей ВХЛ (172 регулярных + 23 плей-офф).
    // Источник: https://www.vhlru/players/25175/
    "25175": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 195 }
      ]
    },
    // Константин Кузмаул — 26 матчей ВХЛ в сезоне 2026/27 на 13.11.2026.
    // Источник: https://www.vhlru/stats/players/1230/all/13653/
    "24874": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 26 }
      ]
    },
    // Егор Жданов — 63 матча ВХЛ (58 регулярных + 5 плей-офф).
    // Источник: https://www.vhlru/players/25274/
    "25274": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 63 }
      ]
    },
    // Илья Кожухов — 285 матчей ВХЛ (249 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/25605/
    "25605": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 285 }
      ]
    },
    // Богдан Денисевич — 244 матча ВХЛ (224 регулярных + 20 плей-офф).
    // Источник: https://www.vhlru/players/25014/
    "25014": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 244 }
      ]
    },
    // Андрей Грищенко — 74 матча ВХЛ по суммарной статистике официальной карточки.
    // Источник: https://www.vhlru/players/44175/
    "44175": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 74 }
      ]
    },
    // Макар Ваулин — 65 матчей ВХЛ и 194 матча МХЛ.
    // Источники: https://www.vhlru/players/25041/
    // https://mhl.khl.ru/players/25041/
    "25041": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 65 },
        { scope: "career", league: "MHL", gp: 194 }
      ]
    },
    // Игорь Зенчиков — 378 матчей ВХЛ (347 регулярных + 31 плей-офф).
    // Источник: https://vhlru.ru/players/24394/
    "24394": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 378 }
      ]
    },
    // Максим Марушев — 285 матчей ВХЛ (252 регулярных + 33 плей-офф).
    // Источник: https://www.vhlru/players/24304/
    "24304": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 285 }
      ]
    },
    // Искандер Мулюков — 322 матча ВХЛ (280 регулярных + 42 плей-офф).
    // Источник: https://www.vhlru/players/24557/
    "24557": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 322 }
      ]
    },
    // Алексей Липанов — 259 матчей ВХЛ (230 регулярных + 29 плей-офф).
    // Источник: https://www.vhlru/players/24577/
    "24577": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 259 }
      ]
    },
    // Семён Переляев — 391 матч ВХЛ (348 регулярных + 43 плей-офф).
    // Источник: https://www.vhlru/players/24838/
    "24838": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 391 }
      ]
    },
    // Михаил Шалагин — 209 матчей ВХЛ и 149 матчей МХЛ.
    // Источники: https://www.vhlru/players/24806/
    // https://mhl.khl.ru/players/24806/
    "24806": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 209 },
        { scope: "career", league: "MHL", gp: 149 }
      ]
    },
    // Тимур Шарифьянов — 225 матчей регулярных чемпионатов ВХЛ.
    // Источник: https://www.vhlru/players/24008/
    "24008": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 225 }
      ]
    },
    // Александр Ляхов — 367 матчей ВХЛ (341 регулярный + 26 плей-офф).
    // Источник: https://www.vhlru/players/24836/
    "24836": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 367 }
      ]
    },
    // Кирилл Кожевников — 219 матчей ВХЛ (196 регулярных + 23 плей-офф).
    // Источник: https://www.vhlru/players/24261/
    "24261": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 219 }
      ]
    },
    // Марк Павликов — 417 матчей ВХЛ и 176 матчей МХЛ.
    // Источники: https://www.vhlru/players/24649/
    // https://mhl.khl.ru/players/24649/
    "24649": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 417 },
        { scope: "career", league: "MHL", gp: 176 }
      ]
    },
    // Егор Егоров — 16 матчей ВХЛ в сезоне 2026/27 на 13.11.2026.
    // Источник: https://www.vhlru/stats/players/1230/all/13641/
    "25227": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 16 }
      ]
    },
    // Евгений Каницкий — 483 матча ВХЛ и 95 матчей МХЛ.
    // Источники: https://www.vhlru/players/23735/
    // https://mhl.khl.ru/players/23735/
    "23735": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 483 },
        { scope: "career", league: "MHL", gp: 95 }
      ]
    },
    // Павел Колтыгин — 148 матчей ВХЛ (131 регулярный + 17 плей-офф).
    // Источник: https://www.vhlru/players/24042/
    "24042": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 148 }
      ]
    },
    // Георгий Дедов — 231 матч ВХЛ и 95 матчей МХЛ.
    // Источники: https://www.vhlru/players/24858/
    // https://mhl.khl.ru/players/24858/
    "24858": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 231 },
        { scope: "career", league: "MHL", gp: 95 }
      ]
    },
    // Максим Колмыков — 335 матчей ВХЛ (317 регулярных + 18 плей-офф).
    // Источник: https://www.vhlru/players/24399/
    "24399": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 335 }
      ]
    },
    // Айдар Галимов — 131 матч ВХЛ по суммарной статистике официальной карточки.
    // Источник: https://www.vhlru/players/24560/
    "24560": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 131 }
      ]
    },
    // Василий Филяев — 196 матчей ВХЛ (168 регулярных + 28 плей-офф).
    // Источник: https://www.vhlru/players/40381/
    "40381": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 196 }
      ]
    },
    // Сергей Колесников — ВХЛ 272, КХЛ 9, МХЛ 31, НМХЛ 37,
    // Словакия 13 и ВХЛ-Б 2 матча.
    // Источники: https://www.flashscorekz.com/player/kolesnikov-sergei/p47GYcEc/
    // https://forchecking.ru/player.php?id=18213
    "25074": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 272 },
        { scope: "career", league: "KHL", gp: 9 },
        { scope: "career", league: "MHL", gp: 31 },
        { scope: "career", league: "NMHL", gp: 37 },
        { scope: "career", league: "SLOVAK", gp: 13 },
        { scope: "career", league: "RUSSIAN_FIRST", gp: 2 }
      ]
    },
    // Юрий Кожухов — 298 матчей ВХЛ (254 регулярных + 44 плей-офф).
    // Источники: https://www.vhlru/players/25604/
    // https://xn----8sbarradgag9a4bclbc2b.xn--p1ai/игроки/вхл/к/11885-кожухов-юрий.html
    "25604": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 298 }
      ]
    },
    // Андрей Гришаков — 299 матчей ВХЛ (275 регулярных + 24 плей-офф).
    // Источник: https://www.vhlru/players/24800/
    "24800": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 299 }
      ]
    },
    // Данил Мокрушев — 245 матчей ВХЛ (211 регулярных + 34 плей-офф).
    // Источник: https://www.vhlru/players/25018/
    "25018": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 245 }
      ]
    },
    // Иван Васин — 20 матчей ВХЛ в сезоне 2026/27 на 13.11.2026.
    // Источник: https://silasporta.ru/athletes/ivan-vasin/
    "24825": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 20 }
      ]
    },
    // Леонид Николенко — 64 матча ВХЛ (55 регулярных + 9 плей-офф).
    // Источник: https://www.vhlru/players/24837/
    "24837": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 64 }
      ]
    },
    // Илья Гатиятулин — 247 матчей ВХЛ (233 регулярных + 14 плей-офф).
    // Источник: https://www.vhlru/players/26297/
    "26297": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 247 }
      ]
    },
    // Роман Папст — 297 матчей ВХЛ по официальной суммарной статистике лиги.
    // Источник: https://www.vhlru/stats/players/all/all/81/
    "25063": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 297 }
      ]
    },
    // Тимур Ибрагимов — 56 матчей ВХЛ (50 регулярных + 6 плей-офф).
    // Источник: https://www.vhlru/players/25559/
    "25559": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 56 }
      ]
    },
    // Данил Гизатуллин — 379 матчей ВХЛ (320 регулярных + 59 плей-офф).
    // Источник: https://www.vhlru/players/25395/
    "25395": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 379 }
      ]
    },
    // Максим Махрин — 307 матчей ВХЛ (287 регулярных + 20 плей-офф).
    // Источник: https://vhlru.ru/players/27564/
    "27564": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 307 }
      ]
    },
    // Иван Ежов — 139 матчей ВХЛ (118 регулярных + 21 плей-офф).
    // Источник: https://vhlru.ru/players/31847/
    "31847": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 139 }
      ]
    },
    // Николай Майоров — 298 матчей ВХЛ (271 регулярный + 27 плей-офф).
    // Источник: https://www.vhlru.ru/players/32162/
    "32162": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 298 }
      ]
    },
    // Данил Савунов — 307 матчей ВХЛ и 2 матча МХЛ.
    // Источники: https://www.vhlru/players/25722/
    // https://mhl.khl.ru/players/25722/
    "25722": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 307 },
        { scope: "career", league: "MHL", gp: 2 }
      ]
    },
    // Иван Лапшин — 285 матчей ВХЛ (249 регулярных + 36 плей-офф).
    // Источник: https://www.vhlru/players/25176/
    "25176": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 285 }
      ]
    },
    // Никита Рожков — 204 матча ВХЛ по официальной статистике.
    // Источник: https://www.vhlru/players/27912/
    "27912": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 204 }
      ]
    },
    // Егор Алексеев — ВХЛ 227, КХЛ 34 и МХЛ 172 матча.
    // Источник: https://forchecking.ru/player.php?id=15074
    "25813": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 227 },
        { scope: "career", league: "KHL", gp: 34 },
        { scope: "career", league: "MHL", gp: 172 }
      ]
    },
    // Владислав Лещенко — 81 матч ВХЛ (70 регулярных + 11 плей-офф).
    // Источник: https://www.vhlru/players/31667/
    "31667": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 81 }
      ]
    },
    // Вячеслав Сараев — 90 матчей ВХЛ и 18 матчей КХЛ.
    // Совпадают ФИО и дата рождения 17.03.2000.
    // Источники: https://ru.wikipedia.org/wiki/Сараев,_Вячеслав_Викторович
    // https://dynamospb.ru/vhl/players/saraev-vyacheslav_vhl/
    "26654": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 90 },
        { scope: "career", league: "KHL", gp: 18 }
      ]
    },
    // Дмитрий Шаров — 71 матч ВХЛ (68 регулярных + 3 плей-офф).
    // Источник: https://www.vhlru/players/26842/
    "26842": {
      position: "goaltender",
      career: [
        { scope: "career", league: "VHL", gp: 71 }
      ]
    },
    // Владислав Михайлов — 50 матчей регулярных чемпионатов ВХЛ
    // (40 в сезоне 2025/26 и 10 в сезоне 2026/27).
    // Источник: https://www.vhlru/players/4491/
    "4491": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 50 }
      ]
    },
    // Эмиль Галиаскаров — 330 матчей ВХЛ (295 регулярных + 35 плей-офф).
    // Источник: https://www.vhlru/players/31706/
    "31706": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 330 }
      ]
    },
    // Илья Аввакумов — 330 матчей ВХЛ (295 регулярных + 35 плей-офф).
    // Источник: https://www.vhlru/players/30342/
    "30342": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 330 }
      ]
    },
    // Даниил Валитов — 232 матча ВХЛ (206 регулярных + 26 плей-офф).
    // Источник: https://www.vhlru/players/25801/
    "25801": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 232 }
      ]
    },
    // Егор Манин — 242 матча ВХЛ (214 регулярных + 28 плей-офф).
    // Источник: https://www.vhlru/players/26267/
    "26267": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 242 }
      ]
    },
    // Антон Малышев — 101 матч ВХЛ (90 регулярных + 11 плей-офф).
    // Источник: https://www.vhlru/players/25402/
    "25402": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 101 }
      ]
    },
    // Семён Асташевский — 1 матч ВХЛ по официальной статистике.
    // Источник: https://www.vhlru/players/26339/
    "26339": {
      position: "defense",
      career: [
        { scope: "career", league: "VHL", gp: 1 }
      ]
    },
    // Никита Долгопятов — 130 матчей ВХЛ (125 регулярных + 5 плей-офф).
    // Источник: https://www.vhlru/players/27244/
    "27244": {
      position: "forward",
      career: [
        { scope: "career", league: "VHL", gp: 130 }
      ]
    },
  }
};
