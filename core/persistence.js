/* ============================================================
   СОХРАНЕНИЕ (с seed — фикс #9)
   ============================================================ */
const SAVE_KEY = 'hockey_save_v2';
const SAVE_DB_NAME = 'hockey_manager_storage';
const SAVE_DB_VERSION = 1;
const SAVE_DB_STORE = 'saves';
let _saveDbPromise = null;
let _saveTimer = null;
let _saveQueue = Promise.resolve();
let _saveWaiters = [];
let _saveNotify = false;
let _lastSaveError = null;
let _autoSaveWarningShown = false;

function openSaveDatabase() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (_saveDbPromise) return _saveDbPromise;
  _saveDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVE_DB_STORE)) db.createObjectStore(SAVE_DB_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { _saveDbPromise = null; resolve(null); };
      request.onblocked = () => { _saveDbPromise = null; resolve(null); };
    } catch (error) { _saveDbPromise = null; resolve(null); }
  });
  return _saveDbPromise;
}

async function readStoredSave() {
  const db = await openSaveDatabase();
  if (db) {
    const value = await new Promise(resolve => {
      try {
        const tx = db.transaction(SAVE_DB_STORE, 'readonly');
        const request = tx.objectStore(SAVE_DB_STORE).get('career');
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (error) { resolve(null); }
    });
    if (value) return value;
  }
  try { return localStorage.getItem(SAVE_KEY) || localStorage.getItem('hockey_save_v1'); }
  catch (error) { return null; }
}

async function writeStoredSave(serialized) {
  const db = await openSaveDatabase();
  if (db) {
    const stored = await new Promise(resolve => {
      try {
        const tx = db.transaction(SAVE_DB_STORE, 'readwrite');
        tx.objectStore(SAVE_DB_STORE).put({ id: 'career', value: serialized, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (error) { resolve(false); }
    });
    if (stored) {
      _lastSaveError = null;
      // Освобождаем старую квоту localStorage после успешного переноса сохранения в IndexedDB.
      try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('hockey_save_v1'); } catch (error) {}
      return true;
    }
  }
  try {
    localStorage.setItem(SAVE_KEY, serialized);
    _lastSaveError = null;
    return true;
  } catch (error) {
    _lastSaveError = error;
    console.error('Ошибка сохранения карьеры:', error);
    return false;
  }
}

function getSaveSnapshot() {
  return {
    league: G.league, playerTeamId: G.playerTeamId, activeTab: G.activeTab, screen: G.screen,
    standingsSort: G.standingsSort, idCounter: _idCounter,
    selectedDifficulty: G.selectedDifficulty, noFireMode: G.noFireMode, career: G.career,
    careerOffers: G.careerOffers, freeAgentOffers: G.freeAgentOffers,
    lastRegularChampionId: G.lastRegularChampionId, lastCupHolderId: G.lastCupHolderId, lastFinalistId: G.lastFinalistId,
    lastRoundResults: G.lastRoundResults, lastRoundNumber: G.lastRoundNumber,
    settings: G.settings || null,
    seed: getSeed(),
  };
}

async function saveGame(options = {}) {
  if (!G.league) return false;
  const promise = new Promise(resolve => _saveWaiters.push(resolve));
  _saveNotify = _saveNotify || options.notify === true;
  if (_saveTimer) clearTimeout(_saveTimer);
  const runSave = () => {
    _saveTimer = null;
    const waiters = _saveWaiters.splice(0);
    const notify = _saveNotify;
    _saveNotify = false;
    const task = _saveQueue.then(async () => {
      try { return await writeStoredSave(JSON.stringify(getSaveSnapshot())); }
      catch (error) { _lastSaveError = error; console.error('Ошибка сохранения карьеры:', error); return false; }
    });
    _saveQueue = task.catch(() => false);
    task.then(success => {
      waiters.forEach(resolve => resolve(success));
      if (success) _autoSaveWarningShown = false;
      if (notify && typeof showToast === 'function') {
        if (success) showToast('Игра успешно сохранена', 'success');
        else showToast('Не удалось сохранить игру. Хранилище браузера недоступно или переполнено.', 'error', 7000);
      } else if (!success && !_autoSaveWarningShown && typeof showToast === 'function') {
        _autoSaveWarningShown = true;
        showToast('Автосохранение не удалось. Нажмите «Сохранить» или проверьте хранилище браузера.', 'error', 7000);
      }
    });
  };
  if (options.immediate) runSave();
  else _saveTimer = setTimeout(runSave, 900);
  return promise;
}

async function manualSaveGame() {
  return await saveGame({ immediate: true, notify: true });
}

async function loadGame() {
  try {
    const raw = await readStoredSave();
    if (!raw) return false;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || !data.league) return false;
    G.league = data.league;
    // Сначала резервируем имена из старого сохранения: ниже может создаваться недостающая молодёжная структура.
    if (typeof hydratePlayerNameRegistry === 'function') hydratePlayerNameRegistry(G.league);
    G.league.season = normalizeSeasonLabel(G.league.season);
    if (!Array.isArray(G.league.schedule) || !G.league.schedule.length) G.league.schedule = makeSchedule(G.league.teams);
    ensureScheduleCalendar(G.league);
    (G.league.history || []).forEach(h => { h.season = normalizeSeasonLabel(h.season); });
    G.playerTeamId = data.playerTeamId || null;
    G.activeTab = data.activeTab || 'standings'; G.screen = data.screen || 'select';
    G.standingsSort = data.standingsSort || { key: 'pts', dir: 'desc' };
    _idCounter = data.idCounter || 1;
    // ⚙️ ФИКС #9: восстанавливаем RNG seed
    setSeed(data.seed || 20241111);
    G.selectedDifficulty = data.selectedDifficulty || 'normal';
    G.noFireMode = data.noFireMode || false;
    G.settings = normalizeGameSettings(data.settings);
    applyGameSettings();
    G.career = data.career || { reputation: 50, history: [] };
    (G.career.history || []).forEach(h => { h.season = normalizeSeasonLabel(h.season); });
    for (const list of [G.league.transferLog, G.league.news, G.league.inbox, G.league.retiredPlayers]) {
      (list || []).forEach(item => { if (item.season !== undefined) item.season = normalizeSeasonLabel(item.season); });
    }
    G.league.teams.forEach(t => {
      (t.history || []).forEach(h => { h.season = normalizeSeasonLabel(h.season); });
      if (t.trophies) for (const key of ['petrov', 'regular', 'opening', 'finals']) {
        t.trophies[key] = (t.trophies[key] || []).map(normalizeSeasonLabel);
      }
    });
    G.careerOffers = data.careerOffers || null;
    G.freeAgentOffers = data.freeAgentOffers || null;
    G.lastRegularChampionId = data.lastRegularChampionId;
    G.lastCupHolderId = data.lastCupHolderId;
    G.lastFinalistId = data.lastFinalistId;
    G.lastRoundResults = Array.isArray(data.lastRoundResults) ? data.lastRoundResults : null;
    G.lastRoundNumber = data.lastRoundNumber || null;
    if (!G.league.youth) G.league.youth = initYouthLeagues();
    normalizeYouthLeagues();
    G.difficulty = DIFFICULTIES[G.selectedDifficulty] || DIFFICULTIES.normal;
    G.league.aiTradeOffers = G.league.aiTradeOffers || [];
    G.league.allTimeLeaders = G.league.allTimeLeaders || { skaters: {} };
    G.league.inbox = G.league.inbox || [];
    G.league.news = G.league.news || [];
    G.league.retiredPlayers = G.league.retiredPlayers || [];
    G.league.openingCup = G.league.openingCup || null;
    G.league.retroMatch = G.league.retroMatch || null;
    G.liveMatch = null;
    G.league.teams.forEach(t => {
      if (!t.ratings) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.ratings = meta ? { ...meta.ratings } : { att: 70, def: 70, gk: 70, st: 70 }; }
      if (t.talent === undefined) t.talent = 70;
      if (t.prestige === undefined) t.prestige = 50;
      if (!t.trend) t.trend = 'stable';
      if (!t.trophies) t.trophies = { petrov: [], regular: [], opening: [] };
      if (!t.history) t.history = [];
      if (!t.rivals) t.rivals = [];
      if (!t.logo) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.logo = meta ? meta.logo : ''; }
      if (t.sponsorFlow === undefined) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.sponsorFlow = meta ? meta.sponsorFlow : 3; }
      if (t.govSupport === undefined) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.govSupport = meta ? meta.govSupport : 2; }
      t.waiversUsed = t.waiversUsed || 0;
      t.bench = t.bench || [];
      if (!Array.isArray(t.sponsors)) t.sponsors = [];
      if (!t.lines) t.lines = null;
      if (!t.streak) t.streak = { type: null, count: 0 };
      if (t.lastRehabRound === undefined) t.lastRehabRound = -10;
      if (t.finance.fanBase === undefined) t.finance.fanBase = 0.5;
      if (t.finance.baseFanBase === undefined) t.finance.baseFanBase = t.finance.fanBase;
      if (!t.finance.expenses.transfers) t.finance.expenses.transfers = 0;
      if (!t.finance.merchLevel) t.finance.merchLevel = 1;
      if (t.finance.vipLevel === undefined) t.finance.vipLevel = 0;
      if (!t.finance.matchdayFlags) t.finance.matchdayFlags = { fanzone: false, show: false, kidsTickets: false };
      if (!t.finance.income.merch) t.finance.income.merch = 0;
      if (!t.finance.income.gov) t.finance.income.gov = 0;
      if (!t.scoutMission) t.scoutMission = null;
      if (!t.staff.psychologist) t.staff.psychologist = null;
      t.roster.forEach(p => {
        ensureStats(p); ensurePlayoffStats(p);
        if (!p.careerStats) p.careerStats = { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 };
        if (!p.seasonHistory) p.seasonHistory = [];
        if (p.seasonGoal === undefined) p.seasonGoal = null;
        if (p.injury === undefined) p.injury = null; if (p.fatigue === undefined) p.fatigue = 0;
        if (p.injuryPolicy === undefined) p.injuryPolicy = null;
        if (p.goalieStreak === undefined) p.goalieStreak = 0;
        if (p.lastGameBad === undefined) p.lastGameBad = false;
        if (p.playingThroughPain === undefined) p.playingThroughPain = false;
        if (p.mentorName === undefined) p.mentorName = null;
        if (p.isStarAcademy === undefined) p.isStarAcademy = false;
        if (p.lastIndTraining === undefined) p.lastIndTraining = -10;
        if (!p.character) p.character = 'calm';
        if (!p.contract.bonusPlayoff) p.contract.bonusPlayoff = 0;
        if (!p.contract.bonusMvp) p.contract.bonusMvp = 0;
        if (!p.contract.bonusTopScorer) p.contract.bonusTopScorer = 0;
      });
    });
    G.league.freeAgents.forEach(p => { ensureStats(p); if (!p.careerStats) p.careerStats = { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 }; if (!p.character) p.character = 'calm'; });
    // Регистрируем имена всех игроков сохранения, не меняя существующие записи.
    if (typeof hydratePlayerNameRegistry === 'function') hydratePlayerNameRegistry(G.league);
    // После загрузки render() поставит актуальное состояние в очередь автосохранения.
    return true;
  } catch (e) { console.error('Ошибка загрузки сохранения:', e); return false; }
}

/* ============================================================
   РЕЗЕРВНЫЕ КОПИИ: ЭКСПОРТ / ИМПОРТ КАРЬЕРЫ
   ============================================================ */
function exportCareerFile() {
  if (!G.league) {
    if (typeof showToast === 'function') showToast('Нет карьеры для экспорта', 'error');
    return false;
  }
  try {
    const backup = { format: 'hockey-manager-save', version: 1, exportedAt: new Date().toISOString(), data: getSaveSnapshot() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const season = String(G.league.season || 'career').replace(/[^0-9A-Za-zА-Яа-я_-]/g, '-');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = 'hockey-manager-' + season + '-' + date + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof showToast === 'function') showToast('Резервная копия подготовлена', 'success');
    return true;
  } catch (error) {
    console.error('Ошибка экспорта карьеры:', error);
    if (typeof showToast === 'function') showToast('Не удалось создать резервную копию', 'error');
    return false;
  }
}

function isValidCareerSave(data) {
  const save = data && data.format === 'hockey-manager-save' ? data.data : data;
  return !!(save && save.league && Array.isArray(save.league.teams) && save.league.teams.length > 0 && save.league.teams.every(team => team && Array.isArray(team.roster)));
}

async function importCareerFile(file) {
  if (!file) return false;
  if (file.size > 50 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Файл слишком большой (максимум 50 МБ)', 'error');
    return false;
  }
  let previousSave = null;
  try {
    const parsed = JSON.parse(await file.text());
    if (!isValidCareerSave(parsed)) {
      if (typeof showToast === 'function') showToast('Файл не похож на сохранение Hockey Manager', 'error');
      return false;
    }
    if (!confirm('Импорт заменит текущую карьеру. Рекомендуется сначала экспортировать резервную копию. Продолжить?')) return false;
    const saveData = parsed.format === 'hockey-manager-save' ? parsed.data : parsed;
    const serialized = JSON.stringify(saveData);
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
      await saveGame({ immediate: true });
    } else {
      await _saveQueue;
    }
    previousSave = await readStoredSave();
    if (!previousSave && G.league) previousSave = JSON.stringify(getSaveSnapshot());
    if (!await writeStoredSave(serialized)) {
      if (typeof showToast === 'function') showToast('Не удалось записать импортируемую карьеру', 'error');
      return false;
    }
    if (!await loadGame()) {
      if (previousSave) {
        await writeStoredSave(typeof previousSave === 'string' ? previousSave : JSON.stringify(previousSave));
        if (await loadGame()) { ensureAllLines(); initAISponsors(); render(); }
      }
      if (typeof showToast === 'function') showToast('Не удалось восстановить карьеру. Прежнее сохранение восстановлено.', 'error', 7000);
      return false;
    }
    ensureAllLines();
    initAISponsors();
    render();
    if (typeof showToast === 'function') showToast('Карьера успешно восстановлена из файла', 'success');
    return true;
  } catch (error) {
    console.error('Ошибка импорта карьеры:', error);
    if (previousSave) {
      try {
        await writeStoredSave(typeof previousSave === 'string' ? previousSave : JSON.stringify(previousSave));
        if (await loadGame()) { ensureAllLines(); initAISponsors(); render(); }
      } catch (restoreError) {}
    }
    if (typeof showToast === 'function') showToast('Не удалось прочитать файл сохранения', 'error');
    return false;
  }
}


function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('hockey_save_v1'); } catch (e) {}
}

// Мобильные браузеры могут выгружать вкладку при переключении приложений.
// Сохранение запускается без задержки при уходе со страницы.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !G.liveMatch) saveGame({ immediate: true });
});
window.addEventListener('pagehide', () => {
  if (!G.liveMatch) saveGame({ immediate: true });
});
