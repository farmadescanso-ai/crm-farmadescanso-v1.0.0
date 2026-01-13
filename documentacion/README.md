# Farmadescaso 2021 SL - Portal Comercial

## Descripción
Portal web profesional diseñado específicamente para los comerciales de Farmadescaso 2021 SL. La aplicación proporciona herramientas completas para la gestión de ventas, productos y clientes, con un diseño moderno y responsive.

## Características Principales

### 🔐 Sistema de Autenticación
- Login seguro para comerciales
- Gestión de sesiones
- Registro de nuevos comerciales (admin)
- Protección de rutas

### 📊 Dashboard Inteligente
- Métricas en tiempo real
- Gráficos interactivos con Chart.js
- Estadísticas de ventas y rendimiento
- Acceso rápido a funciones principales

### 📦 Gestión de Productos
- Catálogo completo de productos farmacéuticos
- Información detallada y precios
- Búsqueda y filtrado avanzado
- Gestión de stock

### 💰 Gestión de Ventas
- Registro de nuevas ventas
- Historial completo de transacciones
- Análisis de rendimiento
- Reportes automáticos

### 👥 Gestión de Clientes
- Base de datos de clientes
- Historial de compras
- Segmentación y análisis
- Herramientas de comunicación

### 📱 Acceso Móvil
- Diseño responsive completo
- Optimizado para smartphones y tablets
- Funcionalidades completas en móvil
- Interfaz intuitiva

## Tecnologías Utilizadas

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **EJS** - Motor de plantillas
- **NodoDB** - Base de datos NoSQL
- **Express Session** - Gestión de sesiones
- **Bcryptjs** - Encriptación de contraseñas
- **Helmet** - Seguridad HTTP
- **Compression** - Compresión de respuestas

### Frontend
- **Bootstrap 5** - Framework CSS
- **Font Awesome** - Iconografía
- **Chart.js** - Gráficos interactivos
- **JavaScript ES6+** - Funcionalidades dinámicas

### Base de Datos
- **NocoDB** - Base de datos NoSQL en la nube
- Configuración mediante variables de entorno (ver `.env.example`)

## Estructura del Proyecto

```
FarmaMVC/
├── config/
│   └── nododb.js          # Configuración de NodoDB
├── controllers/           # Controladores (futuro)
├── models/               # Modelos de datos (futuro)
├── public/
│   ├── css/
│   │   ├── auth.css      # Estilos de autenticación
│   │   ├── colors.css    # Paleta de colores
│   │   └── dashboard.css # Estilos del dashboard
│   ├── js/
│   │   ├── auth.js       # Interacciones del login
│   │   ├── dashboard.js  # JS del dashboard
│   │   ├── pedido-acciones.js # Acciones Holded/email
│   │   └── pedido-holded.js   # Compatibilidad legacy
│   └── images/           # Imágenes y logos corporativos
├── routes/
│   ├── auth.js          # Rutas de autenticación
│   ├── dashboard.js     # Rutas del dashboard
│   └── api.js           # API REST
├── views/
│   ├── error.ejs        # Página de error
│   ├── auth/
│   │   └── login.ejs   # Página de login
│   └── dashboard/
│       └── index.ejs   # Dashboard principal
├── server-crm-completo.js # Servidor principal (Express)
├── package.json        # Dependencias del proyecto
└── README.md          # Este archivo
```

## Instalación y Configuración

### Prerrequisitos
- Node.js (versión 14 o superior)
- npm o yarn
- Acceso a internet para NodoDB

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd FarmaMVC
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   # Copiar el archivo de ejemplo
   cp .env.example .env
   
   # Editar .env con tus propias credenciales
   # Ver .env.example para ver todas las variables necesarias
   ```
   
   Las variables más importantes son:
   - `PORT` - Puerto del servidor (default: 3000)
   - `SESSION_SECRET` - Secreto para sesiones (cambiar en producción)
   - `NOCODB_API_TOKEN` - Token de API de NocoDB
   - `NOCODB_BASE_URL` - URL de tu instancia NocoDB
   - `N8N_WEBHOOK_URL` - URL del webhook de N8N para procesar visitas (ver CONFIGURACION-N8N.md)

4. **Iniciar el servidor**
   ```bash
   npm start
   ```

5. **Acceder a la aplicación**
   Abrir navegador en: `http://localhost:3000`

### Scripts Disponibles

- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor en modo desarrollo con nodemon
- `npm test` - Ejecutar pruebas (pendiente de implementar)

## Uso de la Aplicación

### Para Comerciales
1. **Acceso**: Ir a `/auth/login`
2. **Login**: Usar credenciales proporcionadas por administración
3. **Dashboard**: Acceder a métricas y herramientas principales
4. **Gestión**: Utilizar las secciones de productos, ventas y clientes

### Para Administradores
1. **Gestión de Comerciales**: Crear y gestionar cuentas de comerciales
2. **Configuración**: Ajustar parámetros del sistema
3. **Reportes**: Generar reportes y análisis avanzados

## API Endpoints

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/logout` - Cerrar sesión
- `POST /auth/register` - Registrar nuevo comercial (admin)

### Dashboard
- `GET /dashboard` - Panel principal
- `GET /dashboard/productos` - Gestión de productos
- `GET /dashboard/ventas` - Gestión de ventas
- `GET /dashboard/perfil` - Perfil del comercial

### API REST
- `GET /api/comerciales` - Obtener comerciales
- `GET /api/productos` - Obtener productos
- `GET /api/ventas` - Obtener ventas del comercial
- `POST /api/ventas` - Crear nueva venta
- `GET /api/estadisticas` - Obtener estadísticas

## Seguridad

- **Autenticación**: Sistema de login seguro
- **Sesiones**: Gestión segura de sesiones
- **HTTPS**: Recomendado para producción
- **Validación**: Validación de datos de entrada
- **Sanitización**: Limpieza de datos de usuario
- **Helmet**: Headers de seguridad HTTP

## Personalización

### Colores y Estilos
Los colores principales se definen en CSS variables:
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
}
```

### Configuración de NodoDB
Modificar `config/nododb.js` para ajustar la conexión y métodos de base de datos.

## Despliegue en Producción

### Consideraciones
1. **Variables de entorno**: Configurar todas las variables necesarias
2. **HTTPS**: Implementar certificados SSL
3. **Base de datos**: Configurar NodoDB para producción
4. **Logs**: Implementar sistema de logging
5. **Monitoreo**: Configurar herramientas de monitoreo

### Servicios Recomendados
- **Heroku** - Despliegue fácil
- **Vercel** - Optimizado para Node.js
- **DigitalOcean** - VPS completo
- **AWS** - Solución empresarial

## Soporte y Mantenimiento

### Contacto
- **Email**: info@farmadescaso.com
- **Teléfono**: +34 900 123 456
- **Horario**: Lunes - Viernes 9:00 - 18:00

### Documentación Adicional
- Documentación técnica detallada
- Guías de usuario para comerciales
- Manual de administración
- API documentation

## 📦 Preparación para GitHub

Si vas a subir este proyecto a GitHub, lee primero `GITHUB_SETUP.md` para instrucciones detalladas sobre cómo hacerlo de forma segura.

**Importante:** 
- ✅ El archivo `.gitignore` está configurado para excluir archivos sensibles
- ✅ Crea un archivo `.env.example` antes de subir (ya incluido)
- ⚠️ Revisa los archivos de configuración antes del primer commit

## Licencia
© 2024 Farmadescaso 2021 SL. Todos los derechos reservados.

## Changelog

### v1.0.0 (2024-10-28)
- ✅ Núcleo CRM (autenticación + dashboard)
- ✅ Sistema de autenticación
- ✅ Dashboard funcional
- ✅ Gestión de productos y ventas
- ✅ Diseño responsive
- ✅ Integración con NodoDB
- ✅ API REST básica

### Próximas Versiones
- 🔄 Sistema de notificaciones push
- 🔄 Reportes avanzados en PDF
- 🔄 Integración con sistemas externos
- 🔄 Aplicación móvil nativa
- 🔄 Análisis predictivo con IA

---

**Desarrollado con ❤️ para Farmadescaso 2021 SL**





