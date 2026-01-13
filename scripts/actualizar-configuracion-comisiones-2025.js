// Script para actualizar configuraciones de comisiones para 2025
// Aplicar: Transfer 5%, Directo 10% (en lugar de 15%)
const mysql = require('mysql2/promise');
require('dotenv').config();

async function actualizarConfiguracion() {
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

    console.log('📝 Actualizando configuraciones de comisiones para 2025...\n');

    // Actualizar Directo de 15% a 10% para 2025
    await connection.query(`
      UPDATE config_comisiones_tipo_pedido
      SET porcentaje_comision = 10.00,
          descripcion = 'Comisión para pedidos tipo Directo/Normal - 10% sobre Base Imponible - Aplica a todas las marcas',
          actualizado_en = CURRENT_TIMESTAMP
      WHERE año_aplicable = 2025
      AND nombre_tipo_pedido = 'Directo'
    `);

    await connection.query(`
      UPDATE config_comisiones_tipo_pedido
      SET porcentaje_comision = 10.00,
          descripcion = 'Comisión para pedidos tipo Normal - 10% sobre Base Imponible - Aplica a todas las marcas',
          actualizado_en = CURRENT_TIMESTAMP
      WHERE año_aplicable = 2025
      AND nombre_tipo_pedido = 'Normal'
    `);

    console.log('✅ Configuraciones actualizadas:');
    console.log('   - Transfer: 5% (sin cambios)');
    console.log('   - Directo: 15% → 10% ✅');
    console.log('   - Normal: 15% → 10% ✅\n');

    // Verificar valores actuales
    const [configs] = await connection.query(`
      SELECT marca, nombre_tipo_pedido, porcentaje_comision
      FROM config_comisiones_tipo_pedido
      WHERE año_aplicable = 2025
      ORDER BY nombre_tipo_pedido, marca
    `);

    console.log('📊 Configuraciones actuales para 2025:');
    configs.forEach(c => {
      const marca = c.marca || 'Todas (NULL)';
      console.log(`   - ${c.nombre_tipo_pedido} (${marca}): ${c.porcentaje_comision}%`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

actualizarConfiguracion();
