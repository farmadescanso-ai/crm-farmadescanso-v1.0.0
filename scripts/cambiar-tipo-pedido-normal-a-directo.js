const crm = require('../config/mysql-crm');

/**
 * Script para cambiar el tipo de pedido "Normal" por "Directo"
 * Actualiza tanto la tabla tipos_pedidos como los pedidos que usan "Normal"
 */

async function cambiarNormalADirecto() {
  let connection = null;
  
  try {
    await crm.connect();
    connection = await crm.pool.getConnection();
    
    console.log('🔄 Iniciando cambio de tipo de pedido "Normal" a "Directo"...\n');
    
    // Iniciar transacción
    await connection.query('START TRANSACTION');
    console.log('✅ Transacción iniciada\n');
    
    // 1. Verificar si existe el tipo "Normal"
    console.log('🔍 Verificando tipos de pedido existentes...');
    const [tiposExistentes] = await connection.query('SELECT * FROM tipos_pedidos');
    console.log(`📋 Tipos de pedido encontrados: ${tiposExistentes.length}`);
    tiposExistentes.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Tipo: ${tipo.Tipo}`);
    });
    console.log('');
    
    // 2. Buscar el tipo "Normal"
    const [tipoNormal] = await connection.query('SELECT * FROM tipos_pedidos WHERE Tipo = ? LIMIT 1', ['Normal']);
    
    if (tipoNormal.length === 0) {
      console.log('⚠️  No se encontró el tipo de pedido "Normal"');
      
      // Verificar si ya existe "Directo"
      const [tipoDirecto] = await connection.query('SELECT * FROM tipos_pedidos WHERE Tipo = ? LIMIT 1', ['Directo']);
      if (tipoDirecto.length > 0) {
        console.log('✅ El tipo "Directo" ya existe');
      } else {
        console.log('⚠️  El tipo "Directo" tampoco existe');
      }
      
      await connection.query('ROLLBACK');
      await crm.disconnect();
      return;
    }
    
    const tipoNormalId = tipoNormal[0].id;
    console.log(`✅ Tipo "Normal" encontrado: ID ${tipoNormalId}\n`);
    
    // 3. Verificar si ya existe "Directo"
    const [tipoDirecto] = await connection.query('SELECT * FROM tipos_pedidos WHERE Tipo = ? LIMIT 1', ['Directo']);
    let tipoDirectoId = null;
    
    if (tipoDirecto.length > 0) {
      tipoDirectoId = tipoDirecto[0].id;
      console.log(`✅ Tipo "Directo" ya existe: ID ${tipoDirectoId}`);
      console.log(`   Opción: Actualizar pedidos que usan "Normal" para que usen "Directo" (ID ${tipoDirectoId})\n`);
    } else {
      console.log(`ℹ️  El tipo "Directo" no existe, se actualizará "Normal" a "Directo"\n`);
    }
    
    // 4. Contar pedidos que usan "Normal"
    const [pedidosConNormal] = await connection.query(
      'SELECT COUNT(*) as count FROM pedidos WHERE Id_TipoPedido = ?',
      [tipoNormalId]
    );
    const cantidadPedidos = pedidosConNormal[0].count;
    console.log(`📊 Pedidos que usan tipo "Normal": ${cantidadPedidos}\n`);
    
    if (tipoDirectoId) {
      // Si "Directo" ya existe, actualizar los pedidos para que usen "Directo"
      console.log('📝 Actualizando pedidos de "Normal" a "Directo"...');
      const [resultadoPedidos] = await connection.query(
        'UPDATE pedidos SET Id_TipoPedido = ? WHERE Id_TipoPedido = ?',
        [tipoDirectoId, tipoNormalId]
      );
      console.log(`✅ ${resultadoPedidos.affectedRows} pedidos actualizados\n`);
      
      // Eliminar el tipo "Normal" ya que ya no se usa
      console.log('🗑️  Eliminando tipo "Normal"...');
      await connection.query('DELETE FROM tipos_pedidos WHERE id = ?', [tipoNormalId]);
      console.log('✅ Tipo "Normal" eliminado\n');
    } else {
      // Si "Directo" no existe, simplemente renombrar "Normal" a "Directo"
      console.log('📝 Renombrando tipo "Normal" a "Directo"...');
      await connection.query(
        'UPDATE tipos_pedidos SET Tipo = ? WHERE id = ?',
        ['Directo', tipoNormalId]
      );
      console.log('✅ Tipo renombrado correctamente\n');
    }
    
    // 5. Verificar resultado
    console.log('🔍 Verificando resultado...');
    const [tiposFinales] = await connection.query('SELECT * FROM tipos_pedidos ORDER BY Tipo ASC');
    console.log(`📋 Tipos de pedido finales: ${tiposFinales.length}`);
    tiposFinales.forEach(tipo => {
      console.log(`   - ID: ${tipo.id}, Tipo: ${tipo.Tipo}`);
    });
    console.log('');
    
    // Confirmar transacción
    await connection.query('COMMIT');
    console.log('✅ Transacción confirmada\n');
    
    // Resumen
    console.log('='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    if (tipoDirectoId) {
      console.log(`✅ ${cantidadPedidos} pedidos actualizados de "Normal" a "Directo"`);
      console.log(`✅ Tipo "Normal" eliminado`);
    } else {
      console.log(`✅ Tipo "Normal" renombrado a "Directo"`);
      console.log(`✅ ${cantidadPedidos} pedidos ahora usan "Directo"`);
    }
    console.log('='.repeat(80));
    
    connection.release();
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    
    if (connection) {
      try {
        await connection.query('ROLLBACK');
        console.log('🔄 Transacción revertida');
        connection.release();
      } catch (rollbackError) {
        console.error('⚠️  Error al hacer rollback:', rollbackError.message);
        connection.release();
      }
    }
    
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
cambiarNormalADirecto();
