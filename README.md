# Open Block Clock

An open source bitcoin block clock that displays the latest block tip. No build step, no dependencies: plain HTML, CSS and JavaScript, served locally
and shown in a full-screen kiosk browser (Chromium on the Pi, Edge or Chrome on
Windows).

<img width="2554" height="1275" alt="Screenshot 2026-10-25 140230" src="https://github.com/user-attachments/assets/105d9bc7-aada-4f57-8c2e-5b92178997bb" />

## How it works

1. A tiny local web server (Python's built-in `http.server`) serves this folder
   on `http://127.0.0.1:8021`.
2. The page checks the block height from a mempool.space-compatible API every
   10 seconds.
3. The browser runs in kiosk mode. The page hides the mouse cursor until it
   moves, nudges the layout a few pixels every 4 minutes against burn-in and
   reloads itself every 24 hours.

## What it shows

One screen:

- **Halving line** right under the header, spanning the width of the screen.
  It runs from the block that started the current halving period (left, for
  example `840 000`) to the next halving block (right, under a small `1/2`, for
  example `1 050 000`). A thin orange line fills it left to right as blocks are
  mined, and small ticks at 25%, 50% and 75% light up as it passes them.
- **Block height** as the main number, scaled to fill the rest of the screen.

Large numbers use a space instead of a comma between thousands (`972 064`).

When a new block is found, the screen shows **TICK TOCK, NEXT BLOCK** above the
new block height in orange for about seven seconds. Press **N** to preview it at
any time, or open `?demo=block` to replay it every 20 seconds.

If the data source can't be reached, the header switches to `DELAYED.` and then
`OFFLINE.`, and the data dims so stale numbers stand out.

## Themes

| Theme | Look |
| --- | --- |
| **Dark** (default) | Near-black background, off-white text |
| **Light** | Clean white background, near-black text |

Click the small **₿** at the top right of the header (just left of the date),
or press **T**, to switch between dark and light. The ₿ stays faint until you
hover over it. The choice is remembered on that device.

To fix the theme at boot instead, set `theme` in the config or add `?theme=light`
(or `dark`, `auto`) to the address. A `?theme=` parameter always wins
over a remembered choice.

## Keyboard

| Key | Action |
| --- | --- |
| **T** | Switch between dark and light |
| **N** | Preview the new-block screen |
| **Alt+F4** | Exit the kiosk |

## Install on a Raspberry Pi

You need Raspberry Pi OS with the desktop (Bookworm or newer).

```bash
git clone https://github.com/xdkta/open-block-clock.git ~/open-block-clock
cd ~/open-block-clock
chmod +x kiosk/*.sh
./kiosk/install.sh
sudo reboot
```

The installer:

- installs Chromium and Python 3
- creates a `systemd` service that serves the folder on `127.0.0.1:8021`
- adds a desktop autostart entry that opens Chromium in kiosk mode
- turns off screen blanking and enables desktop auto-login

To exit the kiosk, press `Alt+F4`. To remove it, run `./kiosk/uninstall.sh`.

The Pi kiosk runs Chromium in incognito mode, so a theme picked with the
header button is forgotten when Chromium restarts (for example after a
reboot). To make it stick, set `theme` in `js/config.js`, or add
`OBC_QUERY="theme=light"` to the autostart entry.

## Install on Windows

You need Windows 10 or 11 and Python 3.

1. Install Python from <https://www.python.org/downloads/>. Tick
   **Add python.exe to PATH** during setup.
2. Copy the `open-block-clock` folder anywhere on the PC, for example your
   Desktop.
3. Open `kiosk\windows` and double-click **`launch.bat`** to try it. It starts
   the local server in a minimized window on `127.0.0.1:8021`, waits for it,
   then opens the clock full-screen in Microsoft Edge (or Google Chrome if Edge
   isn't installed). Press `Alt+F4` to exit.
4. To start it automatically, double-click **`install.bat`**. It:
   - adds an **Open Block Clock** shortcut to your Startup folder, so the kiosk
     opens every time you sign in
   - sets the screen and sleep timeouts to **Never** while plugged in

   For a dedicated display, also turn on automatic sign-in so the PC goes
   straight to the clock after a power cut. Search the Start menu for
   **netplwiz** and untick *Users must enter a user name and password*. On some
   Windows 11 PCs that box only appears after you turn off *For improved
   security, only allow Windows Hello sign-in* under Settings → Accounts →
   Sign-in options.
5. To stop it starting at sign-in, double-click **`uninstall.bat`**. It removes
   the Startup shortcut and leaves your files and power settings alone.

The Windows kiosk uses its own browser profile
(`%LocalAppData%\OpenBlockClock\browser`). That means kiosk mode works even if
Edge is already open, and your theme choice is kept between restarts.

To use another port or pass settings at launch, set `OBC_PORT` or `OBC_QUERY`
before running `launch.bat`, or edit those lines at the top of the file. Keep
the quotes when the value contains `&`, for example
`set "OBC_QUERY=theme=light&flash=0"`.

## Configure

Edit [`js/config.js`](js/config.js), or override any setting with URL parameters:

```
http://127.0.0.1:8021/?theme=light
http://127.0.0.1:8021/?api=http://umbrel.local:3006/api
```

Set `OBC_QUERY="theme=auto"` in the autostart entry to pass parameters at boot.

- **`apiBase`**: any mempool.space-compatible API. Point it at your own node's
  mempool app (Umbrel, Start9, RaspiBlitz) so the clock never relies on a
  third party. By default it uses the public <https://mempool.space> API, which
  sees your IP address and is subject to its rate limits.
- **`theme`**: `dark` (default), `light` (white) or `auto` (dark at night,
  light by day).
- **`refresh`, `newBlockFlash`, `burnInShift`, `reloadHours`**: see the
  comments in the file.

## Run on any computer

From this folder:

```bash
python3 -m http.server 8021
```

(on Windows: `py -m http.server 8021`). Then open <http://127.0.0.1:8021>.

## Fonts

Every big number and the halving clock use **Share Tech Mono** (a smooth
terminal font), and labels use **IBM Plex Mono**,
both from Google Fonts. Offline, it falls back to the system monospace font.

## Contributing

Issues and pull requests are welcome. There is no build step: edit the files,
run `python3 -m http.server 8021` and reload the browser. Please keep the
project dependency-free.

## License

[MIT](LICENSE). Data from [mempool.space](https://mempool.space) or your own
mempool instance. Fonts are Share Tech Mono and IBM Plex Mono (SIL Open Font
License), loaded from Google Fonts.
