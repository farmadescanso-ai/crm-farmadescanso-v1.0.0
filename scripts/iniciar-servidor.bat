@echo off
echo ========================================
echo Iniciando servidor CRM Farmadescaso
echo ========================================
echo.

cd /d "%~dp0.."

echo Verificando que Node.js esté instalado...
node --version
if errorlevel 1 (
    echo ERROR: Node.js no está instalado o no está en el PATH
    pause
    exit /b 1
)

echo.
echo Iniciando servidor...
echo Presiona Ctrl+C para detener el servidor
echo.

node server-crm-completo.js

pause
