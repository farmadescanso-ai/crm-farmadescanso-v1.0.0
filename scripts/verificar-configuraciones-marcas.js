// =====================================================
// SCRIPT PARA VERIFICAR CONFIGURACIONES POR MARCA
// =====================================================
// Este script verifica qué marcas tienen configuraciones
// y cuáles faltan, ayudando a mantener el sistema actualizado
// =====================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarConfiguraciones() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    });

    console.log('✅ Conectado a la base de datos\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VERIFICACIÓN DE CONFIGURACIONES POR MARCA');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Obtener todas las marcas
    const [marcas] = await connection.execute('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
    console.log(`📋 Marcas existentes en la tabla Marcas: ${marcas.length}\n`);
    
    marcas.forEach(marca => {
      console.log(`   - ID ${marca.id}: ${marca.Nombre}`);
    });
    console.log('');

    // Verificar configuraciones de comisiones por tipo de pedido
    console.log('1️⃣  CONFIGURACIONES DE COMISIONES POR TIPO DE PEDIDO');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const marca of marcas) {
      const marcaNormalizada = marca.Nombre.toUpperCase();
      const [configs] = await connection.execute(
        `SELECT nombre_tipo_pedido, porcentaje_comision, año_aplicable 
         FROM config_comisiones_tipo_pedido 
         WHERE marca = ? AND activo = 1 
         ORDER BY nombre_tipo_pedido, año_aplicable`,
        [marcaNormalizada]
      );
      
      if (configs.length > 0) {
        console.log(`   ✅ ${marca.Nombre} (${marcaNormalizada}): ${configs.length} configuraciones`);
        configs.forEach(c => {
          console.log(`      - ${c.nombre_tipo_pedido}: ${c.porcentaje_comision}% (año ${c.año_aplicable})`);
        });
      } else {
        console.log(`   ⚠️  ${marca.Nombre} (${marcaNormalizada}): SIN CONFIGURACIONES`);
      }
    }
    
    // Verificar configuración general
    const [configGeneral] = await connection.execute(
      `SELECT COUNT(*) as total FROM config_comisiones_tipo_pedido WHERE marca IS NULL AND activo = 1`
    );
    console.log(`   📋 Configuración general (marca = NULL): ${configGeneral[0].total} configuraciones\n`);

    // Verificar configuraciones de rappel por presupuesto
    console.log('2️⃣  CONFIGURACIONES DE RAPPEL POR PRESUPUESTO');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const marca of marcas) {
      const marcaNormalizada = marca.Nombre.toUpperCase();
      const [configs] = await connection.execute(
        `SELECT porcentaje_rappel, año_aplicable 
         FROM config_rappel_presupuesto 
         WHERE marca = ? AND activo = 1`,
        [marcaNormalizada]
      );
      
      if (configs.length > 0) {
        configs.forEach(c => {
          console.log(`   ✅ ${marca.Nombre}: ${c.porcentaje_rappel}% (año ${c.año_aplicable})`);
        });
      } else {
        console.log(`   ⚠️  ${marca.Nombre}: SIN CONFIGURACIÓN`);
      }
    }
    
    const [rappelGeneral] = await connection.execute(
      `SELECT COUNT(*) as total FROM config_rappel_presupuesto WHERE marca IS NULL AND activo = 1`
    );
    console.log(`   📋 Configuración general: ${rappelGeneral[0].total} configuraciones\n`);

    // Verificar configuraciones de descuento de transporte
    console.log('3️⃣  CONFIGURACIONES DE DESCUENTO DE TRANSPORTE');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const marca of marcas) {
      const marcaNormalizada = marca.Nombre.toUpperCase();
      const [configs] = await connection.execute(
        `SELECT porcentaje_descuento, año_aplicable 
         FROM config_descuento_transporte 
         WHERE marca = ? AND activo = 1`,
        [marcaNormalizada]
      );
      
      if (configs.length > 0) {
        configs.forEach(c => {
          console.log(`   ✅ ${marca.Nombre}: ${c.porcentaje_descuento}% (año ${c.año_aplicable})`);
        });
      } else {
        console.log(`   ⚠️  ${marca.Nombre}: SIN CONFIGURACIÓN`);
      }
    }
    
    const [transporteGeneral] = await connection.execute(
      `SELECT COUNT(*) as total FROM config_descuento_transporte WHERE marca IS NULL AND activo = 1`
    );
    console.log(`   📋 Configuración general: ${transporteGeneral[0].total} configuraciones\n`);

    // Resumen
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total marcas en sistema: ${marcas.length}`);
    console.log(`\nPara agregar configuraciones para nuevas marcas:`);
    console.log(`   1. Agregar la marca a la tabla Marcas`);
    console.log(`   2. Ejecutar: insertar-valores-configuracion-comisiones-2026-escalable.sql`);
    console.log(`\nO usar el procedimiento almacenado:`);
    console.log(`   CALL sp_agregar_configuracion_nueva_marca('NombreMarca', 2026, 5.00, 15.00, 1.00, 10.00);`);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Verificación completada');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la verificación
verificarConfiguraciones();
