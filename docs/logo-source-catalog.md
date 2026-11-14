# Каталог недостающих логотипов — Hockey Manager

> Составлено по официальным страницам лиг и клубов, проверенным 10 ноября 2026 года. Наличие URL не означает разрешение на копирование, хранение или коммерческое использование эмблем. До письменного согласования ссылки служат только для внутренней инвентаризации.

## Итог аудита и состояние интеграции

- ВХЛ: 30 клубов, в `data/teams.js` у всех есть внешняя ссылка на логотип; интерфейс показывает её с локальной SVG-заглушкой при ошибке загрузки.
- КХЛ: 22 клуба в международном каталоге имеют внешние ссылки на изображения эмблем; проверка тестом подтверждает заполнение всех 22 ссылок.
- МХЛ: 34 команды. Все 34 игровых клуба сопоставлены с каталогом официальных изображений МХЛ (40×40 px); ссылки подключаются при создании молодёжных команд.
- РХЛ: в игровом реестре 26 команд. Подтверждённые соответствия подключены к каталогу ФХР; спорные названия (например, «Гранит», «Воевода», «Гвардия Краснодар», «Факел Салехард») намеренно не получают чужую эмблему и используют локальный fallback.
- Казахстан и Беларусь: отдельные эмблемы пока не интегрированы; для каждого клуба доступен локальный SVG-fallback. В европейских лигах подтверждены и подключены 13 прямых SVG-ссылок из каталога FootyLogos (Liiga, SHL и Swiss National League); это источник для технической интеграции, но не доказательство лицензии на коммерческое использование.
- В репозитории пока нет локальных PNG/SVG-файлов официальных клубных эмблем. Внешние URL требуют подключения к интернету; локальные SVG-заглушки работают офлайн.

## МХЛ — официальные изображения

Источник: [официальный сайт МХЛ](https://mhl.khl.ru/). Ссылки ниже — прямые изображения с домена `img.khl.ru`; размер в открытой версии сайта — 40×40 px, поэтому перед интеграцией в крупные карточки желательно запросить у лиги файлы большего разрешения.

| Команда | URL изображения |
|---|---|
| Академия Михайлова | https://img.khl.ru/clubs/ru/671/40.png |
| Динамо-Шинник | https://img.khl.ru/clubs/ru/322/40.png |
| Красная Армия | https://img.khl.ru/clubs/ru/222/40.png |
| Локо | https://img.khl.ru/clubs/ru/215/40.png |
| МХК Динамо М | https://img.khl.ru/clubs/ru/224/40.png |
| МХК Динамо СПб | https://img.khl.ru/clubs/ru/422/40.png |
| МХК Спартак | https://img.khl.ru/clubs/ru/217/40.png |
| СКА-1946 | https://img.khl.ru/clubs/ru/220/40.png |
| Тайфун | https://img.khl.ru/clubs/ru/569/40.png |
| Академия СКА | https://img.khl.ru/clubs/ru/454/40.png |
| Алмаз | https://img.khl.ru/clubs/ru/214/40.png |
| Амурские Тигры | https://img.khl.ru/clubs/ru/275/40.png |
| Красная машина Атлант | https://img.khl.ru/clubs/ru/218/40.png |
| Красная машина Юниор | https://img.khl.ru/clubs/ru/920/40.png |
| Крылья Советов | https://img.khl.ru/clubs/ru/258/40.png |
| МХК Спартак МАХ | https://img.khl.ru/clubs/ru/914/40.png |
| Сахалинские Акулы | https://img.khl.ru/clubs/ru/385/40.png |
| Авто | https://img.khl.ru/clubs/ru/225/40.png |
| Белые Медведи | https://img.khl.ru/clubs/ru/227/40.png |
| Ирбис | https://img.khl.ru/clubs/ru/226/40.png |
| Локо-76 | https://img.khl.ru/clubs/ru/425/40.png |
| Омские Ястребы | https://img.khl.ru/clubs/ru/230/40.png |
| Сибирские Снайперы | https://img.khl.ru/clubs/ru/232/40.png |
| Стальные Лисы | https://img.khl.ru/clubs/ru/233/40.png |
| Толпар | https://img.khl.ru/clubs/ru/234/40.png |
| Чайка | https://img.khl.ru/clubs/ru/223/40.png |
| АКМ-Юниор | https://img.khl.ru/clubs/ru/790/40.png |
| Красноярские Рыси | https://img.khl.ru/clubs/ru/264/40.png |
| Кузнецкие Медведи | https://img.khl.ru/clubs/ru/228/40.png |
| Мамонты Югры | https://img.khl.ru/clubs/ru/320/40.png |
| МХК Молот | https://img.khl.ru/clubs/ru/435/40.png |
| Реактор | https://img.khl.ru/clubs/ru/231/40.png |
| Снежные Барсы | https://img.khl.ru/clubs/ru/321/40.png |
| Спутник Ал | https://img.khl.ru/clubs/ru/386/40.png |

Примечание: изображение «Сахалинские Акулы» по ссылке `https://img.khl.ru/clubs/ru/385/40.png` не открылось при проверке; требуется альтернативный источник или файл от МХЛ.

## РХЛ — официальные изображения

Источник: [официальный список клубов РХЛ сезона 2026/2027](https://rhl.fhr.ru/teams/). Все ссылки получены с карточек клубов на официальном сайте `rhl.fhr.ru`; большинство изображений имеют размер 200×200 px.

| Клуб | Страница клуба | Прямое изображение |
|---|---|---|
| Арктика | https://rhl.fhr.ru/teams/66/ | https://ss.fhr.ru/files/images/league/teams/200_200/66.png?1= |
| Ахмат-Гранит | https://rhl.fhr.ru/teams/74/ | https://ss.fhr.ru/files/images/league/teams/200_200/74.png?1= |
| Витязь-Подольск | https://rhl.fhr.ru/teams/88/ | https://ss.fhr.ru/files/images/league/teams/200_200/88.png?0= |
| Динамо-576 | https://rhl.fhr.ru/teams/60/ | https://ss.fhr.ru/files/images/league/teams/200_200/60.png?1= |
| Калужские Ракеты | https://rhl.fhr.ru/teams/78/ | https://ss.fhr.ru/files/images/league/teams/200_200/78.png?1= |
| Красная Машина Академия | https://rhl.fhr.ru/teams/89/ | https://ss.fhr.ru/files/images/league/teams/200_200/89.png?1= |
| Ленинградец | https://rhl.fhr.ru/teams/80/ | https://ss.fhr.ru/files/images/league/teams/200_200/80.png?1= |
| МХК Динамо-Карелия | https://rhl.fhr.ru/teams/59/ | https://ss.fhr.ru/files/images/league/teams/200_200/59.png?1= |
| Металлург | https://rhl.fhr.ru/teams/56/ | https://ss.fhr.ru/files/images/league/teams/200_200/56.png?1= |
| Полёт | https://rhl.fhr.ru/teams/648/ | https://ss.fhr.ru/files/images/league/teams/200_200/648.png?0= |
| Тверичи-СШОР | https://rhl.fhr.ru/teams/375/ | https://ss.fhr.ru/files/images/league/teams/200_200/375.png?0= |
| Факел Ямал | https://rhl.fhr.ru/teams/67/ | https://ss.fhr.ru/files/images/league/teams/200_200/67.png?1= |
| ХК Брянск | https://rhl.fhr.ru/teams/44/ | https://ss.fhr.ru/files/images/league/teams/200_200/44.png?1= |
| Дизелист | https://rhl.fhr.ru/teams/2/ | https://ss.fhr.ru/files/images/league/teams/200_200/2.png?1= |
| МХК Белгород | https://rhl.fhr.ru/teams/27/ | https://ss.fhr.ru/files/images/league/teams/200_200/27.png?1= |
| МХК Ермак | https://rhl.fhr.ru/teams/303/ | https://ss.fhr.ru/files/images/league/teams/200_200/303.png?0= |
| МХК Кристалл | https://rhl.fhr.ru/teams/57/ | https://ss.fhr.ru/files/images/league/teams/200_200/57.png?1= |
| МХК Ростов | https://rhl.fhr.ru/teams/87/ | https://ss.fhr.ru/files/images/league/teams/200_200/87.png?1= |
| МХК Рязань-ВДВ | https://rhl.fhr.ru/teams/22/ | https://ss.fhr.ru/files/images/league/teams/200_200/22.png?1= |
| МХК Тамбов | https://rhl.fhr.ru/teams/843/ | https://ss.fhr.ru/files/images/league/teams/200_200/843.png?0= |
| Прогресс | https://rhl.fhr.ru/teams/9/ | https://ss.fhr.ru/files/images/league/teams/200_200/9.png?1= |
| Протон | https://rhl.fhr.ru/teams/70/ | https://ss.fhr.ru/files/images/league/teams/200_200/70.png?1= |
| Сокол ЧР | https://rhl.fhr.ru/teams/61/ | https://ss.fhr.ru/files/images/league/teams/200_200/61.png?1= |
| ХК Краснодар | https://rhl.fhr.ru/teams/75/ | https://ss.fhr.ru/files/images/league/teams/200_200/75.png?1= (источник подтвердил URL, загрузка изображения завершилась тайм-аутом) |
| ХК Самара | https://rhl.fhr.ru/teams/919/ | https://ss.fhr.ru/files/images/league/teams/200_200/919.png?0= |
| ЭкоНива-Бобров | https://rhl.fhr.ru/teams/64/ | https://ss.fhr.ru/files/images/league/teams/200_200/64.png?6= |

Примечание: прямая ссылка на эмблему ХК Краснодар была обнаружена в официальной карточке клуба, но загрузка изображения при проверке завершилась тайм-аутом. Её нужно перепроверить перед использованием.

## Сверка состава РХЛ с игровыми данными

Официальный состав РХЛ сезона 2026/2027 не полностью совпадает с названиями в `data/youth-clubs.js`. Есть изменения названий и состава, которые нельзя автоматически считать простыми алиасами. Примеры:

- «Гранит» в игре / «Ахмат-Гранит» на сайте РХЛ;
- «Воевода» / «Витязь-Подольск»;
- «Гвардия Краснодар» / «ХК Краснодар»;
- «Факел Салехард» / «Факел Ямал»;
- «Сокол Новочебоксарск» / «Сокол ЧР»;
- «МХК Самара» / «ХК Самара»;
- «Металлург ВО» / «Металлург» (Череповец).

Перед привязкой эмблем нужно подтвердить, что это те же команды и что игра использует именно актуальные названия сезона 2026/2027, а не историческую базу. Официальный список РХЛ на текущий сезон содержит 26 команд.

## Как это отображается в игре

Общий компонент `clubLogoWithFallback()` используется в шапке клуба, карточках выбора команды, международном трансферном рынке и таблицах МХЛ/РХЛ. Если официальный URL не задан или изображение не загружается, вместо пустого места остаётся компактный SVG-знак с инициалами. Это временный визуальный знак, а не официальная эмблема клуба.

## Что не делать до ответа правообладателей

1. Не скачивать и не включать официальные эмблемы в публичную сборку только на основании того, что они доступны на сайтах лиг.
2. Не считать разрешение лиги автоматическим разрешением на товарные знаки каждого клуба.
3. Не считать разрешение на некоммерческое использование разрешением на размещение игры с рекламой, внутриигровыми покупками или платными функциями.
4. Не привязывать текущие эмблемы РХЛ к командам с изменившимися названиями без подтверждения соответствия.

## Рекомендуемый следующий шаг

Запросить у МХЛ и ФХР официальные файлы логотипов в SVG/PNG с прозрачным фоном и достаточным разрешением, а также письменное подтверждение объёма лицензии для игры, включая коммерческое распространение. После получения разрешений хранить изображения локально в `assets/logos/`, а не зависеть от сторонних URL.

## Зарубежные лиги — проверенные каталоги и ограничения (14 ноября 2026)

### Казахстан — Pro Hokei Ligasy

Официальный каталог клубов: https://pro.ligasy.kz/ru/teams

На странице перечислены 10 клубов: Almaty, Aqtóbe, Arlan, Beibarys, Ertis, Gornyak, Nomad, Qulager, Saryarqa и Torpedo. Это подтверждает состав игрового списка Казахстана. Однако сайт отдельно ограничивает автоматизированное извлечение материалов; поэтому не использовать его как источник для массового скачивания эмблем без разрешения федерации. Страница каталога годится для ручной сверки названий, а не как разрешение на копирование логотипов.

### Беларусь — Betera-Экстралига

В качестве актуального домена лиги обнаруживается https://extra.hockey.by/; общий сайт федерации — https://hockey.by/. Для сезона 2026/27 сторонний справочник Eurohockey указывает действующую Экстралигу и официальный сайт федерации, но это не является лицензией на изображения. В игровом списке 14 клубов; перед привязкой эмблем необходимо сверить текущий список участников непосредственно с федерацией и клубами.

Отдельно: у «Шахтёра» в августе 2026 года сообщалось о смене логотипа. Старые эмблемы из исторических каталогов нельзя автоматически переносить в текущий сезон.

### Финляндия — Liiga

Официальный сайт лиги: https://liiga.fi/

В открытых технических справочных материалах описан endpoint каталога команд Liiga: https://liiga.fi/api/v2/teams/info. Он заявлен как содержащий URL логотипов команд. Перед использованием в игре нужно отдельно проверить доступность endpoint, структуру ответа, стабильность и условия использования; это кандидат на интеграцию, а не уже подтверждённый разрешённый источник.

Сверка состава: публичный каталог логотипов на сезон 2026/27 содержит 17 клубов, включая Pelicans. В игровом списке Liiga сейчас 16 записей, и Pelicans отсутствует. Это отдельное расхождение состава, которое нужно решить до автоматической привязки эмблем. Не добавлять логотип Pelicans к другому клубу и не считать список игры полным.

### Европейские клубы — сторонние каталоги для сверки

FootyLogos публикует каталоги хоккейных эмблем по лигам, в том числе Liiga, Champions Hockey League и KHL: https://www.footylogos.com/sports/ice-hockey. Это удобный визуальный справочник для обнаружения расхождений и поиска названий, но не официальный источник клубов и не автоматическое разрешение на встраивание файлов в Hockey Manager. Сайт просит указывать его как источник при использовании файлов; для включения изображений в игру всё равно требуется проверить права и условия распространения.

### Решение по интеграции

1. Не добавлять в игру прямые URL с неофициальных агрегаторов только ради заполнения поля logo.
2. Для Liiga сначала проверить официальный API и получить подтверждение условий использования у лиги.
3. Для Казахстана и Беларуси запросить у федераций/клубов пресс-паки или письменное разрешение на использование эмблем в игре.
4. До подтверждения прав оставлять локальный SVG-fallback. Он гарантирует, что клубы не будут отображаться с чужими или устаревшими эмблемами.


## Проверка логотипов ВХЛ — Южный Урал и Калуга (14 ноября 2026)

- **Южный Урал:** проверена карточка клуба на официальном сайте ВХЛ: https://www.vhlru.ru/teams/388/. Прямая эмблема из карточки: https://www.vhlru.ru/upload/iblock/cda/ЮУ.png. Старый путь `/upload/iblock/f37/ЮУ.png` заменён.
- **Калуга:** проверена карточка клуба на официальном сайте ВХЛ: https://www.vhlru.ru/teams/603516/. Прямая эмблема из карточки: https://www.vhlru.ru/upload/iblock/625/Калуга.png. Старый внешний файл EliteProspects заменён на актуальную эмблему, опубликованную на сайте ВХЛ.
- Обе ссылки открывают изображения эмблем, соответствующие названиям клубов. Проверка визуально подтверждена через карточки ВХЛ; тест `tests/club-logos.test.js` фиксирует точные URL, чтобы случайная подмена не вернулась.


## Продолжение интеграции прямых URL — 14 ноября 2026

- **МХЛ:** все 34 игровых клуба уже имеют сопоставление с официальным каталогом изображений `img.khl.ru`; ссылки формируются по проверенным ID клуба и выводятся через общий `clubLogoWithFallback()`.
- **РХЛ:** к 19 ранее сопоставленным клубам добавлены два подтверждённых переименования: «Гранит Чехов» → «Ахмат-Гранит» (ФХР сообщает о переезде и смене названия) и «Факел Салехард» → «Факел Ямал». Неоднозначные соответствия «Воевода» → «Витязь-Подольск» и «Гвардия Краснодар» → «ХК Краснодар» намеренно не назначались.
- **Трансферный рынок:** добавлены прямые SVG URL для Ässät (Liiga), Brynäs IF (SHL) и HC Davos (Swiss National League). URL ведут на отдельные карточки логотипов FootyLogos; в каталоге клуба проверяются название и принадлежность к соответствующей лиге.
- Остальные команды трансферного рынка пока сохраняют fallback до проверки индивидуальных страниц/файлов. Наличие логотипа в публичном каталоге само по себе не подтверждает право на коммерческое использование в игре.
- В `tests/club-logos.test.js` добавлены точные проверки трёх новых рыночных URL и двух RHL alias-сопоставлений.

## Дополнительные клубные эмблемы европейских лиг — 14 ноября 2026

Добавлены ещё 10 эмблем с индивидуальных страниц FootyLogos; на страницах подтверждены название клуба, страна/лига и доступность SVG-файла. Сайт просит указывать FootyLogos как источник. Ссылки используются для внутренней тестовой сборки; перед публичным или коммерческим распространением требуется отдельная проверка прав.

| Лига | Клуб | Страница-источник | Прямой SVG |
|---|---|---|---|
| Liiga | Tappara | https://www.footylogos.com/logos/tappara | https://www.footylogos.com/sports-assets/logos/tappara/tappara-logo-footylogos.svg |
| Liiga | Ilves | https://www.footylogos.com/logos/ilves-ice-hockey | https://www.footylogos.com/sports-assets/logos/ilves-ice-hockey/ilves-ice-hockey-logo-footylogos.svg |
| Liiga | HIFK | https://www.footylogos.com/logos/hifk-ice-hockey | https://www.footylogos.com/sports-assets/logos/hifk-ice-hockey/hifk-ice-hockey-logo-footylogos.svg |
| Liiga | HPK | https://www.footylogos.com/logos/hpk | https://www.footylogos.com/sports-assets/logos/hpk/hpk-logo-footylogos.svg |
| Liiga | TPS | https://www.footylogos.com/logos/hc-tps | https://www.footylogos.com/sports-assets/logos/hc-tps/hc-tps-logo-footylogos.svg |
| SHL | Frölunda HC | https://www.footylogos.com/logos/frolunda-hc | https://www.footylogos.com/sports-assets/logos/frolunda-hc/frolunda-hc-logo-footylogos.svg |
| SHL | Färjestad BK | https://www.footylogos.com/logos/farjestad-bk | https://www.footylogos.com/sports-assets/logos/farjestad-bk/farjestad-bk-logo-footylogos.svg |
| Swiss National League | ZSC Lions | https://www.footylogos.com/logos/zsc-lions | https://www.footylogos.com/sports-assets/logos/zsc-lions/zsc-lions-logo-footylogos.svg |
| Swiss National League | EV Zug | https://www.footylogos.com/logos/ev-zug | https://www.footylogos.com/sports-assets/logos/ev-zug/ev-zug-logo-footylogos.svg |
| Swiss National League | SC Bern | https://www.footylogos.com/logos/sc-bern | https://www.footylogos.com/sports-assets/logos/sc-bern/sc-bern-logo-footylogos.svg |

Всего в игровом каталоге международных клубов теперь 13 проверенных ссылок FootyLogos: предыдущие Ässät, Brynäs IF и HC Davos плюс 10 перечисленных выше. Тест tests/club-logos.test.js фиксирует точное соответствие ID клуба и URL, остальные клубы продолжают использовать fallback.
## Ещё пять подтверждённых европейских клубов — 14 ноября 2026

| Лига | Клуб | Страница-источник | Прямой SVG |
|---|---|---|---|
| Чехия · Extraliga | Dynamo Pardubice | https://www.footylogos.com/logos/hc-dynamo-pardubice | https://www.footylogos.com/sports-assets/logos/hc-dynamo-pardubice/hc-dynamo-pardubice-logo-footylogos.svg |
| Чехия · Extraliga | Kometa Brno | https://www.footylogos.com/logos/hc-kometa-brno | https://www.footylogos.com/sports-assets/logos/hc-kometa-brno/hc-kometa-brno-logo-footylogos.svg |
| Германия · DEL | Adler Mannheim | https://www.footylogos.com/logos/adler-mannheim | https://www.footylogos.com/sports-assets/logos/adler-mannheim/adler-mannheim-logo-footylogos.svg |
| Словакия · Extraliga | HC Slovan Bratislava | https://www.footylogos.com/logos/hc-slovan-bratislava | https://www.footylogos.com/sports-assets/logos/hc-slovan-bratislava/hc-slovan-bratislava-logo-footylogos.svg |
| Словакия · Extraliga | HC Košice | https://www.footylogos.com/logos/hc-kosice | https://www.footylogos.com/sports-assets/logos/hc-kosice/hc-kosice-logo-footylogos.svg |

Все пять клубов присутствуют в соответствующих лигах игрового каталога. Ссылки получены с индивидуальных карточек FootyLogos, где указаны нужная хоккейная лига и доступность SVG; условия использования эмблем проверяются отдельно.
## Ещё девять подтверждённых эмблем — 14 ноября 2026

| Лига | Клуб | Страница-источник | Прямой SVG |
|---|---|---|---|
| Liiga | Jukurit | https://www.footylogos.com/logos/jukurit | https://www.footylogos.com/sports-assets/logos/jukurit/jukurit-logo-footylogos.svg |
| Liiga | JYP | https://www.footylogos.com/logos/jyp | https://www.footylogos.com/sports-assets/logos/jyp/jyp-logo-footylogos.svg |
| Liiga | Lukko | https://www.footylogos.com/logos/lukko | https://www.footylogos.com/sports-assets/logos/lukko/lukko-logo-footylogos.svg |
| Liiga | Vaasan Sport | https://www.footylogos.com/logos/vaasan-sport | https://www.footylogos.com/sports-assets/logos/vaasan-sport/vaasan-sport-logo-footylogos.svg |
| Liiga | Kärpät | https://www.footylogos.com/logos/karpat | https://www.footylogos.com/sports-assets/logos/karpat/karpat-logo-footylogos.svg |
| Swiss National League | Fribourg-Gottéron | https://www.footylogos.com/logos/fribourg-gotteron | https://www.footylogos.com/sports-assets/logos/fribourg-gotteron/fribourg-gotteron-logo-footylogos.svg |
| Swiss National League | Lausanne HC | https://www.footylogos.com/logos/lausanne-hc | https://www.footylogos.com/sports-assets/logos/lausanne-hc/lausanne-hc-logo-footylogos.svg |
| Swiss National League | Genève-Servette HC | https://www.footylogos.com/logos/geneve-servette | https://www.footylogos.com/sports-assets/logos/geneve-servette/geneve-servette-logo-footylogos.svg |
| Swiss National League | HC Lugano | https://www.footylogos.com/logos/hc-lugano | https://www.footylogos.com/sports-assets/logos/hc-lugano/hc-lugano-logo-footylogos.svg |

Индивидуальные карточки подтверждают хоккейную принадлежность клубов и соответствующие лиги сезона 2026/27. Прямые адреса SVG зафиксированы в тестах. Всего внесено 27 эмблем международного рынка вне КХЛ; все остальные клубы используют fallback до аналогичной проверки.
## Дополнение: Kiekko-Espoo, KalPa и семь клубов SHL — 14 ноября 2026

Девять прямых SVG-адресов получены через кнопку SVG на индивидуальных карточках FootyLogos. Для Kiekko-Espoo и KalPa страницы подтверждают Liiga 2026/27; для семи шведских клубов ссылки взяты из каталога SHL 2026/27 и индивидуальных карточек клубов.

| Лига | Клуб | Страница-источник | Прямой SVG |
|---|---|---|---|
| Liiga | Kiekko-Espoo | https://www.footylogos.com/logos/kiekko-espoo | https://www.footylogos.com/sports-assets/logos/kiekko-espoo/kiekko-espoo-logo-footylogos.svg |
| Liiga | KalPa | https://www.footylogos.com/logos/kalpa | https://www.footylogos.com/sports-assets/logos/kalpa/kalpa-logo-footylogos.svg |
| SHL | Djurgårdens IF | https://www.footylogos.com/logos/djurgardens-if-hockey | https://www.footylogos.com/sports-assets/logos/djurgardens-if-hockey/djurgardens-if-hockey-logo-footylogos.svg |
| SHL | HV71 | https://www.footylogos.com/logos/hv71 | https://www.footylogos.com/sports-assets/logos/hv71/hv71-logo-footylogos.svg |
| SHL | Linköping HC | https://www.footylogos.com/logos/linkoping-hc | https://www.footylogos.com/sports-assets/logos/linkoping-hc/linkoping-hc-logo-footylogos.svg |
| SHL | Luleå Hockey | https://www.footylogos.com/logos/lulea-hockey | https://www.footylogos.com/sports-assets/logos/lulea-hockey/lulea-hockey-logo-footylogos.svg |
| SHL | Rögle BK | https://www.footylogos.com/logos/rogle-bk | https://www.footylogos.com/sports-assets/logos/rogle-bk/rogle-bk-logo-footylogos.svg |
| SHL | Skellefteå AIK | https://www.footylogos.com/logos/skelleftea-aik | https://www.footylogos.com/sports-assets/logos/skelleftea-aik/skelleftea-aik-logo-footylogos.svg |
| SHL | Växjö Lakers | https://www.footylogos.com/logos/vaxjo-lakers | https://www.footylogos.com/sports-assets/logos/vaxjo-lakers/vaxjo-lakers-logo-footylogos.svg |

Все девять соответствий добавлены в tests/club-logos.test.js. FootyLogos просит указывать источник; включение в игру не означает передачу прав на клубные товарные знаки.
## Ещё эмблемы SHL и чешской Extraliga — 14 ноября 2026

| Лига | Клуб | Страница-источник | Прямой SVG |
|---|---|---|---|
| SHL | Malmö Redhawks | https://www.footylogos.com/logos/malmo-redhawks | https://www.footylogos.com/sports-assets/logos/malmo-redhawks/malmo-redhawks-logo-footylogos.svg |
| SHL | Örebro HK | https://www.footylogos.com/logos/orebro-hk | https://www.footylogos.com/sports-assets/logos/orebro-hk/orebro-hk-logo-footylogos.svg |
| SHL | Timrå IK | https://www.footylogos.com/logos/timra-ik | https://www.footylogos.com/sports-assets/logos/timra-ik/timra-ik-logo-footylogos.svg |
| Czech Extraliga | Oceláři Třinec | https://www.footylogos.com/logos/hc-ocelari-trinec | https://www.footylogos.com/sports-assets/logos/hc-ocelari-trinec/hc-ocelari-trinec-logo-footylogos.svg |
| Czech Extraliga | HC Sparta Praha | https://www.footylogos.com/logos/hc-sparta-praha | https://www.footylogos.com/sports-assets/logos/hc-sparta-praha/hc-sparta-praha-logo-footylogos.svg |
| Czech Extraliga | Motor České Budějovice | https://www.footylogos.com/logos/motor-ceske-budejovice | https://www.footylogos.com/sports-assets/logos/motor-ceske-budejovice/motor-ceske-budejovice-logo-footylogos.svg |

Ссылки извлечены через SVG download на индивидуальных карточках FootyLogos. Malmö Redhawks присутствует в игровом файле под двумя ID (malmo и malmo-redhawks), поэтому один и тот же официальный SVG назначен обоим записям, чтобы обе карточки отображались корректно. Для внешнего использования необходимо отдельно проверить права на клубные знаки.