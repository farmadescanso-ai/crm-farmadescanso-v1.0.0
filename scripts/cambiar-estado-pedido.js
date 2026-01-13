// Script para cambiar el estado del pedido P250002 a Pendiente
const mysql = require('mysql2/promise');
require('dotenv').config();

async function cambiarEstadoPedido() {
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

    // Buscar el pedido por número
    const numeroPedido = 'P250002';
    console.log(`🔍 Buscando pedido con número: ${numeroPedido}...`);
    
    const [pedidos] = await connection.query(
      'SELECT id, NumPedido, EstadoPedido FROM pedidos WHERE NumPedido = ?',
      [numeroPedido]
    );

    if (pedidos.length === 0) {
      console.log(`❌ No se encontró el pedido con número ${numeroPedido}`);
      return;
    }

    const pedido = pedidos[0];
    console.log(`✅ Pedido encontrado:`);
    console.log(`  ID: ${pedido.id}`);
    console.log(`  NumPedido: ${pedido.NumPedido}`);
    console.log(`  Estado actual: ${pedido.EstadoPedido || 'NULL'}\n`);

    // Actualizar el estado a "Pendiente"
    const nuevoEstado = 'Pendiente';
    console.log(`📝 Actualizando estado a: ${nuevoEstado}...`);
    
    await connection.query(
      'UPDATE pedidos SET EstadoPedido = ? WHERE id = ?',
      [nuevoEstado, pedido.id]
    );

    console.log(`✅ Estado actualizado correctamente\n`);

    // Verificar el cambio
    const [pedidoActualizado] = await connection.query(
      'SELECT id, NumPedido, EstadoPedido FROM pedidos WHERE id = ?',
      [pedido.id]
    );

    if (pedidoActualizado.length > 0) {
      console.log(`📋 Pedido actualizado:`);
      console.log(`  ID: ${pedidoActualizado[0].id}`);
      console.log(`  NumPedido: ${pedidoActualizado[0].NumPedido}`);
      console.log(`  EstadoPedido: ${pedidoActualizado[0].EstadoPedido}`);
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

cambiarEstadoPedido();

