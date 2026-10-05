@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to build from source. The ready-made Windows ZIP does not need Node.js.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  echo Dependency installation did not complete. Read the error above.
  pause
  exit /b 1
)
call npm test
if errorlevel 1 (
  echo Tests did not pass. No installer has been built.
  pause
  exit /b 1
)
call npm run dist:win
if errorlevel 1 (
  echo Windows packaging did not complete. Read the error above.
  pause
  exit /b 1
)
echo Your installer is in the release folder.
pause
