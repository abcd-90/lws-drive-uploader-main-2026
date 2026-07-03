@echo off
echo Starting Nitro Drive Tool...
start cmd /k "npm run dev"
echo Waiting for server to start...
timeout /t 5
start http://localhost:3000/admin
echo Tool is running! You can now use the Admin Panel.
pause
