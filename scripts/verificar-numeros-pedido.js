// Script para verificar números de pedido existentes
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarNumerosPedido() {
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

    // Obtener últimos 10 pedidos
    const [pedidos] = await connection.query(
      'SELECT Id, NumPedido, FechaPedido FROM pedidos ORDER BY Id DESC LIMIT 10'
    );

    console.log('📋 Últimos 10 pedidos:');
    console.log('═══════════════════════════════════════════════════════════');
    pedidos.forEach(p => {
      console.log(`  ID: ${p.Id}, NumPedido: ${p.NumPedido || 'N/A'}, Fecha: ${p.FechaPedido || 'N/A'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar pedidos con P25
    const [pedidosP25] = await connection.query(
      'SELECT NumPedido FROM pedidos WHERE NumPedido LIKE "P25%" ORDER BY NumPedido DESC LIMIT 5'
    );

    console.log('📋 Últimos 5 pedidos con P25:');
    pedidosP25.forEach(p => {
      console.log(`  ${p.NumPedido}`);
    });
    console.log('');

    // Verificar si existe P25250002 (el incorrecto)
    const [pedidoIncorrecto] = await connection.query(
      'SELECT Id, NumPedido FROM pedidos WHERE NumPedido = "P25250002"'
    );

    if (pedidoIncorrecto.length > 0) {
      console.log('⚠️  Pedido con número incorrecto encontrado:');
      console.log(`  ID: ${pedidoIncorrecto[0].Id}, NumPedido: ${pedidoIncorrecto[0].NumPedido}`);
    } else {
      console.log('✅ No se encontró el pedido P25250002');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

verificarNumerosPedido();

