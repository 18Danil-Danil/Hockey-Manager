/* Импорт реальных составов ВХЛ из локально подготовленного JSON.
 * Игра не обращается к vhlru.ru напрямую: браузерный CORS и условия источника
 * не позволяют безопасно встраивать прямой скрейпинг в клиент.
 */
(function () {
  const STORAGE_KEY = 'hockey_manager_vhl_rosters_v1';
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_TEAMS = 40;
  const MAX_PLAYERS_PER_TEAM = 60;
  const ALLOWED_COUNTRIES = new Set(['Россия','Беларусь','Казахстан','Канада','США','Финляндия','Швеция','Чехия','Словакия','Латвия','Германия','Швейцария','Дания','Норвегия','Украина']);
  const COUNTRIES = {
    Russia: 'Россия', Belarus: 'Беларусь', Kazakhstan: 'Казахстан',
    Canada: 'Канада', USA: 'США', Finland: 'Финляндия', Sweden: 'Швеция',
    Czechia: 'Чехия', Slovakia: 'Словакия', Latvia: 'Латвия',
    Germany: 'Германия', Switzerland: 'Швейцария', Denmark: 'Дания',
    Norway: 'Норвегия', Ukraine: 'Украина'
  };

  function normalizeCountry(country) {
    const value = String(country || '').trim();
    return COUNTRIES[value] || value;
  }

  function validateVhlImport(data) {
    if (!data || data.source !== 'vhlru' || !Array.isArray(data.teams) ||
        data.teams.length < 1 || data.teams.length > MAX_TEAMS) {
      throw new Error('Файл не похож на экспорт состава ВХЛ.');
    }
    const teamSlugs = new Set();
    const teams = data.teams.map(team => {
      if (!team || typeof team.teamSlug !== 'string' ||
          !/^[a-z0-9-]{2,40}$/.test(team.teamSlug) ||
          !Array.isArray(team.players) || team.players.length < 1 ||
          team.players.length > MAX_PLAYERS_PER_TEAM) {
        throw new Error('В файле обнаружен некорректный клуб или состав.');
      }
      if (teamSlugs.has(team.teamSlug)) throw new Error('Клуб повторяется в файле: ' + team.teamSlug);
      teamSlugs.add(team.teamSlug);
      const ids = new Set();
      const players = team.players.map(player => {
        const playerId = Number(player.playerId);
        const jersey = player.jersey === null || player.jersey === '' ? null : Number(player.jersey);
        const name = String(player.name || '').trim();
        const position = String(player.position || '').toLowerCase();
        const country = normalizeCountry(player.country);
        const born = String(player.born || '');
        const heightCm = player.heightCm == null || player.heightCm === '' ? null : Number(player.heightCm);
        const weightKg = player.weightKg == null || player.weightKg === '' ? null : Number(player.weightKg);
        if (!Number.isSafeInteger(playerId) || playerId <= 0 ||
            !name || name.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(name) ||
            !['forward', 'defense', 'goaltender'].includes(position) ||
            (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99))) {
          throw new Error('Некорректная запись игрока в составе ' + team.teamName + '.');
        }
        if (!ALLOWED_COUNTRIES.has(country)) {
          throw new Error('Неизвестное гражданство игрока ' + name + ': ' + (country || 'не указано') + '.');
        }
        if (ids.has(playerId)) throw new Error('Повторяется ID игрока ' + playerId + '.');
        ids.add(playerId);
        if (born) {
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(born)) {
            throw new Error('Некорректная дата рождения игрока ' + name + '.');
          }
          const [day, month, year] = born.split('.').map(Number);
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            throw new Error('Несуществующая дата рождения игрока ' + name + '.');
          }
        }
        if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 130 || heightCm > 230)) {
          throw new Error('Некорректный рост игрока ' + name + '.');
        }
        if (weightKg !== null && (!Number.isInteger(weightKg) || weightKg < 40 || weightKg > 160)) {
          throw new Error('Некорректный вес игрока ' + name + '.');
        }
        return {
          playerId, name, position, jersey,
          born: born || null,
          country,
          heightCm,
          weightKg,
          playerUrl: 'https://www.vhlru.ru/players/' + playerId + '/'
        };
      });
      const forwardCount = players.filter(player => player.position === 'forward').length;
      const defenseCount = players.filter(player => player.position === 'defense').length;
      const goalieCount = players.filter(player => player.position === 'goaltender').length;
      if (forwardCount < 12 || defenseCount < 6 || goalieCount < 2) {
        throw new Error('Состав ' + (team.teamName || team.teamSlug) + ' неполный: нужно минимум 12 нападающих, 6 защитников и 2 вратаря.');
      }
      return {
        teamPageId: Number(team.teamPageId) || null,
        teamSlug: team.teamSlug,
        teamName: String(team.teamName || team.teamSlug).slice(0, 80),
        rosterAsOf: String(team.rosterAsOf || '').slice(0, 20),
        players
      };
    });
    return {
      schemaVersion: 1,
      source: 'vhlru',
      importedAt: String(data.exportedAt || new Date().toISOString()).slice(0, 40),
      teams
    };
  }

  function readImportedVhlData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? validateVhlImport(JSON.parse(raw)) : null;
    } catch (error) {
      console.warn('Не удалось прочитать импортированные составы ВХЛ:', error);
      return null;
    }
  }

  function getImportedVhlRoster(teamSlug) {
    const data = readImportedVhlData();
    return data?.teams.find(team => team.teamSlug === teamSlug) || null;
  }

  function ageFromBirthDate(value) {
    if (!value) return null;
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!match) return null;
    const birth = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age >= 15 && age <= 50 ? age : null;
  }

  function makeImportedVhlPlayer(source, index, teamMeta) {
    const isGoalie = source.position === 'goaltender';
    const isDefense = source.position === 'defense';
    const position = isGoalie ? 'G' : isDefense ? 'D' : ['C', 'LW', 'RW'][index % 3];
    const target = isGoalie ? teamMeta.ratings.gk : isDefense ? teamMeta.ratings.def : teamMeta.ratings.att;
    const player = genPlayer(position, clamp(Math.round(target + gauss(0, 3)), 52, 95), {
      nationality: source.country
    });
    const age = ageFromBirthDate(source.born);
    player.name = source.name;
    player.nationality = source.country;
    if (age !== null) {
      player.age = age;
      player.contract = contractFor(player.ovr, age);
    }
    player.source = 'vhlru';
    player.sourcePlayerId = source.playerId;
    player.sourcePlayerUrl = source.playerUrl;
    player.jerseyNumber = source.jersey;
    player.birthDate = source.born;
    player.heightCm = source.heightCm;
    player.weightKg = source.weightKg;
    player.sourcePosition = source.position;
    if (typeof normalizePlayerNameKey === 'function') {
      getPlayerNameRegistry().add(normalizePlayerNameKey(player.name));
    }
    return player;
  }

  function buildImportedVhlRoster(teamMeta) {
    const imported = getImportedVhlRoster(teamMeta.slug);
    if (!imported) return null;
    let forwardIndex = 0;
    const players = imported.players.map(player => makeImportedVhlPlayer(player, player.position === 'forward' ? forwardIndex++ : 0, teamMeta));
    const minimum = { F: 12, D: 6, G: 2 };
    const counts = {
      F: players.filter(p => ['C', 'LW', 'RW'].includes(p.position)).length,
      D: players.filter(p => p.position === 'D').length,
      G: players.filter(p => p.position === 'G').length
    };
    if (counts.F < minimum.F || counts.D < minimum.D || counts.G < minimum.G) {
      throw new Error('Состав ' + imported.teamName + ' неполный: нужно минимум 12 нападающих, 6 защитников и 2 вратаря.');
    }
    return { players, rosterAsOf: imported.rosterAsOf, sourceTeamName: imported.teamName };
  }

  async function importVhlRosterFile(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast('Файл слишком большой (максимум 2 МБ).', 'error');
      input.value = '';
      return;
    }
    try {
      const parsed = validateVhlImport(JSON.parse(await file.text()));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      const total = parsed.teams.reduce((sum, team) => sum + team.players.length, 0);
      showToast('Импортировано клубов: ' + parsed.teams.length + ', игроков: ' + total + '. Новые карьеры будут использовать реальные составы.', 'success', 7000);
      render();
    } catch (error) {
      showToast(error.message || 'Не удалось импортировать файл ВХЛ.', 'error', 7000);
    } finally {
      input.value = '';
    }
  }

  function clearImportedVhlData() {
    if (!confirm('Удалить импортированные составы ВХЛ? Существующие карьеры не изменятся.')) return;
    localStorage.removeItem(STORAGE_KEY);
    showToast('Импортированные составы удалены. Новые карьеры снова будут использовать генерацию.', 'success');
    render();
  }

  function renderVhlImportSettings() {
    const data = readImportedVhlData();
    const safeText = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const summary = data
      ? data.teams.map(team => '<li>' + safeText(team.teamName) + ': ' + team.players.length + ' игроков' +
          (team.rosterAsOf ? ' · на ' + safeText(team.rosterAsOf) : '') + '</li>').join('')
      : '<li>Пока нет импортированных составов.</li>';
    return `<article class="settings-card vhl-import-card">
      <div class="settings-card-icon">🏒</div>
      <h3>Реальные составы ВХЛ</h3>
      <p>Загрузи JSON, подготовленный локальным инструментом импорта. Реальные составы будут использоваться при создании новых карьер. Уже начатые карьеры не меняются.</p>
      <label class="vhl-import-file">Выбрать JSON-файл<input type="file" accept=".json,application/json" onchange="importVhlRosterFile(this)"></label>
      <ul class="vhl-import-summary">${summary}</ul>
      ${data ? '<button class="btn secondary" type="button" onclick="clearImportedVhlData()">Удалить импортированные данные</button>' : ''}
      <div class="settings-footnote">Источник: vhlru.ru. Не импортируются фотографии. Использование и распространение данных требуют проверки разрешений правообладателя.</div>
    </article>`;
  }

  window.validateVhlImport = validateVhlImport;
  window.readImportedVhlData = readImportedVhlData;
  window.getImportedVhlRoster = getImportedVhlRoster;
  window.buildImportedVhlRoster = buildImportedVhlRoster;
  window.importVhlRosterFile = importVhlRosterFile;
  window.clearImportedVhlData = clearImportedVhlData;
  window.renderVhlImportSettings = renderVhlImportSettings;
})();
