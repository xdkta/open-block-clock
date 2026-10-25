@echo off
rem Open Block Clock - Windows kiosk launcher.
rem Starts the local web server (if it isn't already running) and opens the
rem clock full-screen in Microsoft Edge, or Google Chrome if Edge is missing.
rem Exit the kiosk with Alt+F4.
rem
rem Optional settings (set them before running, or edit them here):
rem   OBC_PORT   web server port            (default 8021)
rem   OBC_QUERY  URL parameters to pass in, e.g.
rem              set "OBC_QUERY=theme=light&flash=0"
setlocal

set "APP_DIR=%~dp0..\.."
if "%OBC_PORT%"=="" set "OBC_PORT=8021"
set "URL=http://127.0.0.1:%OBC_PORT%/"
if not "%OBC_QUERY%"=="" set "URL=%URL%?%OBC_QUERY%"

rem ---------- web server ----------

curl.exe -fs "http://127.0.0.1:%OBC_PORT%/" >nul 2>&1
if not errorlevel 1 goto server_ready

set "PY="
where py >nul 2>&1 && set "PY=py"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Python was not found. Install it from https://www.python.org/downloads/
  echo and tick "Add python.exe to PATH" during setup.
  pause
  exit /b 1
)

start "Open Block Clock server" /min %PY% -m http.server %OBC_PORT% --bind 127.0.0.1 --directory "%APP_DIR%"

rem Wait (up to 60 s) for the server to come up.
for /l %%i in (1,1,60) do (
  curl.exe -fs "http://127.0.0.1:%OBC_PORT%/" >nul 2>&1 && goto server_ready
  timeout /t 1 /nobreak >nul
)
echo The web server did not start on port %OBC_PORT%.
pause
exit /b 1

:server_ready

rem ---------- browser ----------

set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER (
  echo Neither Microsoft Edge nor Google Chrome was found.
  pause
  exit /b 1
)

rem A separate browser profile so kiosk mode works even when the browser is
rem already open, and so the theme / display choice is kept between restarts.
start "" "%BROWSER%" ^
  --user-data-dir="%LocalAppData%\OpenBlockClock\browser" ^
  --kiosk "%URL%" ^
  --edge-kiosk-type=fullscreen ^
  --no-first-run ^
  --noerrdialogs ^
  --disable-session-crashed-bubble ^
  --disable-features=Translate ^
  --check-for-update-interval=31536000

endlocal
