# Open Block Clock

<img width="1864" height="943" alt="Screenshot 2026-10-26 022224" src="https://github.com/user-attachments/assets/dcfe5b32-1a8b-4edd-96af-90548b426620" />

**A Bitcoin block clock with nothing to hide.**

Open Block Clock is a free, open-source block clock, built from scratch. It
shows block height, halvings, fees and the mempool, all pulled straight from the
Bitcoin network.

- **Bitcoin only.** Blocks, halvings, fees, mempool. Nothing else.
- **Fully open.** MIT licensed. Plain HTML, CSS and JavaScript.
- **Self-hosted.** Runs on a Raspberry Pi against your own node.
- **Private.** No accounts, no tracking.

**Live:** <https://xdkta.github.io/open-block-clock/>


## Features

- Block height, scaled to fill the screen, refreshed every 10 seconds
- Halving progress line from the last halving block to the next, under the
  header of the block height view
- An about page, opened with [i] in the header: the Open Block Clock
  project's story beside a spinning 3D bitcoin block and coin, drawn in text
  from the latest block hash (drag them to spin)
- More views, one press of the space bar apart (or click [1] to [4] in the
  header to jump to one):
  - **Dashboard**: block height, price, fees, mempool, difficulty
    adjustment, halving, the next and latest blocks, supply and hashrate
  - **Halving dial**: block height beside a dial of the blocks left to the
    next halving
  - **Price**: the price, rounded down to steps (default $500), with an up
    or down arrow for the way it last stepped
- **TICK TOCK, NEXT BLOCK** screen when a new block is found
- Five themes: Dark, Light, Brown Town, Bitcoin Dark and Bitcoin Light
- `LIVE` / `DELAYED` / `OFFLINE` status if the data source drops out
- Kiosk-friendly: hidden cursor, burn-in shift, daily reload

## Keys

| Key | Action |
| --- | --- |
| **Space** | Next view: block height → dashboard → halving dial → price |
| **T** | Next theme (or click the ₿ in the header to pick one) |
| **N** | Preview the new-block screen |
| **Alt+F4** | Exit kiosk mode |

## Settings

Edit [`js/config.js`](js/config.js) or add URL parameters:

| Parameter | Values | Example |
| --- | --- | --- |
| `theme` | `dark`, `light`, `brown`, `btc-dark`, `btc-light`, `auto` | `?theme=brown` |
| `view` | start on `height` (default), `dashboard`, `halving`, `price` or `info` | `?view=dashboard` |
| `currency` | `USD`, `EUR`, `GBP`, `CAD`, `CHF`, `AUD`, `JPY` | `?currency=EUR` |
| `api` | any mempool.space-compatible API | `?api=http://umbrel.local:3006/api` |
| `flash` | `0` turns off the new-block screen | `?flash=0` |
| `demo` | `block` replays the new-block screen every 20 s | `?demo=block` |

By default data comes from the public [mempool.space](https://mempool.space)
API. Point `api` at your own node's mempool app (Umbrel, Start9, RaspiBlitz) to
avoid relying on a third party.

> The hosted GitHub Pages site uses HTTPS, so browsers block a plain `http://`
> API there. To use a local node, run the clock locally (below).

## Run locally

```bash
python3 -m http.server 8021
```

Then open <http://127.0.0.1:8021>. On Windows use `py -m http.server 8021`.

## Kiosk: Raspberry Pi

Raspberry Pi OS with desktop (Bookworm or newer):

```bash
git clone https://github.com/xdkta/open-block-clock.git ~/open-block-clock
cd ~/open-block-clock
chmod +x kiosk/*.sh
./kiosk/install.sh
sudo reboot
```

This installs Chromium, adds a local web server service, opens the clock
full-screen at login and turns off screen blanking. Remove it with
`./kiosk/uninstall.sh`.

Chromium runs in incognito mode, so set `theme` in `js/config.js` to keep a
theme across reboots.

## Kiosk: Windows

Windows 10 or 11 with [Python 3](https://www.python.org/downloads/) (tick
**Add python.exe to PATH**). In `kiosk\windows`:

- **`launch.bat`**: start the server and open the clock full-screen in Edge
  (or Chrome)
- **`install.bat`**: start it at every sign-in and keep the screen awake
- **`uninstall.bat`**: stop starting it at sign-in

Set `OBC_PORT` or `OBC_QUERY` (for example `set "OBC_QUERY=theme=light"`) at
the top of `launch.bat` to change the port or pass settings.

## Contributing

Issues and pull requests are welcome. Edit the files, run the local server and
reload. Please keep the project dependency-free.

## License

[MIT](LICENSE). Fonts: Share Tech Mono and IBM Plex Mono (SIL Open Font
License) via Google Fonts.
