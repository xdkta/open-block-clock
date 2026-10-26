# Open Block Clock

An open source bitcoin block clock. It shows the latest block height and how far
the chain is through the current halving period. Plain HTML, CSS and JavaScript:
no build step, no dependencies.

**Live:** <https://xdkta.github.io/open-block-clock/>

<img width="2554" height="1275" alt="Open Block Clock in dark mode" src="https://github.com/user-attachments/assets/105d9bc7-aada-4f57-8c2e-5b92178997bb" />

## Features

- Block height, scaled to fill the screen, refreshed every 10 seconds
- Halving progress bar from the last halving block to the next
- **TICK TOCK, NEXT BLOCK** screen when a new block is found
- Dark and light themes
- `LIVE` / `DELAYED` / `OFFLINE` status if the data source drops out
- Kiosk-friendly: hidden cursor, burn-in shift, daily reload

## Keys

| Key | Action |
| --- | --- |
| **T** | Toggle dark / light (or click the ₿ in the header) |
| **N** | Preview the new-block screen |
| **Alt+F4** | Exit kiosk mode |

## Settings

Edit [`js/config.js`](js/config.js) or add URL parameters:

| Parameter | Values | Example |
| --- | --- | --- |
| `theme` | `dark`, `light`, `auto` | `?theme=light` |
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
