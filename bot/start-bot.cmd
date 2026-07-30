@echo off
rem Inicia o WoE Event Bot com log em bot\bot.log (usado pelo auto-início do Windows)
cd /d "%~dp0"
node index.js >> bot.log 2>&1
