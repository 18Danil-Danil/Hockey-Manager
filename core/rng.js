/* ============================================================
   ГЕНЕРАТОР СЛУЧАЙНЫХ ЧИСЕЛ И ОБЩИЕ МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
   Classic script: API доступен через window.GAME_RNG.
   Алгоритм и порядок вызовов сохранены для совместимости сохранений.
   ============================================================ */
(() => {
  let seed = 20241111;
  // Отдельный поток для косметической анимации. Никогда не используем его в игровой логике.
  let visualSeed = 1357911;

  function setSeed(s) { seed = Math.max(1, Math.floor(s)); }
  function getSeed() { return seed; }
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function setVisualSeed(s) { visualSeed = Math.max(1, Math.floor(Math.abs(Number(s) || 1)) % 2147483646); }
  function visualRng() { visualSeed = (visualSeed * 48271) % 2147483647; return (visualSeed - 1) / 2147483646; }
  function randInt(a, b) { return Math.floor(rng() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function gauss(m, sd) { const u = 1 - rng(), v = rng(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function poisson(lambda) { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
  function pickWeighted(items, weightFn) { let total = 0; for (const it of items) total += weightFn(it); if (total <= 0) return pick(items); let r = rng() * total; for (const it of items) { r -= weightFn(it); if (r <= 0) return it; } return items[items.length - 1]; }
  function timeToSec(t) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
  function randomTime() { return `${randInt(1, 19)}:${String(randInt(0, 59)).padStart(2, '0')}`; }

  window.GAME_RNG = { setSeed, getSeed, rng, setVisualSeed, visualRng, randInt, pick, gauss, clamp, poisson, pickWeighted, timeToSec, randomTime };
})();
