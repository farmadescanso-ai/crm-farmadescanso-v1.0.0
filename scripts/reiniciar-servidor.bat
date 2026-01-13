@echo off
echo ========================================
echo Reiniciando Servidor CRM Farmadescaso
echo ========================================
echo.

echo Deteniendo procesos en puerto 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Deteniendo proceso PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo Iniciando servidor...
echo.
node server-crm-completo.js

pause
