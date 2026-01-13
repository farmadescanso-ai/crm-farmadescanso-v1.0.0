/**
 * Script para eliminar completamente el cliente con ID = 700
 * y todos sus registros relacionados en todas las tablas
 * 
 * IMPORTANTE: Este script realiza una eliminación permanente (hard delete)
 * Asegúrate de tener un backup antes de ejecutar este script
 * 
 * Uso: node scripts/eliminar-cliente-700.js
 */

const crm = require('../config/mysql-crm');

const CLIENTE_ID = 700;

async function eliminarClienteCompleto() {
  try {
    console.log('🚀 Iniciando eliminación del cliente ID =', CLIENTE_ID);
    console.log('⚠️  ADVERTENCIA: Esta operación es PERMANENTE e IRREVERSIBLE\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Verificar que el cliente existe
    console.log('🔍 Verificando que el cliente existe...');
    const cliente = await crm.getClienteById(CLIENTE_ID);
    
    if (!cliente) {
      console.log(`❌ El cliente con ID ${CLIENTE_ID} no existe en la base de datos`);
      await crm.disconnect();
      process.exit(1);
    }
    
    console.log('✅ Cliente encontrado:');
    console.log(`   ID: ${cliente.id || cliente.Id}`);
    console.log(`   Nombre: ${cliente.Nombre_Razon_Social || cliente.Nombre_Razon_Social}`);
    console.log(`   DNI/CIF: ${cliente.DNI_CIF || 'N/A'}`);
    console.log(`   Email: ${cliente.Email || 'N/A'}\n`);
    
    // Contar registros relacionados antes de eliminar
    console.log('📊 Contando registros relacionados...');
    
    const pedidos = await crm.query('SELECT COUNT(*) as total FROM `Pedidos` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
    const pedidosCount = pedidos[0]?.total || 0;
    
    const pedidosArticulos = await crm.query(`
      SELECT COUNT(*) as total 
      FROM \`Pedidos_Articulos\` pa
      INNER JOIN \`Pedidos\` p ON pa.\`Id_NumPedido\` = p.\`id\`
      WHERE p.\`Id_Cliente\` = ?
    `, [CLIENTE_ID]);
    const pedidosArticulosCount = pedidosArticulos[0]?.total || 0;
    
    const visitas = await crm.query('SELECT COUNT(*) as total FROM `Visitas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
    const visitasCount = visitas[0]?.total || 0;
    
    const clientesCooperativas = await crm.query('SELECT COUNT(*) as total FROM `Clientes_Cooperativas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
    const clientesCooperativasCount = clientesCooperativas[0]?.total || 0;
    
    console.log(`   Pedidos: ${pedidosCount}`);
    console.log(`   Pedidos_Articulos: ${pedidosArticulosCount}`);
    console.log(`   Visitas: ${visitasCount}`);
    console.log(`   Clientes_Cooperativas: ${clientesCooperativasCount}\n`);
    
    // Confirmar eliminación
    console.log('⚠️  Se eliminarán los siguientes registros:');
    console.log(`   - ${pedidosArticulosCount} registros de Pedidos_Articulos`);
    console.log(`   - ${pedidosCount} registros de Pedidos`);
    console.log(`   - ${visitasCount} registros de Visitas`);
    console.log(`   - ${clientesCooperativasCount} registros de Clientes_Cooperativas`);
    console.log(`   - 1 registro de Clientes\n`);
    
    // Obtener una conexión directa para las transacciones
    const connection = await crm.pool.getConnection();
    
    try {
      // Iniciar transacción
      console.log('🔄 Iniciando transacción...');
      await connection.query('START TRANSACTION');
      
      // 1. Eliminar Pedidos_Articulos relacionados a través de Pedidos del cliente
      if (pedidosArticulosCount > 0) {
        console.log('🗑️  Eliminando Pedidos_Articulos...');
        const [result1] = await connection.query(`
          DELETE pa FROM \`Pedidos_Articulos\` pa
          INNER JOIN \`Pedidos\` p ON pa.\`Id_NumPedido\` = p.\`id\`
          WHERE p.\`Id_Cliente\` = ?
        `, [CLIENTE_ID]);
        console.log(`   ✅ ${result1.affectedRows} registros eliminados`);
      }
      
      // 2. Eliminar Pedidos del cliente
      if (pedidosCount > 0) {
        console.log('🗑️  Eliminando Pedidos...');
        const [result2] = await connection.query('DELETE FROM `Pedidos` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
        console.log(`   ✅ ${result2.affectedRows} registros eliminados`);
      }
      
      // 3. Eliminar Visitas del cliente
      if (visitasCount > 0) {
        console.log('🗑️  Eliminando Visitas...');
        const [result3] = await connection.query('DELETE FROM `Visitas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
        console.log(`   ✅ ${result3.affectedRows} registros eliminados`);
      }
      
      // 4. Eliminar relaciones Clientes_Cooperativas del cliente
      if (clientesCooperativasCount > 0) {
        console.log('🗑️  Eliminando Clientes_Cooperativas...');
        const [result4] = await connection.query('DELETE FROM `Clientes_Cooperativas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
        console.log(`   ✅ ${result4.affectedRows} registros eliminados`);
      }
      
      // 5. Finalmente, eliminar el cliente
      console.log('🗑️  Eliminando Cliente...');
      const [result5] = await connection.query('DELETE FROM `Clientes` WHERE `id` = ?', [CLIENTE_ID]);
      console.log(`   ✅ ${result5.affectedRows} registro eliminado\n`);
      
      // Confirmar transacción
      await connection.query('COMMIT');
      console.log('✅ Transacción confirmada\n');
      
      // Liberar conexión
      connection.release();
      
      // Verificar que el cliente fue eliminado
      console.log('🔍 Verificando eliminación...');
      const clienteVerificado = await crm.getClienteById(CLIENTE_ID);
      
      if (clienteVerificado) {
        console.log('❌ ERROR: El cliente aún existe después de la eliminación');
        process.exit(1);
      }
      
      console.log('✅ Cliente eliminado correctamente');
      
      // Verificar que no quedan registros relacionados
      const pedidosRestantes = await crm.query('SELECT COUNT(*) as total FROM `Pedidos` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
      const visitasRestantes = await crm.query('SELECT COUNT(*) as total FROM `Visitas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
      const clientesCooperativasRestantes = await crm.query('SELECT COUNT(*) as total FROM `Clientes_Cooperativas` WHERE `Id_Cliente` = ?', [CLIENTE_ID]);
      
      const totalRestantes = (pedidosRestantes[0]?.total || 0) + 
                            (visitasRestantes[0]?.total || 0) + 
                            (clientesCooperativasRestantes[0]?.total || 0);
      
      if (totalRestantes > 0) {
        console.log(`⚠️  ADVERTENCIA: Quedan ${totalRestantes} registros relacionados`);
      } else {
        console.log('✅ No quedan registros relacionados');
      }
      
      console.log('\n✅ Eliminación completada exitosamente');
      
    } catch (error) {
      // Revertir transacción en caso de error
      console.error('❌ Error durante la eliminación:', error.message);
      await connection.query('ROLLBACK');
      console.log('🔄 Transacción revertida');
      connection.release();
      throw error;
    }
    
    // Desconectar
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar el script
eliminarClienteCompleto();
