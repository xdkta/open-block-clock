/*
 * Open Block Clock — configuration.
 * Every value can also be overridden with a URL parameter, e.g.
 *   http://127.0.0.1:8021/?theme=light&currency=EUR&api=http://umbrel.local:3006/api
 */
window.OBC_CONFIG = {
  // Any mempool.space-compatible API. Point this at your own node's
  // mempool instance (Umbrel, Start9, RaspiBlitz...) to stay sovereign.
  apiBase: "https://mempool.space/api",

  // "dark" (default), "light" (white), "brown" (Brown Town, light shades of
  // brown), "btc-dark" (Bitcoin Dark, orange on black), "btc-light"
  // (Bitcoin Light, black on orange) or "auto" (dark between nightStart and
  // nightEnd, local time). The small ₿ in the header opens a theme dropdown
  // (the T key cycles them), and the choice is remembered on this device.
  theme: "dark",
  nightStart: 21,
  nightEnd: 7,

  // The space bar steps through the views: the block height, a dashboard,
  // the block height with a halving dial, and the price in steps. The clock
  // starts on the block height (screen 1).

  // USD, EUR, GBP, CAD, CHF, AUD or JPY.
  currency: "USD",

  // The price view shows the price rounded down to this step, in the
  // currency above, so it only changes when the price crosses a mark
  // ($82 000, $82 500, ...), with an up or down arrow for the way it last
  // stepped. For JPY, use a much larger step, such as 100000.
  priceStep: 500,

  // Polling intervals in seconds.
  refresh: {
    tip: 10,       // block height — new-block detection
    mempool: 30,   // fees, mempool, projected blocks
    price: 60,
    network: 600,  // hashrate, difficulty
  },

  // Size of a typical transaction (1-in, 2-out native segwit) used for
  // the dashboard's "cost to send" estimate.
  txVbytes: 141,

  // The dashboard's fee tile shows LOW / HIGH when the next-block fee
  // crosses these.
  lowFee: 2,
  highFee: 50,

  // The dashboard's "last block" turns into a highlighted badge after this
  // many minutes.
  slowBlockMinutes: 30,

  // Full-screen "TICK TOCK, NEXT BLOCK" screen when a block is found.
  // Preview it any time with the N key, or ?demo=block (repeats every 20 s).
  newBlockFlash: true,
  burnInShift: true,       // nudge the layout a few px every few minutes
  reloadHours: 24,         // full page reload to keep a 24/7 kiosk fresh
};
