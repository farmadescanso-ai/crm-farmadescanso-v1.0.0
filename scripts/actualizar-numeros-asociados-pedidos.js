const crm = require('../config/mysql-crm');

/**
 * Script para actualizar los números de asociado en todos los pedidos tipo Transfer
 * Busca en clientes_cooperativas y actualiza el pedido si es necesario
 */

// Mapeo de tipos de pedido a nombres de cooperativas
const TRANSFER_MAP = {
  'transfer hefame': 'HEFAME',
  'transfer alliance': 'ALLIANCE',
  'transfer cofares': 'COFARES'
};

/**
 * Obtiene el nombre de la cooperativa según el tipo de pedido
 */
function obtenerCooperativaPorTipoPedido(tipoPedido) {
  if (!tipoPedido) return null;
  
  const tipoLower = tipoPedido.toLowerCase();
  for (const [key, nombre] of Object.entries(TRANSFER_MAP)) {
    if (tipoLower.includes(key.replace('transfer ', ''))) {
      return nombre;
    }
  }
  return null;
}

/**
 * Actualiza un pedido con el número de asociado
 */
async function actualizarPedidoConAsociado(pedidoId, numeroAsociado, cooperativaNombre) {
  try {
    // Verificar si la tabla pedidos tiene las columnas numero_cooperativa y cooperativa_nombre
    // Si no las tiene, no podemos actualizarlas
    const updateSql = `
      UPDATE pedidos 
      SET numero_cooperativa = ?, 
          cooperativa_nombre = ? 
      WHERE id = ?
    `;
    
    await crm.query(updateSql, [numeroAsociado, cooperativaNombre, pedidoId]);
    return true;
  } catch (error) {
    // Si las columnas no existen, intentar sin actualizar
    if (error.message.includes('Unknown column')) {
      console.log(`  ⚠️  Las columnas numero_cooperativa/cooperativa_nombre no existen en la tabla pedidos`);
      return false;
    }
    throw error;
  }
}

/**
 * Procesa un pedido individual
 */
async function procesarPedido(pedido) {
  const pedidoId = pedido.id || pedido.Id;
  const numPedido = pedido.NumPedido || pedido.numero;
  const clienteId = pedido.Id_Cliente || pedido.Id_Cliente;
  const tipoPedidoId = pedido.Id_TipoPedido || pedido.Id_TipoPedido;
  
  // Obtener tipo de pedido
  let tipoPedido = null;
  if (tipoPedidoId) {
    const tipos = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [tipoPedidoId]);
    if (tipos.length > 0) {
      tipoPedido = tipos[0].Tipo;
    }
  }
  
  // Solo procesar si es tipo Transfer
  if (!tipoPedido || !tipoPedido.toLowerCase().includes('transfer')) {
    return { procesado: false, razon: 'No es tipo Transfer' };
  }
  
  const cooperativaNombre = obtenerCooperativaPorTipoPedido(tipoPedido);
  if (!cooperativaNombre) {
    return { procesado: false, razon: 'No se pudo determinar la cooperativa' };
  }
  
  // Verificar número de asociado actual en el pedido
  const numeroAsociadoActual = pedido.numero_cooperativa || pedido['numero_cooperativa'] || null;
  
  // Buscar número de asociado en clientes_cooperativas
  let numeroAsociadoEnBD = null;
  try {
    const relaciones = await crm.getCooperativasByClienteId(clienteId);
    if (relaciones && relaciones.length > 0) {
      const relacionEncontrada = relaciones.find(r => {
        const nombreRelacion = (r.Nombre || r.nombre || '').toUpperCase().trim();
        return nombreRelacion === cooperativaNombre.toUpperCase();
      });
      
      if (relacionEncontrada && relacionEncontrada.NumAsociado) {
        numeroAsociadoEnBD = relacionEncontrada.NumAsociado;
      }
    }
  } catch (error) {
    console.warn(`  ⚠️  Error obteniendo relaciones para cliente ${clienteId}: ${error.message}`);
    return { procesado: false, razon: `Error: ${error.message}` };
  }
  
  // Si hay número de asociado en BD y no coincide con el del pedido, actualizar
  if (numeroAsociadoEnBD && numeroAsociadoEnBD !== numeroAsociadoActual) {
    try {
      await actualizarPedidoConAsociado(pedidoId, numeroAsociadoEnBD, cooperativaNombre);
      return {
        procesado: true,
        actualizado: true,
        numeroAnterior: numeroAsociadoActual,
        numeroNuevo: numeroAsociadoEnBD
      };
    } catch (error) {
      return { procesado: false, razon: `Error actualizando: ${error.message}` };
    }
  } else if (numeroAsociadoEnBD && numeroAsociadoEnBD === numeroAsociadoActual) {
    return { procesado: true, actualizado: false, razon: 'Ya estaba actualizado' };
  } else if (!numeroAsociadoEnBD) {
    return { procesado: true, actualizado: false, razon: 'No hay número de asociado en BD' };
  }
  
  return { procesado: true, actualizado: false };
}

/**
 * Función principal
 */
async function actualizarTodos() {
  try {
    await crm.connect();
    
    console.log('🚀 Iniciando actualización de números de asociado en pedidos tipo Transfer\n');
    
    // Obtener todos los pedidos tipo Transfer
    console.log('📋 Obteniendo pedidos tipo Transfer...');
    const pedidosRaw = await crm.query(`
      SELECT p.*, tp.Tipo as TipoPedidoNombre
      FROM pedidos p
      INNER JOIN tipos_pedidos tp ON tp.id = p.Id_TipoPedido
      WHERE tp.Tipo LIKE '%Transfer%'
      ORDER BY p.id DESC
    `);
    
    console.log(`✅ Encontrados ${pedidosRaw.length} pedidos tipo Transfer\n`);
    
    const resultados = [];
    let actualizados = 0;
    let yaActualizados = 0;
    let sinAsociado = 0;
    let errores = 0;
    
    for (let i = 0; i < pedidosRaw.length; i++) {
      const pedido = pedidosRaw[i];
      const numPedido = pedido.NumPedido || pedido.numero || `ID:${pedido.id}`;
      
      console.log(`[${i + 1}/${pedidosRaw.length}] Procesando ${numPedido}...`);
      
      const resultado = await procesarPedido(pedido);
      resultados.push({
        pedido: numPedido,
        pedidoId: pedido.id,
        ...resultado
      });
      
      if (resultado.procesado) {
        if (resultado.actualizado) {
          actualizados++;
          console.log(`  ✅ Actualizado: ${resultado.numeroAnterior || 'NULL'} → ${resultado.numeroNuevo}`);
        } else if (resultado.razon === 'Ya estaba actualizado') {
          yaActualizados++;
          console.log(`  ℹ️  Ya estaba actualizado`);
        } else if (resultado.razon === 'No hay número de asociado en BD') {
          sinAsociado++;
          console.log(`  ⚠️  No hay número de asociado en BD`);
        }
      } else {
        errores++;
        console.log(`  ❌ ${resultado.razon || 'Error desconocido'}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    console.log(`✅ Actualizados: ${actualizados}`);
    console.log(`ℹ️  Ya actualizados: ${yaActualizados}`);
    console.log(`⚠️  Sin número de asociado: ${sinAsociado}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesados: ${pedidosRaw.length}`);
    
    if (actualizados > 0) {
      console.log('\n📝 Pedidos actualizados:');
      resultados.filter(r => r.actualizado).forEach(r => {
        console.log(`   - ${r.pedido}: ${r.numeroAnterior || 'NULL'} → ${r.numeroNuevo}`);
      });
    }
    
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error.stack);
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
actualizarTodos();
