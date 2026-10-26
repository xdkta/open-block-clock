/* Open Block Clock — data + rendering. No build step, no dependencies. */
(() => {
  'use strict';

  // ---------- config ----------

  const params = new URLSearchParams(location.search);
  const C = Object.assign({}, window.OBC_CONFIG);
  C.refresh = Object.assign({ tip: 10 }, C.refresh);
  if (params.has('api')) C.apiBase = params.get('api');
  if (params.has('theme')) C.theme = params.get('theme');
  if (params.has('flash')) C.newBlockFlash = params.get('flash') !== '0';

  const API = C.apiBase.replace(/\/+$/, '');
  const HALVING_INTERVAL = 210000;
  const THEMES = ['dark', 'light'];
  const THEME_NAMES = { dark: 'Dark', light: 'Light' };

  const state = {
    tip: null,
    lastOk: 0,
  };

  // ---------- helpers ----------

  const $ = (id) => document.getElementById(id);

  function setText(id, text) {
    const el = $(id);
    if (el && el.textContent !== String(text)) el.textContent = text;
    return el;
  }

  // Thousands are separated by a (non-breaking) space instead of a comma.
  const groupWithSpaces = (s) => s.replace(/,/g, ' ');
  const int = (n) => groupWithSpaces(Math.round(n).toLocaleString('en-US'));

  // Scale a .fit-text element so it fills its .fit container.
  function fit(el) {
    if (!el) return;
    const box = el.closest('.fit') || el.parentElement;
    el.style.fontSize = '100px';
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(box.clientWidth / w, box.clientHeight / h) * 0.98;
    el.style.fontSize = `${Math.max(10, Math.floor(100 * scale))}px`;
  }

  function fitAll() {
    document.querySelectorAll('.fit-text').forEach(fit);
  }

  // ---------- network ----------

  async function get(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(API + path, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      const type = res.headers.get('content-type') || '';
      const data = type.includes('json') ? await res.json() : await res.text();
      state.lastOk = Date.now();
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function warn(err) {
    console.warn('[open-block-clock]', err && err.message ? err.message : err);
  }

  async function loadTip() {
    const h = Number(await get('/blocks/tip/height'));
    if (!Number.isFinite(h)) throw new Error('bad tip height');
    const isNew = state.tip !== null && h > state.tip;
    state.tip = h;
    renderTip();
    if (isNew) newBlock(h);
  }

  // Run fn every `sec` seconds without overlapping calls.
  function every(sec, fn) {
    const run = async () => {
      try { await fn(); } catch (e) { warn(e); }
      setTimeout(run, sec * 1000);
    };
    setTimeout(run, sec * 1000);
  }

  // ---------- rendering ----------

  function renderTip() {
    if (state.tip == null) return;
    fit(setText('height', int(state.tip)));
    renderHalving();
  }

  // ---------- halving line ----------

  // The full line = one 210,000-block halving epoch, from the block that
  // started it to the next halving block. Ticks mark the quarters.
  const TICKS = [0.25, 0.5, 0.75];

  function buildHalvingTicks() {
    $('halvTrack').insertAdjacentHTML('afterbegin',
      TICKS.map((f) => `<i class="tick" style="left:${f * 100}%"></i>`).join(''));
  }

  function renderHalving() {
    if (state.tip == null) return;
    const start = Math.floor(state.tip / HALVING_INTERVAL) * HALVING_INTERVAL;
    const progress = (state.tip - start) / HALVING_INTERVAL;
    $('halvFill').style.width = `${progress * 100}%`;
    $('halvTrack').setAttribute('aria-valuenow', (progress * 100).toFixed(1));
    document.querySelectorAll('#halvTrack .tick').forEach((t, i) =>
      t.classList.toggle('on', TICKS[i] <= progress));
  }

  function newBlock(height, test = false) {
    if (!C.newBlockFlash && !test) return;
    const flash = $('flash');
    setText('flashHeight', int(height));
    flash.classList.remove('on');
    void flash.offsetWidth; // restart animation
    flash.classList.add('on');
  }

  // Preview the new-block screen without waiting for a real block.
  function testNewBlock() {
    if (state.tip != null) newBlock(state.tip, true);
  }

  // ---------- once-a-second tick ----------

  function tick() {
    const age = Date.now() - state.lastOk;
    const status = $('status').parentElement;
    let label = 'CONNECTING';
    if (state.lastOk) label = age < 90e3 ? 'LIVE' : age < 300e3 ? 'DELAYED' : 'OFFLINE';
    setText('status', label);
    status.classList.toggle('live', label === 'LIVE');
    $('app').classList.toggle('stale', label === 'OFFLINE');
  }

  function applyTheme() {
    let theme = C.theme;
    if (theme === 'auto') {
      const h = new Date().getHours();
      const night = C.nightStart > C.nightEnd
        ? h >= C.nightStart || h < C.nightEnd
        : h >= C.nightStart && h < C.nightEnd;
      theme = night ? 'dark' : 'light';
    }
    if (!THEMES.includes(theme)) theme = 'dark';
    document.documentElement.dataset.theme = theme;
    const btn = $('themeToggle');
    if (btn) btn.title = `Theme: ${THEME_NAMES[theme]}`;
  }

  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  // The ₿ button (or the T key) switches the theme, overriding the
  // configured one, and the choice is remembered on this device. A ?theme=
  // URL parameter still wins on load.
  function setTheme(theme) {
    C.theme = THEMES.includes(theme) ? theme : 'dark';
    try { localStorage.setItem('obc-theme', C.theme); } catch (e) { /* storage unavailable */ }
    applyTheme();
  }

  function initialTheme() {
    if (params.has('theme')) return;
    try {
      const saved = localStorage.getItem('obc-theme');
      if (THEMES.includes(saved)) C.theme = saved;
    } catch (e) { /* storage unavailable */ }
  }

  function burnInShift() {
    const r = () => Math.round(Math.random() * 8 - 4);
    document.body.style.transform = `translate(${r()}px, ${r()}px)`;
  }

  // ---------- boot ----------

  async function start() {
    initialTheme();
    applyTheme();
    // A browser can pair this script with a cached older page; never let a
    // missing button stop the clock from starting.
    $('themeToggle')?.addEventListener('click', toggleTheme);
    buildHalvingTicks();

    // Test the new-block screen: press N, or open with ?demo=block.
    // T toggles the theme.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') testNewBlock();
      if (e.key === 't' || e.key === 'T') toggleTheme();
    });
    if (params.get('demo') === 'block') {
      setTimeout(testNewBlock, 3000);
      setInterval(testNewBlock, 20000);
    }

    // Kiosk: hide the cursor until the mouse actually moves.
    let cursorTimer;
    window.addEventListener('mousemove', () => {
      document.body.classList.add('show-cursor');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(() => document.body.classList.remove('show-cursor'), 3000);
    });

    tick();
    setInterval(tick, 1000);
    setInterval(applyTheme, 60e3);
    if (C.burnInShift) setInterval(burnInShift, 4 * 60e3);
    if (C.reloadHours > 0) setTimeout(() => location.reload(), C.reloadHours * 3600e3);

    // Re-fit whenever the screen changes size: window resizes, and a page
    // that first laid out while hidden (zero size) once it is shown.
    let resizeTimer;
    const refit = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitAll, 150);
    };
    if (window.ResizeObserver) new ResizeObserver(refit).observe($('app'));
    else window.addEventListener('resize', refit);
    // Re-fit once the web fonts arrive: numbers measured in the fallback font
    // are narrower and would overflow once Share Tech Mono loads.
    if (document.fonts) {
      document.fonts.ready.then(fitAll);
      document.fonts.addEventListener('loadingdone', fitAll);
    }

    try { await loadTip(); } catch (e) { warn(e); }
    every(C.refresh.tip, loadTip);
  }

  start();
})();
