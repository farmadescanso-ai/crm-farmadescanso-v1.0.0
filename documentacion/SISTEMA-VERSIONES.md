# Sistema de Control de Versionado
## CRM Farmadescanso

### Propósito
Este documento describe el sistema de control de versiones implementado para mantener un registro organizado de las versiones de la aplicación, permitiendo:
- Rastrear todas las versiones liberadas
- Identificar la última versión estable
- Facilitar el proceso de rollback cuando sea necesario
- Mantener un historial completo de cambios
- Sincronizar con GitHub para control de código fuente

---

## 📋 Tabla de Versiones

### Estructura de la Tabla `versiones`

La tabla `versiones` almacena toda la información relevante sobre cada versión de la aplicación:

**Campos Principales:**
- `numero_version`: Versión en formato semántico (ej: 1.0.0)
- `version_mayor`, `version_menor`, `version_revision`: Componentes numéricos para ordenamiento
- `tipo_version`: desarrollo, beta, estable, hotfix
- `estable`: Indica si es una versión estable (1) o no (0)
- `tag_github`: Tag asociado en GitHub (ej: v1.0.0)
- `commit_hash`: Hash del commit específico
- `descripcion`: Descripción breve de la versión
- `notas_cambio`: CHANGELOG detallado
- `activa_produccion`: Indica si está actualmente desplegada en producción

---

## 🔢 Sistema de Numeración de Versiones (Semantic Versioning)

Utilizamos **Semantic Versioning (SemVer)** con el formato: `MAYOR.MENOR.REVISIÓN`

### Reglas:
- **MAYOR (1.x.x)**: Incrementar cuando hay cambios incompatibles con versiones anteriores
- **MENOR (x.1.x)**: Incrementar cuando se añaden funcionalidades compatibles hacia atrás
- **REVISIÓN (x.x.1)**: Incrementar cuando se corrigen bugs compatibles hacia atrás

### Ejemplos:
- `1.0.0` → Versión inicial estable
- `1.1.0` → Nueva funcionalidad (compatible)
- `1.1.1` → Corrección de bug
- `2.0.0` → Cambio mayor (posiblemente incompatible)

---

## 🚀 Proceso de Versión

### 1. Desarrollo Normal (Versiones Menores y Revisiones)

#### Paso 1: Crear la Versión en la Base de Datos
```sql
INSERT INTO versiones (
  numero_version,
  version_mayor,
  version_menor,
  version_revision,
  tipo_version,
  estable,
  tag_github,
  descripcion,
  notas_cambio,
  creado_por,
  activa_produccion
) VALUES (
  '1.1.0',  -- Nueva versión
  1,
  1,
  0,
  'desarrollo',
  0,  -- No estable todavía
  'v1.1.0',
  'Añadida funcionalidad de exportación de reportes',
  'Nuevas características:
- Exportación de reportes a PDF
- Mejoras en el dashboard
- Corrección de bug en cálculo de comisiones',
  'Tu Nombre',
  0
);
```

#### Paso 2: Actualizar package.json
```json
{
  "version": "1.1.0"
}
```

#### Paso 3: Commit y Tag en GitHub
```bash
# Hacer commit de los cambios
git add .
git commit -m "Versión 1.1.0: Añadida exportación de reportes"

# Crear tag
git tag -a v1.1.0 -m "Versión 1.1.0: Añadida exportación de reportes"

# Subir a GitHub
git push origin main
git push origin v1.1.0
```

#### Paso 4: Actualizar el Registro con Tag y Commit
```sql
UPDATE versiones 
SET 
  tag_github = 'v1.1.0',
  commit_hash = 'abc123...',  -- Hash real del commit
  branch_github = 'main'
WHERE numero_version = '1.1.0';
```

#### Paso 5: Marcar como Estable (después de pruebas)
```sql
UPDATE versiones 
SET 
  estable = 1,
  fecha_estable = NOW(),
  activa_produccion = 1,  -- Si se despliega a producción
  fecha_despliegue = NOW()
WHERE numero_version = '1.1.0';
```

### 2. Versión Estable Inicial

Para marcar la primera versión como estable (1.0.0):

```sql
-- Ya está incluido en el script crear-tabla-versiones.sql
-- Se inserta automáticamente la versión 1.0.0 como estable
```

### 3. Hotfix (Corrección Urgente)

Para correcciones urgentes de producción:

```sql
-- Ejemplo: Hotfix 1.0.1
INSERT INTO versiones (
  numero_version,
  version_mayor,
  version_menor,
  version_revision,
  tipo_version,
  estable,
  tag_github,
  descripcion,
  notas_cambio,
  creado_por,
  activa_produccion
) VALUES (
  '1.0.1',
  1,
  0,
  1,
  'hotfix',
  1,
  'v1.0.1',
  'Hotfix: Corrección crítica en cálculo de comisiones',
  'Correcciones:
- Corregido error en cálculo de comisiones que causaba valores incorrectos
- Actualizado algoritmo de cálculo para evitar división por cero',
  'Tu Nombre',
  1
);
```

---

## 📊 Consultas Útiles

### Obtener Última Versión Estable
```sql
SELECT * FROM v_ultima_version_estable;
-- O directamente:
SELECT * FROM versiones 
WHERE estable = 1 
ORDER BY version_mayor DESC, version_menor DESC, version_revision DESC 
LIMIT 1;
```

### Obtener Versión Actual en Producción
```sql
SELECT * FROM v_version_produccion;
-- O directamente:
SELECT * FROM versiones 
WHERE activa_produccion = 1 
ORDER BY fecha_despliegue DESC 
LIMIT 1;
```

### Historial Completo de Versiones
```sql
SELECT 
  numero_version,
  tipo_version,
  estable,
  activa_produccion,
  fecha_creacion,
  fecha_despliegue,
  descripcion
FROM versiones
ORDER BY version_mayor DESC, version_menor DESC, version_revision DESC;
```

### Versiones Estables Disponibles para Rollback
```sql
SELECT 
  numero_version,
  tag_github,
  commit_hash,
  fecha_estable,
  descripcion
FROM versiones
WHERE estable = 1 AND rollback_disponible = 1
ORDER BY version_mayor DESC, version_menor DESC, version_revision DESC;
```

---

## 🔄 Proceso de Rollback

### 1. Identificar Versión Objetivo
```sql
SELECT * FROM versiones 
WHERE numero_version = '1.0.0' AND estable = 1;
```

### 2. Verificar Tag y Commit en GitHub
```bash
# Verificar que el tag existe
git tag -l v1.0.0

# Ver detalles del tag
git show v1.0.0
```

### 3. Realizar Rollback en GitHub
```bash
# Crear branch desde el tag objetivo
git checkout -b rollback-v1.0.0 v1.0.0

# O hacer checkout directo al tag
git checkout v1.0.0

# Si es necesario crear nueva versión de rollback
git tag -a v1.0.1 -m "Rollback a versión estable 1.0.0"
```

### 4. Actualizar Base de Datos
```sql
-- Marcar versión anterior como inactiva
UPDATE versiones SET activa_produccion = 0 WHERE activa_produccion = 1;

-- Registrar nueva versión de rollback o reactivar versión anterior
UPDATE versiones 
SET 
  activa_produccion = 1,
  fecha_despliegue = NOW()
WHERE numero_version = '1.0.0';
```

---

## 📝 Changelog (Registro de Cambios)

Mantener un archivo `CHANGELOG.md` en la raíz del proyecto con el historial de cambios:

```markdown
# Changelog

## [1.1.0] - 2025-01-XX
### Añadido
- Exportación de reportes a PDF
- Nuevo dashboard de estadísticas

### Mejorado
- Rendimiento en carga de pedidos
- Interfaz de usuario

### Corregido
- Bug en cálculo de comisiones
- Error al guardar clientes sin DNI

## [1.0.0] - 2025-01-XX
### Inicial
- Primera versión estable
- Gestión completa de clientes, pedidos y comerciales
```

---

## ✅ Checklist para Nueva Versión

- [ ] Actualizar número de versión en `package.json`
- [ ] Crear registro en tabla `versiones`
- [ ] Hacer commit de cambios con mensaje descriptivo
- [ ] Crear tag en GitHub (ej: `v1.1.0`)
- [ ] Actualizar registro en BD con `commit_hash` y `tag_github`
- [ ] Realizar pruebas
- [ ] Marcar como estable si pasa todas las pruebas
- [ ] Actualizar `CHANGELOG.md`
- [ ] Desplegar a producción si corresponde
- [ ] Marcar como `activa_produccion = 1`

---

## 🎯 Versión Actual Propuesta

**Versión Inicial: 1.0.0**

Esta versión representa la primera versión estable del sistema CRM Farmadescanso con todas las funcionalidades principales implementadas y probadas.

### Próximas Versiones Sugeridas:
- **1.0.1**: Correcciones menores de bugs
- **1.1.0**: Nuevas funcionalidades compatibles
- **2.0.0**: Cambios mayores o refactorizaciones importantes

---

## 📚 Referencias

- [Semantic Versioning](https://semver.org/)
- [Git Tags Documentation](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
- [Keep a Changelog](https://keepachangelog.com/)

---

**Última actualización**: Enero 2025