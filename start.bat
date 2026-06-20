@echo off
title NEONDROP
cd /d "%~dp0"
echo Opening NEONDROP in your default browser...
REM No build needed. If Python is installed it will serve via localhost,
REM otherwise the site opens directly from disk (works the same).
where py >nul 2>&1 && (
  start "" http://localhost:8000
  py -m http.server 8000
  goto :eof
)
where python >nul 2>&1 && (
  python -c "import sys" 2>nul && (
    start "" http://localhost:8000
    python -m http.server 8000
    goto :eof
  )
)
start "" "%~dp0index.html"
