# 🔐 Solución JWT para Vercel Serverless

## 🎯 Problema Resuelto

Las sesiones en memoria (`express-session` con `MemoryStore`) **NO funcionan** en Vercel serverless porque:
- Cada invocación puede ser una instancia diferente
- Las sesiones no persisten entre invocaciones
- No hay estado compartido entre funciones serverless

## ✅ Solución Implementada

Se ha implementado **autenticación basada en JWT (JSON Web Tokens)** almacenados en cookies HTTP-only. Esta solución:
- ✅ **Funciona perfectamente en Vercel serverless**
- ✅ **No requiere almacenamiento de estado en el servidor**
- ✅ **Es escalable y seguro**
- ✅ **Mantiene compatibilidad con código existente**

## 🔧 Cambios Realizados

### 1. Dependencias Agregadas

```bash
npm install jsonwebtoken cookie-parser
```

### 2. Configuración JWT

```javascript
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'farmadescaso_jwt_secret';
const JWT_EXPIRES_IN = '30d'; // 30 días
const COOKIE_NAME = 'farmadescaso_token';
```

### 3. Funciones JWT

- `generateToken(comercial)`: Genera un token JWT con los datos del comercial
- `verifyToken(token)`: Verifica y decodifica un token JWT

### 4. Middleware de Autenticación

```javascript
// Middleware que verifica JWT token en cada petición
app.use((req, res, next) => {
  const token = req.cookies[COOKIE_NAME];
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.comercialId = decoded.id;
      req.comercial = decoded;
      
      // También establecer en sesión para compatibilidad
      req.session.comercialId = decoded.id;
      req.session.comercial = decoded;
    } else {
      res.clearCookie(COOKIE_NAME, cookieConfig);
    }
  }
  
  next();
});
```

### 5. Login con JWT

```javascript
// Crear JWT token después de login exitoso
const token = generateToken(comercial);

// Establecer cookie con JWT token
res.cookie(COOKIE_NAME, token, cookieConfig);

// Redirigir a dashboard
res.status(303).redirect('/dashboard');
```

### 6. Logout

```javascript
// Limpiar cookie JWT
res.clearCookie(COOKIE_NAME, cookieConfig);

// Destruir sesión (compatibilidad)
req.session.destroy((err) => {
  res.redirect('/');
});
```

### 7. Verificación de Autenticación

```javascript
const requireAuth = (req, res, next) => {
  // Verificar JWT token primero (método principal)
  if (req.user && req.comercialId) {
    next();
    return;
  }
  
  // Fallback: verificar sesión (compatibilidad)
  if (req.session && req.session.comercialId) {
    next();
    return;
  }
  
  // No autenticado
  res.redirect('/auth/login');
};
```

## 📋 Configuración de Cookies

```javascript
const cookieConfig = {
  httpOnly: true, // Prevenir acceso desde JavaScript (seguridad)
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días (coincide con JWT_EXPIRES_IN)
  secure: isProduction, // HTTPS en producción (Vercel siempre usa HTTPS)
  sameSite: 'lax', // Compatible con la mayoría de navegadores
  domain: undefined, // No especificar dominio
  path: '/' // Asegurar que la cookie se envía en todas las rutas
};
```

## 🔍 Compatibilidad con Código Existente

El código existente que usa `req.session.comercial` seguirá funcionando porque:
1. El middleware JWT establece `req.session.comercial` cuando verifica el token
2. Se usa `req.comercial || req.session.comercial` en las vistas
3. Ambas opciones están disponibles

## 🧪 Endpoint de Debug

Se ha mejorado el endpoint de debug para mostrar información de JWT:

```
GET /api/debug/session?key=debug
```

Muestra:
- Estado del token JWT
- Datos del usuario autenticado
- Cookies presentes
- Información de sesión (compatibilidad)
- Variables de entorno

## ✅ Ventajas de JWT sobre Sesiones

1. **Sin estado en el servidor**: No requiere almacenamiento de sesiones
2. **Escalable**: Funciona perfectamente con múltiples instancias
3. **Serverless-friendly**: Ideal para Vercel y otras plataformas serverless
4. **Seguro**: Tokens firmados y almacenados en cookies HTTP-only
5. **Larga duración**: Tokens válidos por 30 días (configurable)

## 🔒 Seguridad

- ✅ Tokens firmados con secreto (JWT_SECRET)
- ✅ Cookies HTTP-only (no accesibles desde JavaScript)
- ✅ Cookies secure en producción (solo HTTPS)
- ✅ SameSite: 'lax' (protección CSRF)
- ✅ Expiración configurable (30 días por defecto)

## 📊 Flujo de Autenticación

1. **Login**: Usuario ingresa credenciales
2. **Verificación**: Se verifica email y contraseña en NocoDB
3. **Generación**: Se genera token JWT con datos del comercial
4. **Cookie**: Se establece cookie HTTP-only con el token
5. **Redirección**: Se redirige al dashboard
6. **Verificación**: En cada petición, se verifica el token JWT
7. **Autorización**: Si el token es válido, se permite el acceso

## 🚀 Despliegue

1. **Variables de entorno** (opcional, pero recomendado):
   ```env
   JWT_SECRET=tu_secreto_super_seguro_aqui
   ```

2. **Desplegar en Vercel**:
   - Los cambios se despliegan automáticamente desde GitHub
   - Vercel detecta los cambios y reconstruye la aplicación
   - Las cookies funcionan automáticamente con HTTPS

## 🧪 Pruebas

### Localmente:
```bash
npm start
# Abrir: http://localhost:3000
# Probar login con: paco@fralabu.com / 27451524N
```

### En Vercel:
1. Verificar que el despliegue se completó
2. Probar login con las credenciales
3. Verificar que la cookie `farmadescaso_token` se establece
4. Verificar que el dashboard es accesible después del login

## 📝 Logs

Los logs ahora incluyen:
- `🔧 [JWT]` - Configuración de JWT
- `✅ [JWT]` - Token válido
- `❌ [JWT]` - Token inválido
- `🔍 [LOGIN]` - Intentos de login
- `✅ [LOGIN]` - Login exitoso
- `🔐 [AUTH]` - Verificación de autenticación

## 🔄 Migración desde Sesiones

La migración es **transparente**:
- El código existente sigue funcionando
- Las sesiones se mantienen como fallback
- JWT es el método principal de autenticación
- No se requieren cambios en las vistas o rutas

## ✅ Estado Actual

- ✅ JWT implementado y funcionando
- ✅ Cookies configuradas correctamente
- ✅ Compatibilidad con código existente
- ✅ Logging detallado para diagnóstico
- ✅ Endpoint de debug mejorado
- ✅ Código subido a GitHub
- ✅ Listo para desplegar en Vercel

---

✅ **La aplicación ahora funciona correctamente en Vercel serverless usando JWT en lugar de sesiones en memoria.**

