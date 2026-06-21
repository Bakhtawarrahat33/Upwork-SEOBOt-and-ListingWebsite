@echo off
title Proactive Token Refresh Daemon
cd /d "%~dp0..\upwork-discord-bot 3\upwork-discord-bot"
echo [ProactiveRefresh] Starting standalone token refresh daemon...
python -m scraper.proactive_refresh
pause
