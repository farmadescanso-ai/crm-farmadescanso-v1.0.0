/**
 * Script para eliminar clientes con población "No Disponible"
 * Estos son registros inválidos que no tienen información útil
 * 
 * Uso: node scripts/eliminar-clientes-no-disponible.js [--confirmar]
 */

const crm = require('../config/mysql-crm');

const CONFIRMAR = process.argv.includes('--confirmar') || process.argv.includes('--confirm');

async function main() {
  try {
    console.log('🔍 Buscando clientes con población "No Disponible"...\n');
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Buscar clientes con población "No Disponible"
    const sql = `
      SELECT 
        Id,
        Nombre_Razon_Social,
        Poblacion,
        Id_Provincia,
        CodigoPostal,
        Direccion
      FROM clientes
      WHERE Poblacion = 'No Disponible'
         OR Poblacion LIKE '%No Disponible%'
      ORDER BY Id
    `;
    
    const clientes = await crm.query(sql);
    
    console.log(`📊 Total de clientes encontrados: ${clientes.length}\n`);
    
    if (clientes.length === 0) {
      console.log('✅ No se encontraron clientes con población "No Disponible"\n');
      await crm.disconnect();
      process.exit(0);
    }
    
    console.log('='.repeat(80));
    console.log('CLIENTES A ELIMINAR');
    console.log('='.repeat(80));
    
    for (const cliente of clientes) {
      const id = cliente.Id || cliente.id;
      const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre';
      const poblacion = cliente.Poblacion || 'N/A';
      const direccion = cliente.Direccion || cliente.direccion || 'N/A';
      
      console.log(`\n📝 Cliente ID ${id}`);
      console.log(`   Nombre: ${nombre}`);
      console.log(`   Población: "${poblacion}"`);
      console.log(`   Dirección: ${direccion}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  ADVERTENCIA');
    console.log('='.repeat(80));
    console.log(`Se eliminarán ${clientes.length} cliente(s) de la base de datos.`);
    console.log('Esta acción NO se puede deshacer.\n');
    
    if (!CONFIRMAR) {
      console.log('⚠️  MODO SIMULACIÓN: No se realizarán cambios en la BD');
      console.log('   Ejecuta con --confirmar para eliminar los registros:');
      console.log('   node scripts/eliminar-clientes-no-disponible.js --confirmar\n');
      await crm.disconnect();
      process.exit(0);
    }
    
    console.log('✅ MODO CONFIRMADO: Se eliminarán los registros\n');
    
    // Verificar relaciones antes de eliminar
    let eliminados = 0;
    let errores = 0;
    
    for (const cliente of clientes) {
      const id = cliente.Id || cliente.id;
      const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre';
      
      try {
        // Verificar si tiene pedidos asociados
        const pedidosSql = `SELECT COUNT(*) as total FROM pedidos WHERE Id_Cliente = ?`;
        const pedidos = await crm.query(pedidosSql, [id]);
        const totalPedidos = pedidos[0]?.total || 0;
        
        if (totalPedidos > 0) {
          console.log(`⚠️  Cliente ID ${id} tiene ${totalPedidos} pedido(s) asociado(s). No se eliminará.`);
          errores++;
          continue;
        }
        
        // Eliminar el cliente
        const deleteSql = `DELETE FROM clientes WHERE Id = ?`;
        await crm.query(deleteSql, [id]);
        console.log(`✅ Cliente ID ${id} eliminado: ${nombre}`);
        eliminados++;
      } catch (error) {
        console.error(`❌ Error eliminando cliente ID ${id}: ${error.message}`);
        errores++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    console.log(`Total de clientes encontrados: ${clientes.length}`);
    console.log(`Clientes eliminados: ${eliminados}`);
    console.log(`Errores: ${errores}`);
    console.log('='.repeat(80));
    
    if (eliminados > 0) {
      console.log('\n✅ Proceso completado exitosamente\n');
    } else {
      console.log('\n⚠️  No se eliminó ningún cliente\n');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await crm.disconnect();
    process.exit(1);
  }
}

// Ejecutar
main();
