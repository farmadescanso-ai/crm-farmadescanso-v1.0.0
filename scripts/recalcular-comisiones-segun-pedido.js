/**
 * Recalcular comisiones según el comercial asignado en cada pedido (pedidos.Id_Cial).
 *
 * IMPORTANTE:
 * - Por defecto es DRY-RUN (NO escribe en BD).
 * - Para aplicar cambios en BD, pasar --apply
 *
 * Uso:
 *   node scripts/recalcular-comisiones-segun-pedido.js --year 2026
 *   node scripts/recalcular-comisiones-segun-pedido.js --year 2026 --fromMes 1 --toMes 12
 *   node scripts/recalcular-comisiones-segun-pedido.js --year 2026 --apply
 */
function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseIdList(arg) {
  if (!arg) return [];
  return String(arg)
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

// Permitir apuntar el script a la BD remota sin tocar el código
// (OJO: mysql-crm lee env en require-time, así que esto debe ir ANTES del require).
const dbNameArg = argValue('--dbName') || argValue('--db');
if (dbNameArg) process.env.DB_NAME = dbNameArg;

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
const calculador = require('../utils/calcular-comisiones');

async function calcularMensualDryRun(comercialId, mes, año) {
  // Replica la lógica de calcularComisionMensual pero SIN persistir.
  const configFijo = await comisionesCRM.getConfigFijoMensual();
  const fijosMarca = await calculador.obtenerFijosMensualesPorMarca(comercialId, mes, año);

  let fijoAPagar = 0;
  if (año <= configFijo.año_limite) {
    fijoAPagar = fijosMarca.reduce((sum, f) => sum + parseFloat(f.importe || 0), 0);
  } else {
    const comisionVentasTmp = await calculador.calcularComisionVentas(comercialId, mes, año);
    const ventasMensuales = comisionVentasTmp.total_ventas;

    let presupuestos = await comisionesCRM.getPresupuestos({
      comercial_id: comercialId,
      año: año,
      mes: mes,
      activo: 1
    });
    if (!presupuestos || presupuestos.length === 0) {
      presupuestos = await comisionesCRM.getPresupuestos({
        comercial_id: comercialId,
        año: año,
        mes: null,
        activo: 1
      });
    }
    let presupuestoMensual = 0;
    for (const presupuesto of presupuestos) {
      const importe = parseFloat(presupuesto.importe_presupuestado || 0);
      if (presupuesto.mes && presupuesto.mes > 0) {
        if (parseInt(presupuesto.mes) === mes) presupuestoMensual += importe;
      } else {
        presupuestoMensual += importe / 12;
      }
    }
    const minimoVentas = presupuestoMensual * (configFijo.porcentaje_minimo_ventas / 100);
    fijoAPagar = ventasMensuales >= minimoVentas
      ? fijosMarca.reduce((sum, f) => sum + parseFloat(f.importe || 0), 0)
      : 0;
  }

  const comisionVentas = await calculador.calcularComisionVentas(comercialId, mes, año);
  const totalComision = fijoAPagar + comisionVentas.total_comision;

  return {
    comercial_id: comercialId,
    mes,
    año,
    fijo_mensual: fijoAPagar,
    comision_ventas: comisionVentas.total_comision,
    comision_presupuesto: 0,
    total_ventas: comisionVentas.total_ventas,
    total_comision: totalComision,
    detalles_count: (comisionVentas.detalles || []).length
  };
}

async function main() {
  const yearsArg = argValue('--years');
  const singleYear = parseInt(argValue('--year') || '2026', 10);
  const years = yearsArg
    ? yearsArg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n))
    : [singleYear];
  const fromMes = parseInt(argValue('--fromMes') || '1', 10);
  const toMes = parseInt(argValue('--toMes') || '12', 10);
  const apply = hasFlag('--apply');
  const expectedDb = argValue('--expectedDb') || null;
  const includeEmptyMonths = hasFlag('--includeEmptyMonths') || hasFlag('--include-empty-months');
  const includeAdmins = hasFlag('--includeAdmins') || hasFlag('--include-admins');
  const comercialesArg = argValue('--comerciales') || argValue('--comercialesIds') || argValue('--comerciales_ids');
  const onlyComercialesIds = parseIdList(comercialesArg);

  const dbRow = await crm.query('SELECT DATABASE() AS db');
  const currentDb = dbRow?.[0]?.db;
  console.log(`📌 DB destino: ${currentDb}`);
  if (expectedDb && String(expectedDb) !== String(currentDb)) {
    throw new Error(`DB inesperada. expectedDb=${expectedDb} pero DATABASE()=${currentDb}`);
  }

  // Comerciales a recalcular
  const comercialesRows = await crm.query('SELECT id, Nombre, Roll, roll FROM comerciales ORDER BY id ASC');
  const comerciales = (comercialesRows || []).filter(c => {
    const r = (c?.Roll || c?.roll || '').toString().toLowerCase();
    return includeAdmins ? true : !(r.includes('administrador') || r.includes('admin'));
  });
  let comercialesIds = comerciales.map(c => Number(c.id)).filter(n => Number.isFinite(n) && n > 0);
  if (onlyComercialesIds.length > 0) {
    comercialesIds = comercialesIds.filter(id => onlyComercialesIds.includes(id));
  }

  console.log(`👤 Comerciales a recalcular: ${comercialesIds.length} ${includeAdmins ? '(incluye admins)' : '(excluye admins)'}`);
  if (onlyComercialesIds.length > 0) {
    console.log(`🎯 Filtro comerciales aplicado: ${onlyComercialesIds.join(', ')}`);
  }
  console.log(includeEmptyMonths ? '📅 Incluyendo meses sin pedido (1-12)' : '📅 Solo meses con pedidos');
  console.log(apply ? '⚠️ MODO APPLY: se escribirán comisiones en BD' : '🧪 MODO DRY-RUN: NO se escribe en BD');

  const resultados = [];
  for (const año of years) {
    let list = [];

    if (includeEmptyMonths) {
      for (const comercial_id of comercialesIds) {
        for (let mes = fromMes; mes <= toMes; mes++) {
          list.push({ comercial_id, mes });
        }
      }
    } else {
      // Obtener combinaciones (comercial, mes) a recalcular según pedidos del año
      const combos = await crm.query(
        `
        SELECT DISTINCT
          p.Id_Cial AS comercial_id,
          MONTH(p.FechaPedido) AS mes
        FROM pedidos p
        WHERE YEAR(p.FechaPedido) = ?
          AND MONTH(p.FechaPedido) BETWEEN ? AND ?
          AND p.EstadoPedido != 'Anulado'
          AND p.Id_Cial IS NOT NULL
        ORDER BY p.Id_Cial, mes
        `,
        [año, fromMes, toMes]
      );
      list = (combos || [])
        .map(r => ({ comercial_id: Number(r.comercial_id), mes: Number(r.mes) }))
        .filter(x => Number.isFinite(x.comercial_id) && x.comercial_id > 0 && x.mes >= 1 && x.mes <= 12);
      if (onlyComercialesIds.length > 0) {
        list = list.filter(x => onlyComercialesIds.includes(x.comercial_id));
      }
    }

    console.log(`🔎 ${año}: ${list.length} combinaciones (comercial, mes) [${fromMes}-${toMes}]`);

    for (const item of list) {
      if (apply) {
        const res = await calculador.calcularComisionMensual(item.comercial_id, item.mes, año, null);
        resultados.push({
          comercial_id: item.comercial_id,
          mes: item.mes,
          año,
          comision_id: res.id,
          total_ventas: res.total_ventas,
          total_comision: res.total_comision,
          detalles_count: (res.detalles || []).length
        });
        console.log(`✅ [APPLY] comercial ${item.comercial_id} ${item.mes}/${año} -> comisión ${res.id}`);
      } else {
        const res = await calcularMensualDryRun(item.comercial_id, item.mes, año);
        resultados.push(res);
        console.log(`🧪 [DRY] comercial ${item.comercial_id} ${item.mes}/${año} -> ventas ${res.total_ventas.toFixed(2)}€, comisión ${res.total_comision.toFixed(2)}€`);
      }
    }
  }

  const totalVentas = resultados.reduce((s, r) => s + Number(r.total_ventas || 0), 0);
  const totalComision = resultados.reduce((s, r) => s + Number(r.total_comision || 0), 0);
  console.log('---');
  console.log(`TOTAL ventas (sumatorio por combo): ${totalVentas.toFixed(2)}€`);
  console.log(`TOTAL comisión (sumatorio por combo): ${totalComision.toFixed(2)}€`);

  // Guardar resumen a fichero para auditoría
  const fs = require('fs');
  const path = require('path');
  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `recalculo-comisiones-${years.join('-')}-${fromMes}-${toMes}-${apply ? 'apply' : 'dry'}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ years, fromMes, toMes, apply, includeEmptyMonths, includeAdmins, resultados }, null, 2), 'utf8');
  console.log('Resumen:', outFile);
}

main().catch((err) => {
  console.error('❌ Error recalculando comisiones:', err?.message || err);
  process.exit(1);
});

