@echo off
rem Removes the Open Block Clock Startup shortcut (leaves the files and your
rem power settings in place).
setlocal

powershell -NoProfile -Command ^
  "Remove-Item -ErrorAction SilentlyContinue ([Environment]::GetFolderPath('Startup') + '\Open Block Clock.lnk')"

echo Open Block Clock will no longer start when you sign in.
echo To let the screen turn off again, go to Settings ^> System ^> Power.
pause
endlocal
