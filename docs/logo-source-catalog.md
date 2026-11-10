# Каталог недостающих логотипов — Hockey Manager

> Составлено по официальным страницам лиг и клубов, проверенным 10 ноября 2026 года. Наличие URL не означает разрешение на копирование, хранение или коммерческое использование эмблем. До письменного согласования ссылки служат только для внутренней инвентаризации.

## Итог аудита

- ВХЛ: 30 клубов, в `data/teams.js` у всех есть внешняя ссылка на логотип.
- МХЛ: 34 команды, в `data/youth-clubs.js` логотипы не заданы. Официальный сайт МХЛ публикует эмблемы команд; найденные адреса ведут на изображения 40×40 px.
- РХЛ: 26 команд в игровом файле не имеют поля логотипа. Официальный сайт РХЛ публикует клубные эмблемы размером 200×200 px на страницах клубов.
- В репозитории нет отдельной папки с локальными файлами логотипов; интерфейс выводит `team.logo` как внешнее изображение и использует текстовый fallback.

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

## Что не делать до ответа правообладателей

1. Не скачивать и не включать официальные эмблемы в публичную сборку только на основании того, что они доступны на сайтах лиг.
2. Не считать разрешение лиги автоматическим разрешением на товарные знаки каждого клуба.
3. Не считать разрешение на некоммерческое использование разрешением на размещение игры с рекламой, внутриигровыми покупками или платными функциями.
4. Не привязывать текущие эмблемы РХЛ к командам с изменившимися названиями без подтверждения соответствия.

## Рекомендуемый следующий шаг

Запросить у МХЛ и ФХР официальные файлы логотипов в SVG/PNG с прозрачным фоном и достаточным разрешением, а также письменное подтверждение объёма лицензии для игры, включая коммерческое распространение. После получения разрешений хранить изображения локально в `assets/logos/`, а не зависеть от сторонних URL.