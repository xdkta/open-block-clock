/*
 * Open Block Clock — configuration.
 * Every value can also be overridden with a URL parameter, e.g.
 *   http://127.0.0.1:8021/?theme=light&api=http://umbrel.local:3006/api
 */
window.OBC_CONFIG = {
  // Any mempool.space-compatible API. Point this at your own node's
  // mempool instance (Umbrel, Start9, RaspiBlitz...) to stay sovereign.
  apiBase: "https://mempool.space/api",

  // "dark" (default), "light" (white) or "auto" (dark between nightStart
  // and nightEnd, local time). Clicking the small ₿ in the header (or the
  // T key) switches between dark and light, and the choice is remembered
  // on this device.
  theme: "dark",
  nightStart: 21,
  nightEnd: 7,

  clock24h: true,

  // How often to check the block height, in seconds.
  refresh: {
    tip: 10,
  },

  // Full-screen "TICK TOCK, NEXT BLOCK" screen when a block is found.
  // Preview it any time with the N key, or ?demo=block (repeats every 20 s).
  newBlockFlash: true,
  burnInShift: true,       // nudge the layout a few px every few minutes
  reloadHours: 24,         // full page reload to keep a 24/7 kiosk fresh
};
