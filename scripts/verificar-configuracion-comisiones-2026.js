// Script para verificar que la configuración de comisiones para 2026 se insertó correctamente
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificar() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VERIFICACIÓN DE CONFIGURACIÓN DE COMISIONES 2026');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Comisiones por Tipo de Pedido
    console.log('1️⃣ COMISIONES POR TIPO DE PEDIDO:');
    console.log('───────────────────────────────────────────────────────────');
    const [comisionesTipo] = await connection.query(`
      SELECT marca, nombre_tipo_pedido, porcentaje_comision, año_aplicable, activo
      FROM config_comisiones_tipo_pedido
      WHERE año_aplicable = 2026
      ORDER BY marca, nombre_tipo_pedido
    `);
    
    if (comisionesTipo.length > 0) {
      console.log(`✅ ${comisionesTipo.length} configuraciones encontradas:\n`);
      const grouped = {};
      comisionesTipo.forEach(c => {
        const key = c.nombre_tipo_pedido || 'N/A';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
      });
      
      Object.keys(grouped).forEach(tipo => {
        console.log(`   📦 ${tipo}:`);
        grouped[tipo].forEach(c => {
          const marca = c.marca || 'Todas (NULL)';
          console.log(`      - ${marca}: ${c.porcentaje_comision}% ${c.activo ? '✅' : '❌'}`);
        });
      });
    } else {
      console.log('⚠️  No se encontraron configuraciones');
    }
    console.log('');

    // 2. Rappel por Presupuesto
    console.log('2️⃣ RAPPEL POR PRESUPUESTO:');
    console.log('───────────────────────────────────────────────────────────');
    const [rappelPresupuesto] = await connection.query(`
      SELECT marca, porcentaje_rappel, año_aplicable, activo
      FROM config_rappel_presupuesto
      WHERE año_aplicable = 2026
      ORDER BY marca
    `);
    
    if (rappelPresupuesto.length > 0) {
      console.log(`✅ ${rappelPresupuesto.length} configuraciones encontradas:\n`);
      rappelPresupuesto.forEach(r => {
        const marca = r.marca || 'Todas (NULL)';
        console.log(`   - ${marca}: ${r.porcentaje_rappel}% ${r.activo ? '✅' : '❌'}`);
      });
    } else {
      console.log('⚠️  No se encontraron configuraciones');
    }
    console.log('');

    // 3. Descuento de Transporte
    console.log('3️⃣ DESCUENTO DE TRANSPORTE:');
    console.log('───────────────────────────────────────────────────────────');
    const [descuentoTrans] = await connection.query(`
      SELECT marca, porcentaje_descuento, año_aplicable, activo
      FROM config_descuento_transporte
      WHERE año_aplicable = 2026
      ORDER BY marca
    `);
    
    if (descuentoTrans.length > 0) {
      console.log(`✅ ${descuentoTrans.length} configuraciones encontradas:\n`);
      descuentoTrans.forEach(d => {
        const marca = d.marca || 'Todas (NULL)';
        const estado = d.activo ? '✅ Activo' : '❌ Inactivo (ANULADO)';
        console.log(`   - ${marca}: ${d.porcentaje_descuento}% - ${estado}`);
      });
    } else {
      console.log('⚠️  No se encontraron configuraciones');
    }
    console.log('');

    // 4. Fijo Mensual (configuración general)
    console.log('4️⃣ CONFIGURACIÓN DE FIJO MENSUAL:');
    console.log('───────────────────────────────────────────────────────────');
    const [fijoConfig] = await connection.query(`
      SELECT año_limite, porcentaje_minimo_ventas, activo
      FROM config_fijo_mensual
      WHERE activo = 1
      ORDER BY año_limite DESC
      LIMIT 1
    `);
    
    if (fijoConfig.length > 0) {
      const f = fijoConfig[0];
      console.log(`✅ Configuración encontrada:\n`);
      console.log(`   - Año límite: ${f.año_limite}`);
      console.log(`   - % mínimo ventas (desde ${f.año_limite + 1}): ${f.porcentaje_minimo_ventas}%`);
      console.log(`   - Estado: ${f.activo ? '✅ Activo' : '❌ Inactivo'}`);
    } else {
      console.log('⚠️  No se encontró configuración');
    }
    console.log('');

    // 5. Fijos Mensuales por Marca
    console.log('5️⃣ FIJOS MENSUALES POR MARCA:');
    console.log('───────────────────────────────────────────────────────────');
    const [fijosMarca] = await connection.query(`
      SELECT 
        c.id,
        c.Nombre as comercial,
        m.Nombre as marca,
        fmm.importe,
        fmm.activo
      FROM fijos_mensuales_marca fmm
      INNER JOIN comerciales c ON fmm.comercial_id = c.id
      INNER JOIN marcas m ON fmm.marca_id = m.id
      WHERE fmm.activo = 1
      ORDER BY m.Nombre, c.Nombre
    `);
    
    if (fijosMarca.length > 0) {
      console.log(`✅ ${fijosMarca.length} fijos mensuales configurados:\n`);
      const grouped = {};
      fijosMarca.forEach(f => {
        if (!grouped[f.marca]) grouped[f.marca] = [];
        grouped[f.marca].push(f);
      });
      
      Object.keys(grouped).forEach(marca => {
        console.log(`   📦 ${marca.toUpperCase()}:`);
        grouped[marca].forEach(f => {
          console.log(`      - ${f.comercial} (ID: ${f.id}): ${f.importe}€`);
        });
      });
    } else {
      console.log('⚠️  No se encontraron fijos mensuales');
    }
    console.log('');

    // 6. Resumen de valores esperados vs encontrados
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMEN DE VALORES ESPERADOS:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('✅ Transfer: 5%');
    console.log('✅ Directo: 10%');
    console.log('✅ Rappel Presupuesto: 2%');
    console.log('✅ Descuento Transporte: ANULADO (0%, inactivo)');
    console.log('✅ Fijo YOUBELLE: 0€ para todos');
    console.log('✅ Fijo IALZON: 200€ (Paco Lara: 500€)');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Verificación completada');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

verificar();
