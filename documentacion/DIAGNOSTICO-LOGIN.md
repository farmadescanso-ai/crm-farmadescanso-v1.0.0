# 🔍 Diagnóstico de Login - Guía Completa

## 📋 Resumen

Se ha implementado un sistema completo de logging y diagnóstico para el proceso de login. Ahora, cuando el login falla, se generan mensajes de error detallados con toda la información necesaria para entender el problema.

## 🔧 Cambios Implementados

### 1. Logging Detallado en el Proceso de Login

El proceso de login ahora está dividido en **7 pasos**, cada uno con logging detallado:

1. **PASO 1: Validación de entrada**
   - Verifica que email y contraseña estén presentes
   - Logging de tipo y longitud de datos recibidos

2. **PASO 2: Normalización de email**
   - Convierte email a minúsculas y elimina espacios
   - Logging de email original y normalizado

3. **PASO 3: Conexión a CRM y búsqueda de comercial**
   - Conecta al CRM de NocoDB
   - Obtiene lista de comerciales
   - Busca comercial por email
   - Logging de:
     - URL base del CRM
     - Proyecto ID
     - Tabla ID
     - Total de comerciales obtenidos
     - Tiempo de consulta
     - Primeros emails en la BD (para debugging)
     - Errores de conexión

4. **PASO 4: Verificación de contraseña**
   - Busca campo de contraseña en diferentes variantes
   - Compara contraseñas
   - Logging de:
     - Campos de contraseña disponibles
     - Campo seleccionado
     - Longitud de contraseñas
     - Comparación exacta y case-insensitive
     - Resultado de la comparación

5. **PASO 5: Generación de token JWT**
   - Genera token JWT con datos del comercial
   - Logging de:
     - ID del comercial
     - Token generado (primeros 50 chars)
     - Longitud del token
     - Errores en la generación

6. **PASO 6: Establecimiento de cookie y sesión**
   - Establece cookie HTTP-only con token JWT
   - Establece sesión para compatibilidad
   - Logging de:
     - Configuración de cookie
     - Session ID
     - Headers Set-Cookie
     - Estado de la cookie

7. **PASO 7: Redirección**
   - Redirige al dashboard
   - Logging de tiempo total del proceso

### 2. Mensajes de Error Detallados

Cada error incluye:
- **Paso donde ocurrió el error**
- **Tipo de error**
- **Detalles específicos**:
  - Para errores de conexión: mensaje, stack, nombre del error
  - Para comercial no encontrado: email buscado, total de comerciales, emails en BD
  - Para contraseña incorrecta: campo usado, longitudes, comparación
  - Para errores de token: detalles del error de generación
  - Para errores de cookie: detalles del error de establecimiento

### 3. Información de Debugging en Desarrollo

En modo desarrollo (`NODE_ENV !== 'production'`), los errores incluyen un objeto `debugInfo` con:
- Paso donde falló
- Detalles del error
- Información de la petición
- Stack trace completo

### 4. Endpoint de Debug `/api/debug/login`

Nuevo endpoint POST para diagnóstico:
- **URL**: `/api/debug/login`
- **Método**: POST
- **Body**: 
  ```json
  {
    "email": "paco@fralabu.com",
    "password": "27451524N"
  }
  ```
- **Respuesta**: JSON con información detallada del proceso de login

#### Ejemplo de respuesta exitosa:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "email": "paco@fralabu.com",
  "passwordLength": 9,
  "emailNormalizado": "paco@fralabu.com",
  "totalComerciales": 5,
  "emailsEnBD": [
    { "email": "paco@fralabu.com", "id": 1 },
    ...
  ],
  "comercial": {
    "id": 1,
    "nombre": "Paco",
    "email": "paco@fralabu.com",
    "camposDisponibles": ["Id", "Nombre", "Email", "DNI", ...]
  },
  "camposPassword": [
    { "campo": "DNI", "tieneValor": true, "longitud": 9 }
  ],
  "comparacionPassword": {
    "passwordRecibidoLength": 9,
    "passwordBDLength": 9,
    "coincidenExacto": true,
    "coincidenCaseInsensitive": true
  },
  "token": {
    "generado": true,
    "longitud": 200,
    "primerosChars": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "paso": "LOGIN_EXITOSO",
  "errores": []
}
```

#### Ejemplo de respuesta con error:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "email": "paco@fralabu.com",
  "passwordLength": 9,
  "emailNormalizado": "paco@fralabu.com",
  "totalComerciales": 5,
  "emailsEnBD": [...],
  "paso": "CONTRASEÑA_INCORRECTA",
  "errores": [
    {
      "paso": 4,
      "error": "Contraseña incorrecta",
      "comparacion": {
        "passwordRecibidoLength": 9,
        "passwordBDLength": 9,
        "coincidenExacto": false,
        "coincidenCaseInsensitive": false
      }
    }
  ]
}
```

## 📊 Logs en Consola

### Formato de Logs

Los logs se muestran con separadores visuales y emojis para facilitar la lectura:

```
================================================================================
🔍 [LOGIN] ===== INICIO DE PROCESO DE LOGIN =====
🔍 [LOGIN] Información de la petición: {...}
================================================================================

📋 [LOGIN PASO 1] Validando entrada de datos...
✅ [LOGIN PASO 1] Validación de entrada: OK

📋 [LOGIN PASO 2] Normalizando email...
✅ [LOGIN PASO 2] Normalización: OK

📋 [LOGIN PASO 3] Conectando a CRM y buscando comercial...
✅ [LOGIN PASO 3] Comercial encontrado

...

================================================================================
✅ [LOGIN] ===== LOGIN EXITOSO =====
✅ [LOGIN] Tiempo total: 250ms
✅ [LOGIN] Comercial: Paco (ID: 1)
✅ [LOGIN] Email: paco@fralabu.com
✅ [LOGIN] Token generado: Sí
✅ [LOGIN] Cookie establecida: Sí
✅ [LOGIN] Sesión establecida: Sí
================================================================================
```

### Logs de Error

Cuando hay un error, se muestra información detallada:

```
================================================================================
❌ [LOGIN] ===== ERROR EN LOGIN =====
❌ [LOGIN] Tiempo hasta el error: 150ms
❌ [LOGIN] Detalles del error: {...}
❌ [LOGIN] Stack completo: {...}
================================================================================
```

## 🔍 Cómo Usar el Diagnóstico

### 1. Revisar Logs en Vercel

1. Ve a Vercel Dashboard
2. Selecciona tu proyecto
3. Ve a la pestaña "Logs"
4. Filtra por "LOGIN" para ver solo los logs de login
5. Busca errores con "❌ [LOGIN]"

### 2. Usar el Endpoint de Debug

```bash
# En desarrollo local
curl -X POST http://localhost:3000/api/debug/login \
  -H "Content-Type: application/json" \
  -d '{"email": "paco@fralabu.com", "password": "27451524N"}'

# En producción (Vercel)
curl -X POST https://tu-app.vercel.app/api/debug/login \
  -H "Content-Type: application/json" \
  -d '{"email": "paco@fralabu.com", "password": "27451524N"}'
```

### 3. Verificar Información de Sesión

```bash
# Verificar estado de sesión y JWT
curl https://tu-app.vercel.app/api/debug/session?key=debug
```

## 📝 Tipos de Errores y Soluciones

### 1. Error de Conexión a CRM

**Síntoma**: `ERROR_CONEXION` en el paso 3

**Causas posibles**:
- NocoDB no está disponible
- Token de API inválido
- URL base incorrecta
- Problemas de red

**Solución**:
- Verificar que NocoDB esté funcionando
- Verificar token de API en variables de entorno
- Verificar URL base en `config/farmadescaso-crm.js`

### 2. Comercial No Encontrado

**Síntoma**: `COMERCIAL_NO_ENCONTRADO` en el paso 3

**Causas posibles**:
- Email no existe en la BD
- Email con formato diferente (mayúsculas, espacios)
- Problema con la búsqueda

**Solución**:
- Verificar email en la base de datos
- Verificar que el email esté normalizado correctamente
- Revisar lista de emails en BD desde los logs

### 3. Contraseña No Disponible

**Síntoma**: `CONTRASEÑA_NO_DISPONIBLE` en el paso 4

**Causas posibles**:
- El comercial no tiene campo de contraseña configurado
- El campo de contraseña está vacío o null

**Solución**:
- Verificar campos disponibles en el comercial
- Configurar campo de contraseña en NocoDB
- Verificar que el campo tenga un valor

### 4. Contraseña Incorrecta

**Síntoma**: `CONTRASEÑA_INCORRECTA` en el paso 4

**Causas posibles**:
- Contraseña incorrecta
- Espacios adicionales
- Case sensitivity

**Solución**:
- Verificar contraseña exacta en la BD
- Verificar que no haya espacios adicionales
- Verificar comparación case-sensitive en logs

### 5. Error Generando Token

**Síntoma**: `ERROR_GENERANDO_TOKEN` en el paso 5

**Causas posibles**:
- JWT_SECRET no configurado
- Datos del comercial inválidos
- Error en la función generateToken

**Solución**:
- Verificar JWT_SECRET en variables de entorno
- Verificar datos del comercial
- Revisar stack trace del error

### 6. Error Estableciendo Cookie

**Síntoma**: `ERROR_ESTABLECIENDO_COOKIE` en el paso 6

**Causas posibles**:
- Configuración de cookie incorrecta
- Problemas con headers
- Respuesta ya enviada

**Solución**:
- Verificar configuración de cookie
- Verificar que la respuesta no se haya enviado antes
- Revisar headers Set-Cookie en logs

## ✅ Ventajas del Sistema de Diagnóstico

1. **Logging Detallado**: Cada paso del proceso está logueado
2. **Mensajes de Error Específicos**: Cada error incluye información detallada
3. **Endpoint de Debug**: Permite probar el login sin afectar la UI
4. **Información de Tiempo**: Muestra tiempo total del proceso
5. **Información de BD**: Muestra emails disponibles en la BD
6. **Comparación de Contraseñas**: Muestra comparación exacta e insensitive
7. **Información de Token**: Muestra estado del token JWT
8. **Información de Cookie**: Muestra estado de la cookie

## 🚀 Próximos Pasos

1. **Probar el login** con las credenciales proporcionadas
2. **Revisar los logs** en Vercel para ver qué está pasando
3. **Usar el endpoint de debug** para obtener información detallada
4. **Comparar** la información de debug con los logs
5. **Identificar** el paso donde falla el proceso
6. **Resolver** el problema basado en la información de diagnóstico

---

✅ **El sistema de diagnóstico está completamente implementado y listo para usar.**

