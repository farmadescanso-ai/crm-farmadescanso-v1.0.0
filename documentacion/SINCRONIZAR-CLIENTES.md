# 📊 Sincronización de Clientes desde Excel

Este documento explica cómo usar el script de sincronización de clientes desde un archivo Excel hacia NocoDB.

## 📋 Descripción

El script `scripts/sincronizar-clientes-excel.js` permite:
- ✅ Leer datos de clientes desde un archivo Excel
- ✅ Comparar con los clientes existentes en NocoDB
- ✅ Actualizar clientes existentes con los datos del Excel
- ✅ Crear nuevos clientes que no existen en la base de datos

## 🚀 Uso

### Modo Simulación (Recomendado primero)

Antes de ejecutar el script por primera vez, es recomendable usar el modo de simulación para ver qué cambios se realizarían:

```bash
node scripts/sincronizar-clientes-excel.js --dry-run
```

O con un archivo específico:

```bash
node scripts/sincronizar-clientes-excel.js "ruta/al/archivo.xlsx" --dry-run
```

El modo de simulación mostrará:
- Qué clientes se actualizarían y qué campos cambiarían
- Qué clientes nuevos se crearían
- Qué clientes no tienen cambios
- **No realizará ningún cambio real en la base de datos**

### Ejecutar el script (Modo Real)

Una vez que hayas revisado la simulación, ejecuta el script sin el flag `--dry-run`:

```bash
# Usar el archivo por defecto
node scripts/sincronizar-clientes-excel.js

# Especificar un archivo diferente
node scripts/sincronizar-clientes-excel.js "C:\ruta\a\tu\archivo.xlsx"
```

Si no se especifica la ruta, se usará por defecto:
- `01 Farmacias_Murcia_Completado.xlsx` (en la raíz del proyecto)

## 📊 Estructura del Excel

El script espera un archivo Excel con las siguientes columnas (los nombres pueden variar ligeramente):

| Columna Excel | Campo NocoDB | Descripción |
|---------------|--------------|-------------|
| Farmacéutico Titular | Nombre | Nombre del farmacéutico titular (requerido) |
| Dirección | Direccion | Dirección completa |
| Municipio | Provincia | Provincia/Municipio |
| Población | Poblacion | Población |
| Télefono | Telefono | Teléfono fijo |
| Móvil | Movil | Teléfono móvil |
| Email | Email | Correo electrónico |
| Ubicación | Direccion | Ubicación adicional (se combina con dirección) |
| DNI/CIF | DNI_CIF | DNI o CIF (si existe) |

**Nota:** El script es flexible con los nombres de las columnas y busca variaciones comunes (con/sin tildes, mayúsculas/minúsculas, etc.)

## 🔍 Lógica de Búsqueda

El script busca clientes existentes en este orden de prioridad:

1. **Por DNI/CIF** (más preciso)
2. **Por Email** (muy preciso)
3. **Por Nombre + Teléfono/Móvil** (combinación)
4. **Por Nombre + Dirección/Población** (combinación)
5. **Por Nombre solamente** (menos preciso, último recurso)

## ⚙️ Funcionamiento

1. **Lectura del Excel**: Lee todas las filas del archivo Excel
2. **Conexión a NocoDB**: Se conecta a la base de datos de NocoDB
3. **Obtención de clientes existentes**: Obtiene todos los clientes de la base de datos
4. **Procesamiento**: Para cada cliente del Excel:
   - Busca si existe en la base de datos
   - Si existe: compara los campos y actualiza solo los que han cambiado
   - Si no existe: crea un nuevo cliente
5. **Resumen**: Muestra un resumen de la operación

## 📈 Resultados

Al finalizar, el script muestra un resumen con:
- ✅ Clientes actualizados
- 🆕 Clientes creados
- ✓ Clientes sin cambios
- ❌ Errores (si los hay)

### Ejemplo de salida:

```
============================================================
📊 RESUMEN DE SINCRONIZACIÓN
============================================================
✅ Clientes actualizados: 25
🆕 Clientes creados: 10
✓ Clientes sin cambios: 311
❌ Errores: 0
📊 Total procesado: 346
============================================================

✅ Sincronización completada exitosamente
```

## ⚠️ Consideraciones

### Campos Requeridos
- **Nombre**: Es obligatorio. Si un cliente del Excel no tiene nombre, se omitirá.

### Campos Opcionales
- Todos los demás campos son opcionales
- Si un campo está vacío en el Excel, no se actualizará en la base de datos (a menos que se quiera limpiar)

### Actualizaciones
- Solo se actualizan los campos que han cambiado
- Si un cliente existe pero no hay cambios, se marca como "sin cambios"
- Los campos se comparan de forma normalizada (sin espacios extra, mayúsculas/minúsculas, etc.)

### Creación de Clientes
- Los nuevos clientes se crean con `OK_KO = 'OK'` por defecto (activo)
- Si no hay DNI/CIF en el Excel, el campo quedará vacío en la base de datos

## 🔧 Configuración

El script usa la configuración de NocoDB del archivo `config/farmadescaso-crm.js`:
- URL: `https://farmadescanso-nocodb.6f4r35.easypanel.host`
- Token: Configurado en el archivo
- Tabla de Clientes: `m1ta3aq127ey5wd`

## 🐛 Solución de Problemas

### Error: "El archivo Excel no tiene suficientes filas"
- Verifica que el archivo tenga al menos una fila de encabezados y una fila de datos
- Asegúrate de que el archivo no esté vacío

### Error: "Cliente con ID X no encontrado"
- Esto puede ocurrir si un cliente fue eliminado de la base de datos después de obtener la lista
- El script continuará con los demás clientes

### Error de conexión a NocoDB
- Verifica que la URL y el token de API sean correctos
- Verifica tu conexión a internet
- Verifica que el servicio de NocoDB esté disponible

### Clientes no se encuentran
- Verifica que los nombres en el Excel coincidan con los de la base de datos
- El script usa búsqueda normalizada, pero pequeños errores tipográficos pueden impedir la coincidencia
- Considera usar DNI/CIF o Email para búsquedas más precisas

## 📝 Notas

- El script procesa los clientes uno por uno con una pequeña pausa (100ms) entre cada uno para no sobrecargar la API
- Para archivos muy grandes, el proceso puede tardar varios minutos
- Se recomienda hacer una copia de seguridad de la base de datos antes de ejecutar el script
- El script no elimina clientes de la base de datos, solo actualiza o crea

## 🔄 Re-ejecución

Puedes ejecutar el script múltiples veces de forma segura:
- Los clientes existentes se actualizarán solo si hay cambios
- Los clientes nuevos se crearán solo si no existen
- Los clientes sin cambios no se modificarán

## 📞 Soporte

Si tienes problemas o preguntas:
1. Revisa los logs del script
2. Verifica la estructura del Excel
3. Verifica la conexión a NocoDB
4. Consulta la documentación de NocoDB API

