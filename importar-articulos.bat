@echo off
echo ========================================
echo   Importar Articulos
echo ========================================
echo.

set SQL_FILE=C:\Users\pacol\Downloads\Articulos (1).sql
set MYSQL_PATH=C:\xampp\mysql\bin\mysql.exe
set DB_NAME=farmadescanso

echo Verificando archivo...
if not exist "%SQL_FILE%" (
    echo ERROR: Archivo no encontrado: %SQL_FILE%
    pause
    exit /b 1
)

echo Archivo encontrado
echo.
echo IMPORTANTE: El archivo tiene 'Articulos' (mayuscula)
echo Necesitas corregirlo a 'articulos' (minuscula)
echo.
echo Abriendo phpMyAdmin en el navegador...
start http://localhost/phpmyadmin

echo.
echo Instrucciones:
echo 1. Ve a la base de datos: farmadescanso
echo 2. Pestaña: Importar
echo 3. Selecciona el archivo SQL
echo 4. Busca y reemplaza: INSERT INTO `Articulos` por INSERT INTO `articulos`
echo 5. Ejecuta la importacion
echo.
pause

