# Lógica y proceso del cálculo de Comisiones de Ventas (CRM Farmadescanso)

Este documento describe **cómo se calcula la comisión de ventas** para cada comercial, **cuándo se dispara**, qué tablas intervienen, cómo se elige el **% de comisión**, y un checklist para diagnosticar cuando “algo no cuadra”.

---

## 1) Cuándo se calcula (trigger funcional)

La comisión de ventas **debe reflejar solo pedidos “cerrados operativamente”** (al menos, ya tramitados).

En la aplicación, el recalculo se dispara cuando un pedido cambia de:

- **EstadoPedido: `Pendiente` → `Tramitado`**

En ese momento se lanza (en segundo plano) un recálculo del mes del pedido, para **el comercial asignado al pedido**:

- Comercial del pedido: **`pedidos.Id_Cial`**
- Mes/Año del pedido: **`MONTH(pedidos.FechaPedido)` / `YEAR(pedidos.FechaPedido)`**

Esto evita:

- Calcular comisiones “antes de tiempo” (pedido todavía pendiente)
- Calcular comisiones para el usuario logado si no coincide con el comercial del pedido

---

## 2) Qué pedidos entran en el cálculo (filtro)

Se obtienen pedidos del comercial en un mes/año, excluyendo estados que **no deben comisionar**:

- Excluidos: `Anulado`, `Pendiente`, `Cancelado` (y variantes por `LOWER()`).

La idea es que **solo comisione lo tramitado/entregado/cerrado**, según tu flujo real.

> Si en tu instalación usáis más estados (“Enviado”, “Entregado”, etc.), entrarán si no están en la lista de excluidos.

---

## 3) Cálculo: visión general (por pedido → por línea)

La comisión de ventas se calcula **por líneas** (`pedidos_articulos`) y luego se agrega:

1. Para cada **pedido** del mes:
2. Obtener sus **líneas**
3. Calcular una **Base Imponible ajustada** por línea (si hay descuento de transporte)
4. Determinar el **% de comisión** de esa línea (por marca y tipo de pedido, con prioridad a condiciones especiales)
5. Calcular **importe de comisión** de la línea
6. Guardar detalle (`comisiones_detalle`) y total mensual (`comisiones`)

---

## 4) Relación pedido ↔ líneas (punto crítico)

En distintas instalaciones, `pedidos_articulos` puede relacionarse con `pedidos` de dos formas:

- **Por ID numérico**: `pedidos_articulos.Id_NumPedido = pedidos.id`
- **Por número de pedido string**: `pedidos_articulos.NumPedido = pedidos.NumPedido`

Si el cálculo consulta solo una de las dos, algunos pedidos salen “sin líneas”, y entonces:

- Base imponible = 0
- Comisión ventas = 0
- Detalle vacío

**Solución aplicada**: el cálculo intenta primero por `Id_NumPedido` y si no encuentra filas, hace fallback por `NumPedido`.

Checklist de verificación en SQL:

```sql
-- 1) ¿El pedido tiene líneas por Id_NumPedido?
SELECT COUNT(*) n
FROM pedidos_articulos
WHERE Id_NumPedido = 123;

-- 2) ¿El pedido tiene líneas por NumPedido?
SELECT COUNT(*) n
FROM pedidos_articulos
WHERE NumPedido = 'P250001';
```

---

## 5) Transporte y descuento (base ajustada)

Para cada pedido:

- \( transporte = TotalPedido - BaseImponible - TotalIva \)

Después se consulta la configuración de **descuento de transporte** por marca/año (tabla de configuración):

- `comisionesCRM.getDescuentoTransporte(marca, año)` → devuelve un %

Si hay transporte > 0 y % > 0:

- \( descuentoTransporte = transporte \times \% / 100 \)

Ese descuento se reparte proporcionalmente a cada línea (según su subtotal) y se resta de la base:

- \( baseLineaAjustada = SubtotalLinea - (descuentoTransporte \times SubtotalLinea / \sum Subtotales) \)

---

## 6) Cómo se decide el % de comisión (prioridades)

### 6.1 Prioridad 1: condiciones especiales

Tabla: `condiciones_especiales`

Se buscan reglas activas, por artículo/comercial, con posibilidad de “wildcards”:

- `articulo_id = X` o `NULL` (aplica a todos)
- `comercial_id = X` o `NULL` (aplica a todos)

Si existe una condición especial aplicable, **sobrescribe** el porcentaje.

### 6.2 Prioridad 2: configuración por marca + tipo de pedido

Tabla: `config_comisiones_tipo_pedido`

Se busca con esta prioridad:

1) Por `marca + tipo_pedido_id + año_aplicable`
2) Fallback: `marca + nombre_tipo_pedido + año_aplicable`
3) Fallback: `marca + tipo_pedido_id + año_aplicable IS NULL`
4) Fallback final: `marca + nombre_tipo_pedido + año_aplicable IS NULL`

Si no se encuentra configuración, **NO se aplica comisión por defecto**:

- Se registra un **aviso** (warning) indicando que falta configuración para ese pedido/línea (marca/tipo/año).
- La línea se calcula con **0%** hasta que se configure `config_comisiones_tipo_pedido`.

Checklist SQL:

```sql
SELECT *
FROM config_comisiones_tipo_pedido
WHERE marca = 'YOUBELLE'
  AND año_aplicable IN (2025) /* o NULL */
ORDER BY año_aplicable DESC, tipo_pedido_id;
```

---

## 7) Fórmula final por línea

- \( comisionLinea = baseLineaAjustada \times \% / 100 \)

Se guarda en `comisiones_detalle`:

- `pedido_id`
- `articulo_id`
- `importe_venta` (base ajustada)
- `%`
- `importe_comision`
- `observaciones` (condición especial / tipo pedido / descuento transporte)

---

## 8) Persistencia (tablas y estados)

### 8.1 Resumen mensual

Tabla: `comisiones`

Claves típicas:

- `comercial_id`, `mes`, `año`

Campos:

- `total_ventas`, `comision_ventas`, `total_comision`, `estado`, etc.

### 8.2 Detalle

Tabla: `comisiones_detalle`

Se eliminan/recrean detalles al recalcular para mantener coherencia.

### 8.3 Estado normalizado (nuevo)

Tabla: `estadoComisiones` (1 registro por comisión)

Estados:

- `Pendiente`
- `Calculado`
- `Pagado`

Sincronización:

- Al calcular: upsert → `Calculado`
- Al pagar: upsert → `Pagado`

Acceso (admin):

- `/dashboard/comisiones/estado-comisiones`

---

## 9) Checklist rápido cuando “no cuadra”

- **¿El pedido estaba realmente en “Tramitado” cuando esperas la comisión?**
  - Si sigue “Pendiente”, el cálculo no lo debe incluir.
- **¿El pedido tiene `Id_Cial` correcto?**
  - Si `Id_Cial` está mal o vacío, se calcula para otro comercial o no se calcula.
- **¿Hay líneas vinculadas al pedido?**
  - Ver sección 4 (Id_NumPedido vs NumPedido).
- **¿Existe `tipo_pedido_id` en el pedido?**
  - Si falta, puede no encontrarse configuración por ID y la línea terminar en **0%** (ver warnings `SIN_CONFIG`).
- **¿Existe configuración en `config_comisiones_tipo_pedido` para esa marca/año?**
  - Si no existe configuración, **NO hay comisión por defecto**: la línea queda al **0%** y se registra aviso `SIN_CONFIG`.
- **¿La marca del artículo se resuelve correctamente?**
  - La marca se obtiene por join `articulos.Id_Marca -> marcas.Nombre`.
- **¿Descuento de transporte configurado?**
  - Si hay transporte y % configurado, la base se reduce y la comisión baja (esperado).

---

## 10) Recalcular histórico (scripts)

Si necesitas rehacer meses/años completos (por ejemplo, 2025), usa los scripts del repo en modo DRY-RUN y luego APPLY:

- `scripts/recalcular-comisiones-segun-pedido.js`

### 10.1 Recalcular desde un pedido concreto (acción en la app, SOLO admin)

En la ficha del pedido (`/dashboard/pedidos/:id`) hay un botón **“Recalcular comisiones”** (solo visible para administradores).

Flujo:

- La UI pide confirmación.
- El servidor cambia el pedido temporalmente a **`Pendiente`** (si no lo estaba).
- Ejecuta el recálculo del mes/año del pedido para el **comercial asignado** (`pedidos.Id_Cial`).
- Restaura el **estado original** del pedido.

Endpoint:

- `POST /dashboard/pedidos/:id/recalcular-comisiones`

> Esto sirve para “rehacer” un pedido concreto cuando sospechas que su comisión no se ha incorporado bien al mes.

### 10.2 Recalcular por comercial / mes / año (acción en Comisiones, SOLO admin)

En el listado de comisiones (`/dashboard/comisiones/comisiones`), cada fila tiene un botón **↻ Recalcular** (solo admin) que fuerza el recálculo del:

- Comercial + mes + año de esa comisión.

Endpoint interno:

- `POST /dashboard/comisiones/comisiones/calcular` con `{ comercial_id, mes, año }`

> Importante: antes de recalcular histórico, asegúrate de que los pedidos del periodo estén en estado “comisionable” (p.ej. Tramitado/Entregado), porque el cálculo excluye pendientes.

