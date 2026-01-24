/**
 * Recalcular rapeles (tabla `rapeles`) a partir de:
 * - objetivos_marca (objetivo trimestral por comercial+marca)
 * - ventas del trimestre por marca (desde pedidos + líneas)
 * - rapeles_configuracion (rango % cumplimiento -> % rapel)
 *
 * Uso:
 *   node scripts/recalcular-rapeles-trimestre.js --year 2025 --trimestre 4
 *   node scripts/recalcular-rapeles-trimestre.js --year 2025 --trimestre 4 --apply
 *   node scripts/recalcular-rapeles-trimestre.js --year 2025 --trimestre 4 --marca YOUBELLE,IALZON --apply
 *
 * Seguridad:
 * - Por defecto DRY-RUN (no escribe)
 * - Para escribir: --apply
 */

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

// Permitir apuntar el script a la BD remota sin tocar el código
// (OJO: mysql-crm lee env en require-time, así que esto debe ir ANTES del require).
const dbNameArg = argValue('--dbName') || argValue('--db');
if (dbNameArg) process.env.DB_NAME = dbNameArg;

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
const calculador = require('../utils/calcular-comisiones');

async function main() {
  const año = parseInt(argValue('--year') || '2025', 10);
  const trimestre = parseInt(argValue('--trimestre') || '4', 10);
  const apply = hasFlag('--apply');
  const includeAdmins = hasFlag('--includeAdmins') || hasFlag('--include-admins');
  const expectedDb = argValue('--expectedDb') || null;

  if (!Number.isFinite(año) || año < 2000 || año > 2100) {
    throw new Error(`Año inválido: ${año}`);
  }
  if (!Number.isFinite(trimestre) || trimestre < 1 || trimestre > 4) {
    throw new Error(`Trimestre inválido: ${trimestre}`);
  }

  // Info de BD destino
  const dbRow = await crm.query('SELECT DATABASE() AS db');
  const currentDb = dbRow?.[0]?.db;
  console.log(`📌 DB destino: ${currentDb}`);
  if (expectedDb && String(expectedDb) !== String(currentDb)) {
    throw new Error(`DB inesperada. expectedDb=${expectedDb} pero DATABASE()=${currentDb}`);
  }

  // Determinar marcas a recalcular: desde rapeles_configuracion activas (fallback a arg --marca)
  const marcasArg = argValue('--marca');
  let marcas = [];
  try {
    const rows = await comisionesCRM.getRapelesConfiguracion({ activo: true });
    marcas = (rows || [])
      .map(r => (r?.marca || '').toString().trim())
      .filter(Boolean)
      .map(m => m.toUpperCase());
    marcas = [...new Set(marcas)].sort();
  } catch (_) {
    marcas = [];
  }
  if (marcasArg) {
    const m = marcasArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (m.length > 0) marcas = m;
  }
  if (!marcas || marcas.length === 0) {
    throw new Error('No se pudieron resolver marcas. Añade --marca MARCA1,MARCA2 o revisa rapeles_configuracion.');
  }

  // Comerciales
  const comercialesRows = await crm.query('SELECT id, Nombre, Roll, roll FROM comerciales ORDER BY id ASC');
  const comerciales = (comercialesRows || []).filter(c => {
    const r = (c?.Roll || c?.roll || '').toString().toLowerCase();
    return includeAdmins ? true : !(r.includes('administrador') || r.includes('admin'));
  });
  const comercialesIds = comerciales.map(c => Number(c.id)).filter(n => Number.isFinite(n) && n > 0);

  console.log(`👤 Comerciales a recalcular: ${comercialesIds.length} ${includeAdmins ? '(incluye admins)' : '(excluye admins)'}`);
  console.log(`🏷️ Marcas: ${marcas.join(', ')}`);
  console.log(apply ? '⚠️ MODO APPLY: se escribirá en tabla rapeles' : '🧪 MODO DRY-RUN: NO se escribe');

  const resultados = [];
  let ok = 0;
  let errors = 0;

  for (const comercial_id of comercialesIds) {
    for (const marca of marcas) {
      try {
        const rapelCalc = await calculador.calcularRapelMarca(comercial_id, marca, trimestre, año);
        resultados.push({
          comercial_id,
          marca,
          trimestre,
          año,
          ...rapelCalc
        });

        if (apply) {
          await comisionesCRM.saveRapel({
            comercial_id,
            marca,
            trimestre,
            año,
            ventas_trimestre: rapelCalc.ventas_trimestre,
            objetivo_trimestre: rapelCalc.objetivo_trimestre,
            porcentaje_cumplimiento: rapelCalc.porcentaje_cumplimiento,
            porcentaje_rapel: rapelCalc.porcentaje_rapel,
            importe_rapel: rapelCalc.importe_rapel,
            estado: 'Calculado',
            calculado_por: 1
          });
        }

        ok += 1;
      } catch (e) {
        errors += 1;
        console.error(`❌ Error comercial ${comercial_id} marca ${marca}:`, e?.message || e);
      }
    }
  }

  const totalRapel = resultados.reduce((s, r) => s + Number(r.importe_rapel || 0), 0);
  console.log('---');
  console.log(`✅ Procesados: ${ok}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`💰 Total rapel (sumatorio): ${totalRapel.toFixed(2)}€`);

  const fs = require('fs');
  const path = require('path');
  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `recalculo-rapeles-T${trimestre}-${año}-${apply ? 'apply' : 'dry'}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ trimestre, año, apply, marcas, includeAdmins, resultados }, null, 2), 'utf8');
  console.log('Resumen:', outFile);
}

main().catch((err) => {
  console.error('❌ Error recalculando rapeles:', err?.message || err);
  process.exit(1);
});

