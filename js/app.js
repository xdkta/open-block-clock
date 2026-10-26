/* Open Block Clock — data + rendering. No build step, no dependencies. */
(() => {
  'use strict';

  // ---------- config ----------

  const params = new URLSearchParams(location.search);
  const C = Object.assign({ currency: 'USD' }, window.OBC_CONFIG);
  C.refresh = Object.assign({ tip: 10, mempool: 30, price: 60, network: 600 }, C.refresh);
  if (params.has('api')) C.apiBase = params.get('api');
  if (params.has('theme')) C.theme = params.get('theme');
  if (params.has('currency')) C.currency = params.get('currency').toUpperCase();
  if (params.has('flash')) C.newBlockFlash = params.get('flash') !== '0';

  const API = C.apiBase.replace(/\/+$/, '');
  const HALVING_INTERVAL = 210000;
  const MAX_SUPPLY = 21e6;
  const THEMES = ['dark', 'light', 'brown', 'btc-dark', 'btc-light'];
  const THEME_NAMES = {
    dark: 'Dark', light: 'Light', brown: 'Brown Town',
    'btc-dark': 'Bitcoin Dark', 'btc-light': 'Bitcoin Light',
  };
  // The space bar steps through these, in this order.
  const VIEWS = ['height', 'halving', 'price', 'dashboard'];
  // Views you can open from the header but the space bar skips.
  const ALL_VIEWS = [...VIEWS, 'info'];

  const state = {
    tip: null,
    blocks: [],
    fees: null,
    mempool: null,
    mblocks: [],
    diff: null,
    hash: null,
    price: null,
    lastOk: 0,
    freshHeight: null,
    priceDir: null, // 'up' or 'down': which way the price last moved
    view: 'height',
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
  const pad2 = (n) => String(n).padStart(2, '0');

  function fee(f) {
    if (f == null || !Number.isFinite(f)) return '—';
    if (f < 1) return f.toFixed(2).replace(/\.?0+$/, '');
    if (f < 10) return f.toFixed(1).replace(/\.0$/, '');
    return String(Math.round(f));
  }

  function money(v, digits = 0) {
    return groupWithSpaces(new Intl.NumberFormat('en-US', {
      style: 'currency', currency: C.currency,
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(v));
  }

  function duration(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d) return `${d}D ${h}H`;
    if (h) return `${h}H ${pad2(m)}M`;
    if (m) return `${m}M ${pad2(s)}S`;
    return `${s}S`;
  }

  function ago(sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec < 60) return 'JUST NOW';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return (h ? `${h}H ${m}M` : `${m}M`) + ' AGO';
  }

  const shortDate = (ms) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  const monthYear = (ms) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  function hashrate(hs) {
    const eh = hs / 1e18;
    if (eh >= 1000) return [(eh / 1000).toFixed(2), 'ZH/S'];
    return [eh.toFixed(eh >= 100 ? 0 : 1), 'EH/S'];
  }

  // Coins issued through block `height` (inclusive), following the subsidy schedule.
  function supplyAt(height) {
    let sats = 0;
    let subsidy = 50e8;
    let remaining = height + 1;
    while (remaining > 0 && subsidy > 0) {
      const n = Math.min(remaining, HALVING_INTERVAL);
      sats += n * subsidy;
      remaining -= n;
      subsidy = Math.floor(subsidy / 2);
    }
    return sats / 1e8;
  }

  const subsidyAt = (height) => Math.floor(50e8 / 2 ** Math.floor(height / HALVING_INTERVAL)) / 1e8;

  // Price view: the price rounded down to the last `priceStep` mark, so the
  // number only changes when the price crosses a step.
  const stepPrice = (p) => {
    const step = C.priceStep > 0 ? C.priceStep : 500;
    return Math.floor(p / step) * step;
  };

  const avgBlockSec = () => (state.diff && state.diff.timeAvg ? state.diff.timeAvg / 1000 : 600);

  const unitPx = () => $('probe').getBoundingClientRect().width / 100;

  // Scale a .fit-text element so it fills its .fit container, leaving room
  // for anything stacked with it (e.g. the label sitting right above it).
  function fit(el) {
    if (!el) return;
    // The .fit box sets the space; the number's own parent may be a group
    // (label + number) sitting inside it.
    const box = el.closest('.fit') || el.parentElement;
    const group = el.parentElement;
    el.style.fontSize = '100px';
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const cs = getComputedStyle(group);
    const row = cs.flexDirection === 'row';
    let availW = box.clientWidth;
    let availH = box.clientHeight;
    for (const sib of group.children) {
      if (sib === el) continue;
      if (row) availW -= sib.offsetWidth + (parseFloat(cs.columnGap) || 0);
      else availH -= sib.offsetHeight + (parseFloat(cs.rowGap) || 0);
    }
    const scale = Math.min(availW / w, availH / h) * 0.98;
    el.style.fontSize = `${Math.max(10, Math.floor(100 * scale))}px`;
  }

  function fitAll() {
    document.querySelectorAll('.fit-text').forEach(fit);
  }

  // Everything sized from the screen: the fitted numbers, the chain strip
  // and the halving dial. Hidden views measure zero and are skipped.
  function layout() {
    fitAll();
    renderChain();
    renderHalvingClock();
    fitAbout();
    fitArt();
    placeViews();
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
    const changed = h !== state.tip;
    state.tip = h;
    renderTip();
    // Update the status now, not on the next tick.
    tick();
    if (changed) {
      if (isNew) state.freshHeight = h;
      await Promise.allSettled([loadBlocks(), loadMempool(), loadDifficulty()]);
    }
    if (isNew) newBlock(h);
  }

  async function loadBlocks() {
    state.blocks = await get('/v1/blocks');
    renderTip();
    renderChain();
  }

  async function loadMempool() {
    const [fees, mempool, mblocks] = await Promise.allSettled([
      get('/v1/fees/recommended'),
      get('/mempool'),
      get('/v1/fees/mempool-blocks'),
    ]);
    if (fees.status === 'fulfilled') state.fees = fees.value;
    if (mempool.status === 'fulfilled') state.mempool = mempool.value;
    if (mblocks.status === 'fulfilled') state.mblocks = mblocks.value;
    renderFees();
    renderMempool();
    renderChain();
  }

  async function loadPrice() {
    const prices = await get('/v1/prices');
    if (prices[C.currency] == null) throw new Error(`no price for ${C.currency}`);
    const price = prices[C.currency];
    const prev = state.price != null ? state.price : savedPrice().price;
    // The arrow only changes when the price crosses into another step, the
    // same moment the price view's number changes.
    if (prev != null && stepPrice(price) !== stepPrice(prev)) {
      state.priceDir = price > prev ? 'up' : 'down';
    }
    state.price = price;
    savePrice();
    renderPrice();
    renderFees();
  }

  // The last price and which way it last moved, kept on this device so the
  // price view keeps its arrow through the daily reload.
  function savedPrice() {
    try {
      const saved = JSON.parse(localStorage.getItem('obc-price'));
      if (saved && saved.currency === C.currency) return saved;
    } catch (e) { /* storage unavailable or unreadable */ }
    return {};
  }

  function savePrice() {
    try {
      localStorage.setItem('obc-price', JSON.stringify(
        { currency: C.currency, price: state.price, dir: state.priceDir }));
    } catch (e) { /* storage unavailable */ }
  }

  async function loadDifficulty() {
    state.diff = await get('/v1/difficulty-adjustment');
    renderDifficulty();
    renderHalving();
  }

  async function loadHashrate() {
    state.hash = await get('/v1/mining/hashrate/1m');
    renderHashrate();
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
    fit(setText('height2', int(state.tip)));
    fit(setText('height3', int(state.tip)));
    const last = state.blocks[0];
    if (last) setText('lastPool', (last.extras && last.extras.pool && last.extras.pool.name) || 'UNKNOWN');
    renderSupply();
    renderHalving();
  }

  function renderPrice() {
    if (state.price == null) return;
    setText('cur', C.currency);
    fit(setText('price', money(state.price)));
    setText('satsLabel', `SATS PER ${C.currency === 'USD' ? 'DOLLAR' : C.currency}`);
    setText('sats', int(1e8 / state.price));

    setText('priceValue', money(stepPrice(state.price)));
    // An up arrow after the price last stepped up, a down arrow after it last
    // stepped down. Set before fitting, since the arrow takes up width.
    const el = $('priceStep');
    el.classList.toggle('up', state.priceDir === 'up');
    el.classList.toggle('down', state.priceDir === 'down');
    fit(el);
  }

  function renderSupply() {
    if (state.tip == null) return;
    const pct = (supplyAt(state.tip) / MAX_SUPPLY) * 100;
    setText('supplyPct', `${pct.toFixed(2)}% OF 21M`);
    $('supplyBar').style.width = `${pct}%`;
  }

  function renderFees() {
    const f = state.fees;
    if (!f) return;
    setText('feeFast', fee(f.fastestFee));
    setText('feeTag', f.fastestFee <= C.lowFee ? 'LOW' : f.fastestFee >= C.highFee ? 'HIGH' : '');
    let sub = `NEXT BLOCK. 1 HOUR ${fee(f.hourFee)}.`;
    if (state.price != null) {
      const cost = (f.fastestFee * C.txVbytes / 1e8) * state.price;
      sub = `NEXT BLOCK. ~${money(cost, cost < 10 ? 2 : 0)} TO SEND.`;
    }
    setText('feeSub', sub);
  }

  function renderMempool() {
    const m = state.mempool;
    if (!m) return;
    const vmb = m.vsize / 1e6;
    setText('mpCount', int(m.count));
    setText('mpSub', `${int(Math.ceil(vmb))} BLOCKS TO CLEAR.`);
    setText('mempoolTag', vmb > 100 ? 'CONGESTED' : vmb < 2 ? 'CLEAR' : '');
  }

  function renderHashrate() {
    if (!state.hash) return;
    setText('hashrate', hashrate(state.hash.currentHashrate).join(' '));
  }

  function renderDifficulty() {
    const d = state.diff;
    if (!d) return;
    const ch = d.difficultyChange;
    setText('diffChange', `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)}%`);
    setText('diffSub', `IN ${int(d.remainingBlocks)} BLOCKS. ${shortDate(d.estimatedRetargetDate)}.`);
    $('diffBar').style.width = `${d.progressPercent}%`;
  }

  function renderChain() {
    const chain = $('chain');
    const u = unitPx();
    const width = chain.clientWidth;
    if (!width || (!state.blocks.length && !state.mblocks.length)) return;

    const slots = Math.max(3, Math.floor((width + u) / (u * 16)));
    const nPending = Math.min(state.mblocks.length, slots >= 6 ? 2 : 1);
    const nMined = Math.min(state.blocks.length, slots - nPending);
    const avg = avgBlockSec();

    const pendingHtml = state.mblocks.slice(0, nPending).map((b, i) => `
      <div class="card pending">
        <div class="h">IN ~${duration((i + 1) * avg).replace(/ \d+S$/, '')}</div>
        <div class="fee">${fee(b.medianFee)}<small>SAT/VB</small></div>
        <div class="meta">${int(b.nTx)} TXS</div>
      </div>`).reverse().join('');

    const minedHtml = state.blocks.slice(0, nMined).map((b, i) => {
      const x = b.extras || {};
      const pool = (x.pool && x.pool.name) || 'UNKNOWN';
      const cls = (i === 0 ? ' latest' : '') + (b.height === state.freshHeight ? ' fresh' : '');
      return `<div class="card mined${cls}">
        <div class="h">${int(b.height)}</div>
        <div class="fee">${fee(x.medianFee)}<small>SAT/VB</small></div>
        <div class="meta">${pool} · <span data-ts="${b.timestamp}">${ago(Date.now() / 1000 - b.timestamp)}</span></div>
      </div>`;
    }).join('');

    chain.innerHTML =
      `<div class="group" style="flex:${nPending}"><div class="label">UPCOMING.</div><div class="cards">${pendingHtml}</div></div>
       <div class="group" style="flex:${nMined}"><div class="label">MINED.</div><div class="cards">${minedHtml}</div></div>`;
  }

  // ---------- halving: line, dashboard tile and dial ----------

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
    const next = start + HALVING_INTERVAL;
    const progress = (state.tip - start) / HALVING_INTERVAL;
    $('halvFill').style.width = `${progress * 100}%`;
    $('halvTrack').setAttribute('aria-valuenow', (progress * 100).toFixed(1));
    document.querySelectorAll('#halvTrack .tick').forEach((t, i) =>
      t.classList.toggle('on', TICKS[i] <= progress));

    const left = next - state.tip;
    const secs = left * avgBlockSec();
    setText('halvBlocks', int(left));
    setText('halvSub', `~${monthYear(Date.now() + secs * 1000)}. ${subsidyAt(state.tip)} → ${subsidyAt(next)} BTC.`);
    $('halvBar').style.width = `${progress * 100}%`;

    renderHalvingClock();
  }

  // One full turn of the dial = one 210,000-block halving epoch.
  // 60 ticks (~3,500 blocks, ~24 days each), a major tick every 5.
  function renderHalvingClock() {
    const box = $('clockBox');
    const svg = $('halvClock');
    const W = box.clientWidth;
    const H = box.clientHeight;
    if (!W || !H || state.tip == null) return;

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 2;
    const next = (Math.floor(state.tip / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
    const left = next - state.tip;
    const progress = (state.tip % HALVING_INTERVAL) / HALVING_INTERVAL;
    const pt = (frac, r) => {
      const a = frac * 2 * Math.PI - Math.PI / 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };

    let s = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const [x0, y0] = pt(i / 60, R);
      const [x1, y1] = pt(i / 60, R * (major ? 0.88 : 0.93));
      const on = i / 60 <= progress ? ' on' : '';
      s += `<line class="tick${major ? ' major' : ''}${on}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
    }

    const ringR = R * 0.82;
    const circ = 2 * Math.PI * ringR;
    const ringW = Math.max(3, R * 0.035);
    s += `<circle class="ring-track" cx="${cx}" cy="${cy}" r="${ringR}" stroke-width="${ringW}"/>`;
    s += `<circle class="ring-fill" cx="${cx}" cy="${cy}" r="${ringR}" stroke-width="${ringW}"
      stroke-dasharray="${circ * progress} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>`;

    // Just the blocks left, centred in the dial.
    s += `<text class="count" x="${cx}" y="${cy}" font-size="${R * 0.42}"
      text-anchor="middle" dominant-baseline="central">${int(left)}</text>`;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
  }

  // ---------- views ----------

  // The space bar steps through VIEWS; the header buttons open any of
  // ALL_VIEWS.
  function setView(view) {
    state.view = ALL_VIEWS.includes(view) ? view : VIEWS[0];
    $('app').dataset.view = state.view;
    document.querySelectorAll('button[data-view]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    // A view can only be measured once it's shown.
    requestAnimationFrame(layout);
    syncArt();
  }

  // From a view outside the loop (info), the space bar goes back to the first.
  function nextView() {
    setView(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]);
  }

  // Screen 1 (the block height), unless a ?view= URL parameter asks for
  // another.
  function initialView() {
    return ALL_VIEWS.includes(params.get('view')) ? params.get('view') : VIEWS[0];
  }

  // ---------- about page ----------

  // The art beside the title: a bitcoin block and a bitcoin, spinning in 3D
  // and drawn in text. The block's faces are filled with the latest block's
  // hash and stamped with an orange ₿; the coin is orange hash characters
  // with a bright ₿. Drag either one to spin it; point at it to scramble it;
  // left alone, it glitches now and then. Plain ASCII only: IBM Plex Mono
  // has no box-drawing or block characters, and a fallback font's wider ones
  // would knock the art out of line.
  const ART_W = 46;
  const ART_H = 24;
  // No < > & here: the art is written as HTML.
  const GLYPHS = '01#%$@*+=/\\|:;';
  const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = { frame: 0, raf: 0, nextGlitch: 0 };

  // The ₿ stamped on the block's faces and the coin, on a 10 x 10 grid:
  // about as many rows as a face covers on screen, so it stays legible.
  const COIN = [
    '.#.#..',
    '#####.',
    '##..##',
    '#####.',
    '##..##',
    '##..##',
    '#####.',
    '.#.#..',
  ];
  const TEX = 10;
  const LIGHT = (() => { const l = [-0.4, 0.6, -0.7]; const m = Math.hypot(...l); return l.map((x) => x / m); })();
  // Stands in for the block hash until the first one arrives.
  const PLACEHOLDER_HASH = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

  const blockHash = () => (state.blocks[0] && state.blocks[0].id) || PLACEHOLDER_HASH;
  const hashTexture = () => blockHash().replace(/^0+/, '') || '0';
  const stamped = (i, j) => !!COIN[j - 1] && COIN[j - 1][i - 2] === '#';
  const lit = (n) => n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];

  function rotate([x, y, z], ax, ay) {
    const cy = Math.cos(ay); const sy = Math.sin(ay);
    const cx = Math.cos(ax); const sx = Math.sin(ax);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
  }

  // Draws points into chars/cls through a depth buffer, so nearer surfaces
  // win. A character is about twice as tall as it is wide.
  function canvas() {
    const D = 6; // camera distance
    const SX = 9.6; // columns per unit
    const SY = 5; // rows per unit
    const chars = new Array(ART_W * ART_H).fill(' ');
    const cls = new Array(ART_W * ART_H).fill('');
    const depth = new Float32Array(ART_W * ART_H).fill(Infinity);
    const plot = ([x, y, z], ch, c) => {
      const zc = z + D;
      const col = Math.round(ART_W / 2 + (x * D / zc) * SX);
      const row = Math.round(ART_H / 2 - (y * D / zc) * SY);
      if (col < 0 || col >= ART_W || row < 0 || row >= ART_H) return;
      const k = row * ART_W + col;
      if (zc >= depth[k]) return;
      depth[k] = zc;
      chars[k] = ch;
      cls[k] = c;
    };
    return { chars, cls, plot };
  }

  // Each face of the block: its outward normal, and the directions that
  // read as right (u) and up (v) when you look at it from outside.
  const FACES = [
    { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, 1], u: [-1, 0, 0], v: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  ];

  function drawBlock(p) {
    const { chars, cls, plot } = canvas();
    const tex = hashTexture();
    FACES.forEach((face, fi) => {
      const n = rotate(face.n, p.ax, p.ay);
      if (n[2] >= 0) return; // facing away
      const l = lit(n);
      const shade = l > 0.66 ? 's3' : l > 0.33 ? 's2' : 's1';
      const u = rotate(face.u, p.ax, p.ay);
      const v = rotate(face.v, p.ax, p.ay);
      for (let a = -1; a <= 1.0001; a += 0.05) {
        for (let b = -1; b <= 1.0001; b += 0.05) {
          const pt = [0, 1, 2].map((d) => n[d] + a * u[d] + b * v[d]);
          if (Math.abs(a) > 0.92 || Math.abs(b) > 0.92) { plot(pt, '#', 'e'); continue; }
          // Hash characters on a finer grid than the stamp, so each
          // character on screen gets its own digit.
          const ch = tex[(fi * 17 + Math.floor((1 - b) * TEX) * TEX * 2 + Math.floor((a + 1) * TEX)) % tex.length];
          const i = Math.min(TEX - 1, Math.floor((a + 1) / 2 * TEX));
          const j = Math.min(TEX - 1, Math.floor((1 - b) / 2 * TEX));
          plot(pt, ch, stamped(i, j) ? 'b' : shade);
        }
      }
    });
    return { chars, cls };
  }

  // A coin: two round faces and the rim between them.
  function drawCoin(p) {
    const { chars, cls, plot } = canvas();
    const tex = hashTexture();
    const T = 0.16; // half the coin's thickness
    // Scaled up so the coin fills its box about as much as the block does.
    const at = (v) => rotate(v, p.ax, p.ay).map((c) => c * 1.4);
    [-1, 1].forEach((side) => {
      const n = rotate([0, 0, side], p.ax, p.ay);
      if (n[2] >= 0) return;
      const l = lit(n);
      const shade = l > 0.66 ? 'o3' : l > 0.33 ? 'o2' : 'o1';
      for (let a = -1; a <= 1.0001; a += 0.04) {
        for (let b = -1; b <= 1.0001; b += 0.04) {
          const r = Math.hypot(a, b);
          if (r > 1) continue;
          const pt = at([a, b, side * T]);
          if (r > 0.9) { plot(pt, '#', 'b'); continue; }
          // Mirror the back face so its ₿ reads the right way round.
          const ua = side < 0 ? a : -a;
          const i = Math.min(TEX - 1, Math.floor((ua + 1) / 2 * TEX));
          const j = Math.min(TEX - 1, Math.floor((1 - b) / 2 * TEX));
          const ch = tex[(Math.floor((1 - b) * TEX) * TEX * 2 + Math.floor((ua + 1) * TEX)) % tex.length];
          plot(pt, ch, stamped(i, j) ? 'e' : shade);
        }
      }
    });
    for (let t = 0; t < Math.PI * 2; t += 0.03) {
      const n = rotate([Math.cos(t), Math.sin(t), 0], p.ax, p.ay);
      if (n[2] >= 0) continue;
      for (let z = -T; z <= T + 0.0001; z += 0.04) {
        plot(at([Math.cos(t), Math.sin(t), z]), '#', 'o3');
      }
    }
    return { chars, cls };
  }

  const piece = (id, draw, ax, ay, spin) => ({
    id, draw, ax, ay, base: spin, spin: { ...spin }, drag: null, html: '',
    cells: new Array(ART_W * ART_H).fill(null), // scrambles: [start, end, glyph]
  });
  const PIECES = [
    piece('cubeArt', drawBlock, -0.5, 0.6, calm ? { x: 0.001, y: 0.002 } : { x: 0.004, y: 0.008 }),
    piece('coinArt', drawCoin, -0.25, 0, calm ? { x: 0, y: 0.003 } : { x: 0, y: 0.012 }),
  ];

  // Scramble one cell of a piece from frame `start` for `len` frames.
  function scramble(p, r, c, start, len) {
    if (r < 0 || r >= ART_H || c < 0 || c >= ART_W) return;
    p.cells[r * ART_W + c] = [start, start + len, randGlyph()];
  }

  function drawArt(p) {
    const f = loop.frame;
    const { chars, cls } = p.draw(p);
    let html = '';
    for (let r = 0; r < ART_H; r++) {
      let open = '';
      for (let c = 0; c < ART_W; c++) {
        const k = r * ART_W + c;
        const cell = p.cells[k];
        // Only the art scrambles, never the empty space around it.
        const hot = chars[k] !== ' ' && !!cell && f >= cell[0] && f < cell[1];
        const want = hot ? 'x' : chars[k] === ' ' ? open : cls[k];
        if (want !== open) {
          if (open) html += '</i>';
          if (want) html += `<i class="${want}">`;
          open = want;
        }
        html += hot ? cell[2] : chars[k];
      }
      if (open) html += '</i>';
      if (r < ART_H - 1) html += '\n';
    }
    if (html !== p.html) $(p.id).innerHTML = p.html = html;
  }

  // Size each piece to fill its box, like the big numbers elsewhere.
  function fitArt() {
    PIECES.forEach((p) => {
      const pre = $(p.id);
      const box = pre.parentElement;
      if (!box.clientWidth || !box.clientHeight) return;
      pre.style.fontSize = '100px';
      const scale = Math.min(box.clientWidth / pre.offsetWidth, box.clientHeight / pre.offsetHeight);
      pre.style.fontSize = `${Math.floor(1000 * scale) / 10}px`;
    });
  }

  function artLoop() {
    loop.frame++;
    const f = loop.frame;
    PIECES.forEach((p) => {
      if (!p.drag) {
        p.ax += p.spin.x;
        p.ay += p.spin.y;
        // After a flick, ease back to the steady spin.
        p.spin.x += (p.base.x - p.spin.x) * 0.02;
        p.spin.y += (p.base.y - p.spin.y) * 0.02;
      }
      // Fresh glyphs every few frames reads as flicker, not noise.
      if (f % 3 === 0) p.cells.forEach((cell) => { if (cell && f < cell[1]) cell[2] = randGlyph(); });
    });
    if (!calm && f >= loop.nextGlitch) {
      const p = PIECES[Math.floor(Math.random() * PIECES.length)];
      const r = Math.floor(Math.random() * ART_H);
      const c0 = Math.floor(Math.random() * ART_W);
      const len = 3 + Math.floor(Math.random() * 6);
      for (let c = c0; c < c0 + len; c++) scramble(p, r, c, f, 5 + Math.floor(Math.random() * 8));
      loop.nextGlitch = f + 150 + Math.floor(Math.random() * 200);
    }
    PIECES.forEach(drawArt);
    loop.raf = requestAnimationFrame(artLoop);
  }

  // The art only moves while you can see it.
  function syncArt() {
    const show = state.view === 'info';
    if (show && !loop.raf) {
      PIECES.forEach(drawArt);
      fitAbout();
      fitArt();
      loop.raf = requestAnimationFrame(artLoop);
    }
    if (!show && loop.raf) { cancelAnimationFrame(loop.raf); loop.raf = 0; }
  }

  function artCellAt(p, e) {
    const rect = $(p.id).getBoundingClientRect();
    return [
      Math.floor((e.clientY - rect.top) / (rect.height / ART_H)),
      Math.floor((e.clientX - rect.left) / (rect.width / ART_W)),
    ];
  }

  // Drag a piece to spin it the way the pointer moves; it keeps the flick,
  // then eases back to its steady spin. Pointing at it scrambles it.
  function bindPiece(p) {
    const pre = $(p.id);
    pre.addEventListener('pointerdown', (e) => {
      p.drag = { x: e.clientX, y: e.clientY };
      pre.setPointerCapture(e.pointerId);
    });
    pre.addEventListener('pointermove', (e) => {
      const d = p.drag;
      if (d) {
        const dx = (e.clientX - d.x) * 0.012;
        const dy = (e.clientY - d.y) * 0.012;
        d.x = e.clientX;
        d.y = e.clientY;
        p.ay += dx;
        p.ax -= dy;
        p.spin = { x: -dy, y: dx };
        return;
      }
      const [r0, c0] = artCellAt(p, e);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        for (let c = c0 - 2; c <= c0 + 2; c++) scramble(p, r, c, loop.frame, 6 + Math.floor(Math.random() * 10));
      }
    });
    const release = () => { p.drag = null; };
    pre.addEventListener('pointerup', release);
    pre.addEventListener('pointercancel', release);
  }

  // Scale the about page as one piece to fit the screen. Everything in it is
  // sized in em, so setting its font size scales the lot. The text reflows to
  // match the screen's shape first: narrow on tall screens, wide on wide
  // ones, whichever width lets it grow the largest.
  function fitAbout() {
    const about = $('about');
    const box = about.parentElement;
    const cs = getComputedStyle(box);
    const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || h <= 0) return;
    about.style.fontSize = '10px';
    let best = 0;
    let bestWidth = 0;
    for (let em = 34; em <= 66; em += 4) {
      about.style.width = `${em}em`;
      const scale = Math.min(w / about.offsetWidth, h / about.offsetHeight);
      if (scale > best) { best = scale; bestWidth = em; }
    }
    about.style.width = `${bestWidth}em`;
    about.style.fontSize = `${Math.floor(100 * best * 0.94) / 10}px`;
  }

  function buildAbout() {
    PIECES.forEach(bindPiece);
  }

  // ---------- new block screen ----------

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
    const last = state.blocks[0];
    if (last) {
      const since = Date.now() / 1000 - last.timestamp;
      const el = setText('since', `${duration(since)} AGO`);
      el.classList.toggle('alert', since > C.slowBlockMinutes * 60);
    }
    document.querySelectorAll('[data-ts]').forEach((el) => {
      const t = ago(Date.now() / 1000 - Number(el.dataset.ts));
      if (el.textContent !== t) el.textContent = t;
    });

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
    document.querySelectorAll('#themeList button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.theme === theme)));
    paintScanlines();
  }

  function cycleTheme() {
    const i = THEMES.indexOf(document.documentElement.dataset.theme);
    setTheme(THEMES[(i + 1) % THEMES.length]);
  }

  // Header theme dropdown: the small ₿ button opens a list of themes.
  // [1]-[4] sit in a row beside the status when there's room before the
  // logo, and drop down as a list centred under the status word when there
  // isn't.
  function placeViews() {
    const views = $('views');
    if (!views) return;
    views.classList.remove('drop');
    views.style.left = '';
    const logo = document.querySelector('.logo').getBoundingClientRect();
    if (views.getBoundingClientRect().right <= logo.left - 8) return;
    views.classList.add('drop');
    const word = $('status').getBoundingClientRect();
    const box = views.parentElement.getBoundingClientRect();
    const left = word.left + word.width / 2 - views.offsetWidth / 2 - box.left;
    views.style.left = `${Math.max(left, -box.left)}px`;
  }

  // Clicking the status (LIVE) shows [1]-[4] beside it; picking one, clicking
  // anywhere else or Esc tucks them away again.
  function buildViewsMenu() {
    const btn = $('viewsToggle');
    const views = $('views');
    if (!btn || !views) return;
    const open = (show) => {
      if (show) placeViews();
      views.classList.toggle('open', show);
      btn.setAttribute('aria-expanded', String(show));
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      open(!views.classList.contains('open'));
    });
    views.addEventListener('click', (e) => {
      if (e.target.closest('button[data-view]')) open(false);
    });
    document.addEventListener('click', (e) => {
      if (views.classList.contains('open') && !views.contains(e.target)) open(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && views.classList.contains('open')) { open(false); btn.focus(); }
    });
  }

  function buildThemeMenu() {
    const btn = $('themeToggle');
    const list = $('themeList');
    // A browser can pair this script with a cached older page; never let a
    // missing menu stop the clock from starting.
    if (!btn || !list) return;
    list.innerHTML = THEMES.map((t) =>
      `<li role="none"><button type="button" role="menuitemradio" data-theme="${t}">${THEME_NAMES[t]}</button></li>`
    ).join('');

    const open = (show) => {
      list.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      open(list.hidden);
      if (!list.hidden) list.querySelector('[aria-checked="true"]')?.focus();
    });
    list.addEventListener('click', (e) => {
      const item = e.target.closest('button[data-theme]');
      if (!item) return;
      setTheme(item.dataset.theme);
      open(false);
    });
    document.addEventListener('click', (e) => {
      if (!list.hidden && !list.contains(e.target)) open(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !list.hidden) { open(false); btn.focus(); }
    });
  }

  // The header dropdown (or the T key) picks the theme, overriding the
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

  // Scanlines as tiny pixel-exact images, tiled without smoothing: three
  // clear pixels, then one in the theme's scanline colour. A CSS gradient
  // would be simpler, but Firefox softens its hard edges, smearing each 1px
  // line across two. The tiles are sized in screen pixels (--hair), so zoom
  // and display scaling don't thicken them either.
  let scanKey = '';
  function paintScanlines() {
    const root = document.documentElement;
    const dpr = window.devicePixelRatio || 1;
    const cs = getComputedStyle(root);
    const colors = ['--scanline', '--bg-scanline'].map((v) => cs.getPropertyValue(v).trim());
    const key = `${dpr}|${colors}`;
    if (key === scanKey) return;
    scanKey = key;
    const tile = (color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 4;
      const g = canvas.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 3, 1, 1);
      return `url("${canvas.toDataURL()}")`;
    };
    root.style.setProperty('--hair', `${1 / dpr}px`);
    root.style.setProperty('--scan-img', tile(colors[0]));
    root.style.setProperty('--bg-scan-img', tile(colors[1]));
  }

  function burnInShift() {
    const r = () => Math.round(Math.random() * 8 - 4);
    document.body.style.transform = `translate(${r()}px, ${r()}px)`;
  }

  // ---------- boot ----------

  async function start() {
    initialTheme();
    buildThemeMenu();
    applyTheme();
    buildHalvingTicks();
    buildAbout();
    setView(initialView());
    // The [1] [2] [3] [4] and i header buttons jump straight to a view.
    document.querySelectorAll('button[data-view]').forEach((b) =>
      b.addEventListener('click', () => setView(b.dataset.view)));
    buildViewsMenu();

    // Test the new-block screen: press N, or open with ?demo=block.
    // T cycles the themes, the space bar steps to the next view.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') testNewBlock();
      if (e.key === 't' || e.key === 'T') cycleTheme();
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) nextView();
      }
    });
    // A focused button (the ₿ or a theme in its menu) would also act on the
    // space bar's keyup; the space bar only ever changes the view.
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') e.preventDefault();
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

    setText('cur', C.currency);
    state.priceDir = savedPrice().dir || null;
    tick();
    setInterval(tick, 1000);
    setInterval(applyTheme, 60e3);
    if (C.burnInShift) setInterval(burnInShift, 4 * 60e3);
    if (C.reloadHours > 0) setTimeout(() => location.reload(), C.reloadHours * 3600e3);

    // Re-lay out whenever the screen changes size: window resizes, and a page
    // that first laid out while hidden (zero size) once it is shown.
    let resizeTimer;
    const refit = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 150);
    };
    if (window.ResizeObserver) new ResizeObserver(refit).observe($('app'));
    else window.addEventListener('resize', refit);
    // Zooming changes devicePixelRatio and fires a resize.
    window.addEventListener('resize', paintScanlines);
    // Re-fit once the web fonts arrive: numbers measured in the fallback font
    // are narrower and would overflow once Share Tech Mono loads.
    if (document.fonts) {
      document.fonts.ready.then(fitAll);
      document.fonts.addEventListener('loadingdone', fitAll);
    }

    const results = await Promise.allSettled([
      loadTip(), loadPrice(), loadHashrate(),
    ]);
    results.filter((r) => r.status === 'rejected').forEach((r) => warn(r.reason));

    every(C.refresh.tip, loadTip);
    every(C.refresh.mempool, loadMempool);
    every(C.refresh.price, loadPrice);
    every(C.refresh.network, () => Promise.all([loadHashrate(), loadDifficulty()]));
  }

  start();
})();
