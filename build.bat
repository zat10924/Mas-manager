@echo off
chcp 65001 >nul
echo === تثبيت المكتبات ===
call npm install
echo === بناء البرنامج ===
call npm run build
echo.
echo خلص. هتلاقي البرنامج في مجلد dist
pause
