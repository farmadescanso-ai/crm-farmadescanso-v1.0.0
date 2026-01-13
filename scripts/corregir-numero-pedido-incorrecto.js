// Script para corregir el número de pedido incorrecto P25250002 a P250002
const mysql = require('mysql2/promise');
require('dotenv').config();

async function corregirNumeroPedido() {
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
    console.log('✅ Conectado a la base de datos\n');

    // Buscar el pedido con número incorrecto
    const [pedidoIncorrecto] = await connection.query(
      'SELECT Id, NumPedido FROM pedidos WHERE NumPedido = "P25250002"'
    );

    if (pedidoIncorrecto.length === 0) {
      console.log('✅ No se encontró el pedido P25250002. Puede que ya esté corregido.');
      return;
    }

    const pedidoId = pedidoIncorrecto[0].Id;
    const numeroIncorrecto = pedidoIncorrecto[0].NumPedido;
    const numeroCorrecto = 'P250002';

    console.log(`📋 Pedido encontrado:`);
    console.log(`  ID: ${pedidoId}`);
    console.log(`  Número actual (incorrecto): ${numeroIncorrecto}`);
    console.log(`  Número correcto: ${numeroCorrecto}\n`);

    // Verificar que P250002 no exista ya
    const [pedidoExistente] = await connection.query(
      'SELECT Id FROM pedidos WHERE NumPedido = ?',
      [numeroCorrecto]
    );

    if (pedidoExistente.length > 0) {
      console.log(`⚠️  El número ${numeroCorrecto} ya existe (ID: ${pedidoExistente[0].Id})`);
      console.log('   No se puede corregir automáticamente. Revisa manualmente.');
      return;
    }

    // Actualizar el número de pedido en la tabla pedidos
    console.log('📝 Actualizando número de pedido en tabla pedidos...');
    await connection.query(
      'UPDATE pedidos SET NumPedido = ? WHERE Id = ?',
      [numeroCorrecto, pedidoId]
    );
    console.log('✅ Número de pedido actualizado en tabla pedidos\n');

    // Actualizar el número de pedido en la tabla pedidos_articulos (si existe)
    console.log('📝 Verificando tabla pedidos_articulos...');
    const [lineas] = await connection.query(
      'SELECT COUNT(*) as count FROM pedidos_articulos WHERE NumPedido = ?',
      [numeroIncorrecto]
    );

    if (lineas[0].count > 0) {
      console.log(`   Encontradas ${lineas[0].count} líneas con el número incorrecto`);
      await connection.query(
        'UPDATE pedidos_articulos SET NumPedido = ? WHERE NumPedido = ?',
        [numeroCorrecto, numeroIncorrecto]
      );
      console.log('✅ Números de pedido actualizados en tabla pedidos_articulos\n');
    } else {
      console.log('   No se encontraron líneas con el número incorrecto\n');
    }

    // Verificar que la corrección se aplicó correctamente
    const [pedidoVerificado] = await connection.query(
      'SELECT Id, NumPedido FROM pedidos WHERE Id = ?',
      [pedidoId]
    );

    if (pedidoVerificado[0].NumPedido === numeroCorrecto) {
      console.log('✅ Corrección verificada correctamente:');
      console.log(`   ID: ${pedidoVerificado[0].Id}, NumPedido: ${pedidoVerificado[0].NumPedido}`);
    } else {
      console.log('⚠️  La corrección no se aplicó correctamente');
    }

    console.log('\n✅ Proceso completado');

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

corregirNumeroPedido();

