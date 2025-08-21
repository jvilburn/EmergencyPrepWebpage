@echo off
echo Installing Electron for Windows...
cd /d C:\Users\johnv\Documents\Church\EmergencyPrepWebpage

echo Cleaning old installation...
rmdir /s /q node_modules\electron 2>nul

echo Installing Electron...
npm install electron@28.0.0 --save-dev --platform=win32 --arch=x64

echo Installation complete!
pause