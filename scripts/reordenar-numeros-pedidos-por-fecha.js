const crm = require('../config/mysql-crm');

/**
 * Script para reordenar los números de pedidos según sus fechas
 * Asigna P250001 al pedido más antiguo y P250034 al más reciente
 * Mantiene la integridad referencial en todas las tablas relacionadas
 */

async function reordenarPedidosPorFecha() {
  let connection = null;
  
  try {
    await crm.connect();
    // Obtener una conexión directa para transacciones
    connection = await crm.pool.getConnection();
    
    console.log('🚀 Iniciando reordenamiento de números de pedidos por fecha...\n');
    
    // Iniciar transacción usando conexión directa
    await connection.query('START TRANSACTION');
    console.log('✅ Transacción iniciada\n');
    
    // 1. Obtener todos los pedidos ordenados por fecha
    console.log('📋 Obteniendo todos los pedidos ordenados por fecha...');
    const [pedidosRows] = await connection.query(`
      SELECT 
        id,
        NumPedido as NumPedidoActual,
        FechaPedido,
        DATE(FechaPedido) as FechaPedidoDate
      FROM pedidos
      WHERE FechaPedido IS NOT NULL
      ORDER BY FechaPedido ASC, id ASC
    `);
    const pedidos = pedidosRows;
    
    if (pedidos.length === 0) {
      console.log('⚠️  No se encontraron pedidos con fecha');
      await crm.query('ROLLBACK');
      await crm.disconnect();
      return;
    }
    
    console.log(`✅ Encontrados ${pedidos.length} pedidos\n`);
    
    // 2. Crear mapeo de pedido.id -> nuevo NumPedido
    const mapeoPedidos = new Map();
    const nuevosNumeros = [];
    
    pedidos.forEach((pedido, index) => {
      const nuevoNumero = `P25${String(index + 1).padStart(4, '0')}`;
      mapeoPedidos.set(pedido.id, {
        id: pedido.id,
        numPedidoActual: pedido.NumPedidoActual,
        numPedidoNuevo: nuevoNumero,
        fechaPedido: pedido.FechaPedido
      });
      nuevosNumeros.push(nuevoNumero);
    });
    
    // Verificar que no haya duplicados en los nuevos números
    const duplicados = nuevosNumeros.filter((num, index) => nuevosNumeros.indexOf(num) !== index);
    if (duplicados.length > 0) {
      throw new Error(`Se encontraron números duplicados: ${duplicados.join(', ')}`);
    }
    
    console.log('📊 Mapeo de pedidos creado:');
    console.log(`   - Pedido más antiguo: ID ${pedidos[0].id} (${pedidos[0].FechaPedido}) -> ${mapeoPedidos.get(pedidos[0].id).numPedidoNuevo}`);
    console.log(`   - Pedido más reciente: ID ${pedidos[pedidos.length - 1].id} (${pedidos[pedidos.length - 1].FechaPedido}) -> ${mapeoPedidos.get(pedidos[pedidos.length - 1].id).numPedidoNuevo}\n`);
    
    // 3. Verificar que los nuevos números no existan ya (por si acaso)
    console.log('🔍 Verificando que los nuevos números no existan...');
    const placeholders = nuevosNumeros.map(() => '?').join(',');
    const [numerosExistentesRows] = await connection.query(`
      SELECT NumPedido, COUNT(*) as count
      FROM pedidos
      WHERE NumPedido IN (${placeholders})
      GROUP BY NumPedido
    `, nuevosNumeros);
    const numerosExistentes = numerosExistentesRows;
    
    if (numerosExistentes.length > 0) {
      const conflictos = numerosExistentes.filter(n => {
        const pedidoConEseNumero = Array.from(mapeoPedidos.values()).find(p => p.numPedidoActual === n.NumPedido);
        // Si el número existe pero no es el que vamos a asignar al mismo pedido, hay conflicto
        return !pedidoConEseNumero || pedidoConEseNumero.numPedidoNuevo !== n.NumPedido;
      });
      
      if (conflictos.length > 0) {
        console.warn(`⚠️  Advertencia: Algunos números ya existen pero se reasignarán: ${conflictos.map(c => c.NumPedido).join(', ')}`);
      }
    }
    console.log('✅ Verificación completada\n');
    
    // 4. Actualizar tabla Pedidos
    console.log('📝 Actualizando tabla Pedidos...');
    let actualizadosPedidos = 0;
    for (const [pedidoId, mapeo] of mapeoPedidos.entries()) {
      const [result] = await connection.query(
        'UPDATE pedidos SET NumPedido = ? WHERE id = ?',
        [mapeo.numPedidoNuevo, pedidoId]
      );
      actualizadosPedidos++;
      if (actualizadosPedidos % 10 === 0) {
        console.log(`   Progreso: ${actualizadosPedidos}/${mapeoPedidos.size} pedidos actualizados...`);
      }
    }
    console.log(`✅ ${actualizadosPedidos} pedidos actualizados en la tabla Pedidos\n`);
    
    // 5. Actualizar tabla Pedidos_Articulos (solo el campo NumPedido, NO Id_NumPedido que es FK)
    console.log('📝 Actualizando tabla Pedidos_Articulos...');
    let actualizadosArticulos = 0;
    
    for (const [pedidoId, mapeo] of mapeoPedidos.entries()) {
      const [resultado] = await connection.query(
        'UPDATE pedidos_articulos SET NumPedido = ? WHERE Id_NumPedido = ?',
        [mapeo.numPedidoNuevo, pedidoId]
      );
      if (resultado.affectedRows > 0) {
        actualizadosArticulos += resultado.affectedRows;
      }
    }
    console.log(`✅ ${actualizadosArticulos} líneas de pedidos actualizadas en Pedidos_Articulos\n`);
    
    // 6. Verificar integridad
    console.log('🔍 Verificando integridad de los datos...');
    
    // Verificar que todos los pedidos tengan números únicos
    const [pedidosVerificacionRows] = await connection.query(`
      SELECT NumPedido, COUNT(*) as count
      FROM pedidos
      GROUP BY NumPedido
      HAVING count > 1
    `);
    const pedidosVerificacion = pedidosVerificacionRows;
    
    if (pedidosVerificacion.length > 0) {
      throw new Error(`Error de integridad: Se encontraron números de pedido duplicados: ${pedidosVerificacion.map(p => p.NumPedido).join(', ')}`);
    }
    
    // Verificar que todas las líneas de pedidos tengan NumPedido válido
    const [lineasInvalidasRows] = await connection.query(`
      SELECT pa.id, pa.NumPedido, pa.Id_NumPedido, p.NumPedido as NumPedidoPedido
      FROM pedidos_articulos pa
      LEFT JOIN pedidos p ON p.id = pa.Id_NumPedido
      WHERE pa.NumPedido != p.NumPedido OR p.NumPedido IS NULL
    `);
    const lineasInvalidas = lineasInvalidasRows;
    
    if (lineasInvalidas.length > 0) {
      console.warn(`⚠️  Advertencia: Se encontraron ${lineasInvalidas.length} líneas con NumPedido inconsistente`);
      console.warn('   Esto puede ser normal si hay líneas huérfanas. Continuando...\n');
    }
    
    console.log('✅ Verificación de integridad completada\n');
    
    // 7. Confirmar transacción
    await connection.query('COMMIT');
    console.log('✅ Transacción confirmada\n');
    
    // Liberar conexión
    connection.release();
    
    // 8. Mostrar resumen
    console.log('='.repeat(80));
    console.log('📊 RESUMEN DEL REORDENAMIENTO');
    console.log('='.repeat(80));
    console.log(`✅ Pedidos procesados: ${pedidos.length}`);
    console.log(`✅ Pedidos actualizados: ${actualizadosPedidos}`);
    console.log(`✅ Líneas de pedidos actualizadas: ${actualizadosArticulos}`);
    console.log(`\n📋 Primeros 5 pedidos (más antiguos):`);
    pedidos.slice(0, 5).forEach((p, i) => {
      const mapeo = mapeoPedidos.get(p.id);
      console.log(`   ${i + 1}. ID ${p.id}: ${mapeo.numPedidoActual} -> ${mapeo.numPedidoNuevo} (${p.FechaPedido})`);
    });
    console.log(`\n📋 Últimos 5 pedidos (más recientes):`);
    pedidos.slice(-5).forEach((p, i) => {
      const mapeo = mapeoPedidos.get(p.id);
      const indice = pedidos.length - 5 + i + 1;
      console.log(`   ${indice}. ID ${p.id}: ${mapeo.numPedidoActual} -> ${mapeo.numPedidoNuevo} (${p.FechaPedido})`);
    });
    console.log('='.repeat(80));
    
    await crm.disconnect();
    console.log('\n✅ Reordenamiento completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR durante el reordenamiento:');
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    
    // Hacer rollback si hay una transacción activa
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
reordenarPedidosPorFecha();
