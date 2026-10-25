@echo off
rem Open Block Clock - start the kiosk automatically when you sign in to Windows.
rem Adds a shortcut to launch.bat in your Startup folder and stops the screen
rem from turning off or the PC from sleeping while plugged in.
setlocal

set "HERE=%~dp0"

echo ==^> Adding Open Block Clock to your Startup folder
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\Open Block Clock.lnk');" ^
  "$s.TargetPath = '%HERE%launch.bat'; $s.WorkingDirectory = '%HERE%'; $s.WindowStyle = 7; $s.Save()"
if errorlevel 1 (
  echo Could not create the Startup shortcut.
  pause
  exit /b 1
)

echo ==^> Keeping the screen on and the PC awake while plugged in
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0

echo.
echo Done. The clock will open full-screen the next time you sign in.
echo Start it now with:  "%HERE%launch.bat"
echo Exit the kiosk with Alt+F4. Remove it with uninstall.bat.
pause
endlocal
