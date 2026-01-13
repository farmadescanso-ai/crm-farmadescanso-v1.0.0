// Script para verificar la columna de estado en la tabla pedidos
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarColumna() {
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

    // Obtener estructura de la tabla pedidos
    const [columnas] = await connection.query('DESCRIBE pedidos');
    
    console.log('📋 Columnas de la tabla pedidos relacionadas con estado:');
    console.log('═══════════════════════════════════════════════════════════');
    const estadoCols = columnas.filter(c => 
      c.Field.toLowerCase().includes('estado') || 
      c.Field.toLowerCase() === 'estado'
    );
    
    if (estadoCols.length > 0) {
      estadoCols.forEach(c => {
        console.log(`  ${c.Field} (${c.Type}) - Null: ${c.Null}, Default: ${c.Default || 'NULL'}`);
      });
    } else {
      console.log('  ⚠️  No se encontraron columnas con "estado" en el nombre');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar un pedido de ejemplo
    const [pedidos] = await connection.query('SELECT id, EstadoPedido FROM pedidos LIMIT 1');
    
    if (pedidos.length > 0) {
      console.log('📋 Ejemplo de pedido (ID: ' + pedidos[0].id + '):');
      console.log('  EstadoPedido:', pedidos[0].EstadoPedido || 'NULL');
    } else {
      console.log('⚠️  No hay pedidos en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

verificarColumna();

