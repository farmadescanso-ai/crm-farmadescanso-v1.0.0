# 🔐 Solución de Problemas de Login

## Problema
No se puede iniciar sesión en la aplicación desplegada con:
- **Email:** paco@fralabu.com
- **Contraseña:** 27451524N

## Soluciones Implementadas

### 1. Configuración de Sesiones Mejorada
- ✅ Configurado `trust proxy` para que Express detecte correctamente HTTPS en Vercel
- ✅ Configurado `secure: true` solo en producción (Vercel siempre usa HTTPS)
- ✅ Configurado `sameSite: 'lax'` para compatibilidad con navegadores
- ✅ Añadido guardado explícito de sesión antes de redirigir

### 2. Login Mejorado
- ✅ Normalización de email (minúsculas, sin espacios)
- ✅ Búsqueda de contraseña en múltiples campos (password, Password, contraseña, Contraseña, DNI, dni)
- ✅ Comparación de contraseñas con trim y case-sensitive
- ✅ Logging detallado para depuración
- ✅ Mensajes de error más claros

### 3. Verificación del Comercial
El comercial existe en la base de datos:
- **Email:** paco@fralabu.com
- **DNI:** 27451524N (se usa como contraseña)
- **Nombre:** Paco Lara
- **ID:** 1

## Cambios Realizados

### server-crm-completo.js

1. **Configuración de sesiones:**
```javascript
app.set('trust proxy', 1); // Confiar en el proxy de Vercel
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

app.use(session({
  secret: process.env.SESSION_SECRET || 'farmadescaso_secret',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: { 
    secure: isProduction, // HTTPS en producción
    httpOnly: true,
    maxAge: 30 * 60 * 1000,
    sameSite: 'lax',
    domain: undefined
  },
  name: 'farmadescaso.sid',
  proxy: isProduction
}));
```

2. **Login mejorado:**
- Normalización de email
- Búsqueda de contraseña en múltiples campos
- Guardado explícito de sesión
- Logging detallado

## Cómo Probar

1. **Desplegar los cambios en Vercel:**
   ```bash
   git add .
   git commit -m "Fix: Mejorar login y configuración de sesiones"
   git push
   ```

2. **Probar el login:**
   - Ir a la URL de la aplicación desplegada
   - Intentar iniciar sesión con:
     - Email: `paco@fralabu.com`
     - Contraseña: `27451524N`

3. **Verificar los logs:**
   - Revisar los logs de Vercel para ver los mensajes de depuración
   - Buscar mensajes que empiecen con `[LOGIN]`

## Posibles Problemas y Soluciones

### Problema: "Email o contraseña incorrectos"
**Causa:** El email o la contraseña no coinciden.

**Solución:**
- Verificar que el email esté escrito correctamente: `paco@fralabu.com`
- Verificar que la contraseña sea exactamente: `27451524N` (sin espacios, mayúscula la N)

### Problema: La sesión no se guarda
**Causa:** Problemas con las cookies en producción.

**Solución:**
- Verificar que la aplicación esté usando HTTPS (Vercel lo proporciona automáticamente)
- Verificar que el navegador no esté bloqueando cookies de terceros
- Intentar en modo incógnito para descartar problemas de caché

### Problema: Redirección infinita
**Causa:** La sesión no se está guardando correctamente.

**Solución:**
- Verificar los logs de Vercel para ver errores de sesión
- Verificar que `SESSION_SECRET` esté configurado en las variables de entorno de Vercel
- Verificar que `trust proxy` esté configurado correctamente

## Verificación de la Base de Datos

El comercial existe y tiene los siguientes datos:
```json
{
  "Id": 1,
  "Nombre": "Paco Lara",
  "Email": "paco@fralabu.com",
  "DNI": "27451524N",
  "Móvil": "+34610721369",
  "Dirección": "Avenida Juan Carlos I, 76, 1º F",
  "Población": "El Puntal",
  "Provincia": "Murcia",
  "Roll": "Administrador"
}
```

## Variables de Entorno Requeridas

Asegúrate de que estas variables estén configuradas en Vercel:
- `NODE_ENV=production` (automático en Vercel)
- `SESSION_SECRET` (opcional, tiene un valor por defecto)
- `VERCEL=1` (automático en Vercel)

## Logs de Depuración

El sistema ahora muestra logs detallados:
- `🔍 [LOGIN] Intentando login para: ...`
- `✅ [LOGIN] Comercial encontrado: ...`
- `🔑 [LOGIN] Campo de contraseña encontrado: ...`
- `✅ [LOGIN] Contraseña correcta para: ...`
- `✅ [LOGIN] Sesión creada para comercial ID: ...`
- `✅ [LOGIN] Sesión guardada correctamente, redirigiendo a dashboard`

Si hay errores, se mostrarán con el prefijo `❌ [LOGIN]`.

## Próximos Pasos

1. Desplegar los cambios en Vercel
2. Probar el login
3. Revisar los logs si hay problemas
4. Si persiste el problema, verificar:
   - Que el navegador acepta cookies
   - Que no hay problemas de CORS
   - Que la URL de la aplicación es correcta
   - Que las variables de entorno están configuradas

