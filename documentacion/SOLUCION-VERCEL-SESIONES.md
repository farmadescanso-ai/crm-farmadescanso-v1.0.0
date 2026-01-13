# 🔧 Solución para Sesiones en Vercel

## 🎯 Problema Identificado

Las sesiones en Vercel (entorno serverless) pueden tener problemas debido a:
1. **Sesiones en memoria**: Cada invocación puede ser una instancia diferente
2. **Configuración de cookies**: Las cookies deben estar correctamente configuradas para HTTPS
3. **SameSite cookies**: Puede causar problemas en algunos navegadores
4. **Trust proxy**: Necesario para detectar HTTPS correctamente

## ✅ Solución Implementada

### 1. Configuración Mejorada de Sesiones

```javascript
// Detectar si estamos en Vercel
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

// Configuración de cookies optimizada
const cookieConfig = {
  httpOnly: true,
  maxAge: 30 * 60 * 1000, // 30 minutos
  secure: isProduction, // HTTPS en producción
  sameSite: 'lax', // Compatible con la mayoría de navegadores
  domain: undefined, // No especificar dominio
  path: '/' // Asegurar que la cookie se envía en todas las rutas
};
```

### 2. Trust Proxy Configurado

```javascript
app.set('trust proxy', 1);
```

Esto es **crítico** para que Vercel detecte correctamente las conexiones HTTPS.

### 3. Logging Detallado

Se ha agregado logging extensivo para diagnosticar problemas:

- `🔍 [LOGIN]` - Intentos de login
- `✅ [LOGIN]` - Login exitoso
- `❌ [LOGIN]` - Errores de login
- `🔐 [AUTH]` - Verificación de autenticación
- `🏠 [ROOT]` - Acceso a ruta principal
- `🔧 [SESSION]` - Configuración de sesiones

### 4. Guardado Explícito de Sesión

```javascript
req.session.save((err) => {
  if (err) {
    // Manejar error
  }
  // Redirigir después de guardar
  res.status(303).redirect('/dashboard');
});
```

## 🔍 Diagnóstico

### Endpoint de Debug

Se ha agregado un endpoint de diagnóstico:

```
GET /api/debug/session?key=debug
```

Este endpoint muestra:
- Session ID
- Datos de sesión
- Cookies recibidas
- Headers
- Configuración de entorno
- Configuración de cookies

### Verificar en Vercel

1. **Revisar los logs en Vercel Dashboard:**
   - Ve a tu proyecto en Vercel
   - Haz clic en "Deployments"
   - Selecciona el último deployment
   - Ve a la pestaña "Logs"
   - Busca mensajes con prefijos `[LOGIN]`, `[AUTH]`, `[SESSION]`

2. **Probar el endpoint de debug:**
   ```
   https://tu-app.vercel.app/api/debug/session?key=debug
   ```

3. **Verificar las cookies en el navegador:**
   - Abre las herramientas de desarrollador (F12)
   - Ve a la pestaña "Application" (Chrome) o "Storage" (Firefox)
   - Busca "Cookies" en el lado izquierdo
   - Verifica que la cookie `farmadescaso.sid` esté presente
   - Verifica que tenga los valores correctos:
     - `Secure`: true (en producción)
     - `SameSite`: Lax
     - `HttpOnly`: true
     - `Path`: /

## 🛠️ Solución de Problemas

### Problema: Las sesiones no persisten

**Causas posibles:**
1. Las cookies no se están guardando
2. Las cookies no se están enviando en peticiones siguientes
3. La configuración de `sameSite` es incorrecta
4. El `trust proxy` no está configurado

**Soluciones:**
1. Verificar que `trust proxy` esté configurado: `app.set('trust proxy', 1)`
2. Verificar que `secure: true` esté configurado en producción
3. Verificar que `sameSite: 'lax'` esté configurado
4. Revisar los logs en Vercel para ver si hay errores

### Problema: El login funciona pero luego se pierde la sesión

**Causas posibles:**
1. Las cookies no se están enviando en peticiones siguientes
2. El navegador está bloqueando las cookies
3. Hay un problema con CORS
4. La sesión se está guardando en una instancia diferente

**Soluciones:**
1. Verificar que las cookies estén presentes en el navegador
2. Verificar que no haya extensiones bloqueando cookies
3. Probar en modo incógnito
4. Verificar los logs para ver si la sesión se está guardando correctamente

### Problema: Error "Cannot set headers after they are sent"

**Causa:**
- Se está intentando enviar una respuesta después de que ya se envió

**Solución:**
- Asegurarse de que solo se envía una respuesta por request
- Usar `return` después de `res.redirect()` o `res.render()`

## 📋 Checklist de Verificación

- [ ] `trust proxy` configurado: `app.set('trust proxy', 1)`
- [ ] `secure: true` en producción
- [ ] `sameSite: 'lax'` configurado
- [ ] `resave: true` en la configuración de sesiones
- [ ] `req.session.save()` llamado antes de redirigir
- [ ] Logging habilitado para diagnóstico
- [ ] Cookies verificadas en el navegador
- [ ] Logs revisados en Vercel

## 🔄 Próximos Pasos

Si el problema persiste después de estos cambios:

1. **Considerar usar un almacenamiento de sesiones externo:**
   - Redis (recomendado para producción)
   - MongoDB
   - PostgreSQL

2. **Usar JWT tokens en lugar de sesiones:**
   - Más adecuado para entornos serverless
   - No requiere almacenamiento de estado
   - Más escalable

3. **Verificar la configuración de Vercel:**
   - Variables de entorno
   - Configuración de dominio
   - Configuración de HTTPS

## 📞 Soporte

Si después de seguir estos pasos el problema persiste:

1. Revisar los logs detallados en Vercel
2. Usar el endpoint de debug para obtener más información
3. Verificar las cookies en el navegador
4. Probar en un navegador diferente o modo incógnito

---

✅ **Todos los cambios han sido implementados y están listos para desplegarse.**

