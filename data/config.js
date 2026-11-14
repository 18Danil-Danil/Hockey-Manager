/* Игровые настройки сложности и характеристики персонажей. */
window.GAME_CONFIG = {
DIFFICULTIES: {
  easy: {
    key: 'easy', label: '🟢 Лёгкий',
    desc: 'Стартовый баланс 100%, спонсоры +20%, потолок зарплат 75% только для вашего клуба, требование совета — топ-16, терпение 5 сезонов. Стартовая репутация 60.',
    startBalancePct: 1.0, sponsorMult: 1.20, boardRequirement: 16,
    boardPatience: 5, startReputation: 60, salaryCapPct: 0.75,
  },
  normal: {
    key: 'normal', label: '🟡 Средний',
    desc: 'Стандартные условия. Баланс 100%, спонсоры 0%, требование топ-12, терпение 3 сезона, репутация 50.',
    startBalancePct: 1.0, sponsorMult: 1.0, boardRequirement: 12,
    boardPatience: 3, startReputation: 50, salaryCapPct: 0.50,
  },
  hard: {
    key: 'hard', label: '🟠 Сложный',
    desc: 'Баланс 75%, спонсоры −15%, требование топ-8, терпение 2 сезона, репутация 40.',
    startBalancePct: 0.75, sponsorMult: 0.85, boardRequirement: 8,
    boardPatience: 2, startReputation: 40, salaryCapPct: 0.50,
  },
  hardcore: {
    key: 'hardcore', label: '🔴 Хардкор',
    desc: 'Баланс 50%, спонсоры −30%, требование топ-4, терпение 1 сезон, репутация 25. Потолок зарплат −10%.',
    startBalancePct: 0.50, sponsorMult: 0.70, boardRequirement: 4,
    boardPatience: 1, startReputation: 25, salaryCapPct: 0.45,
  },
},

CHARACTERS: {
  leader:   { key: 'leader',   label: 'Лидер',        cls: 'char-leader',   desc: 'Вдохновляет команду. +1 мораль всем при победе, −1 при поражении. Снижает конфликты.' },
  worker:   { key: 'worker',   label: 'Трудяга',      cls: 'char-worker',   desc: 'Форма растёт быстрее, но устаёт на 20% быстрее.' },
  egoist:   { key: 'egoist',   label: 'Эгоист',       cls: 'char-egoist',   desc: '+5% к голам. −2 морали, если не в топ-6 или команда проигрывает.' },
  calm:     { key: 'calm',     label: 'Хладнокровный', cls: 'char-calm',    desc: 'Не падает мораль от поражений (только от личных провалов), но и не растёт от побед.' },
},
CHARACTER_WEIGHTS: { leader: 0.25, worker: 0.30, egoist: 0.20, calm: 0.25 },
};


// На лёгкой сложности дополнительное место под потолком получает только клуб игрока.
function applyDifficultySalaryCaps(teams, playerTeamId, difficulty) {
  const easy = difficulty && difficulty.key === 'easy';
  (teams || []).forEach(team => {
    const pct = easy && Number(team.id) === Number(playerTeamId)
      ? difficulty.salaryCapPct
      : easy ? 0.50 : difficulty.salaryCapPct;
    team.finance = team.finance || {};
    team.finance.salaryCap = Math.round(Number(team.finance.seasonBudget || 0) * pct);
  });
}
