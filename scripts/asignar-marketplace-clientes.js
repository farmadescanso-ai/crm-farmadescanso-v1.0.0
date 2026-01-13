/**
 * Script para asignar el tipo de cliente "Marketplace" a todos los clientes
 * cuyo email termina en "@notification.mirakl.net"
 * 
 * - Verifica si existe "Marketplace" en tipos_clientes, si no existe lo crea
 * - Busca todos los clientes con email que termine en "@notification.mirakl.net"
 * - Actualiza su Id_TipoCliente y TipoCliente a "Marketplace"
 * - Verifica las relaciones con otras tablas
 * 
 * Uso: node scripts/asignar-marketplace-clientes.js [--dry-run]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');

/**
 * Verifica si un campo está vacío
 */
function campoVacio(valor) {
  return !valor || 
         valor === null || 
         valor === undefined || 
         String(valor).trim() === '' || 
         String(valor).trim() === 'null' ||
         String(valor).trim() === 'undefined';
}

/**
 * Obtiene o crea el tipo de cliente "Marketplace"
 */
async function obtenerOCrearMarketplace() {
  try {
    // Buscar si ya existe "Marketplace"
    const tiposExistentes = await crm.query(
      'SELECT id, Tipo FROM tipos_clientes WHERE Tipo = ?',
      ['Marketplace']
    );
    
    if (tiposExistentes.length > 0) {
      const tipo = tiposExistentes[0];
      console.log(`✅ Tipo de cliente "Marketplace" ya existe (ID: ${tipo.id})`);
      return tipo.id;
    }
    
    // Si no existe, crearlo
    if (!DRY_RUN) {
      const resultado = await crm.query(
        'INSERT INTO tipos_clientes (Tipo) VALUES (?)',
        ['Marketplace']
      );
      const nuevoId = resultado.insertId;
      console.log(`✅ Tipo de cliente "Marketplace" creado (ID: ${nuevoId})`);
      return nuevoId;
    } else {
      // En modo simulación, obtener el siguiente ID disponible para mostrar
      const maxId = await crm.query('SELECT MAX(id) as maxId FROM tipos_clientes');
      const siguienteId = (maxId[0]?.maxId || 0) + 1;
      console.log(`📝 [SIMULACIÓN] Se crearía tipo de cliente "Marketplace" (ID simulado: ${siguienteId})`);
      return siguienteId; // Retornar ID simulado para que el resto del script funcione
    }
  } catch (error) {
    console.error(`❌ Error obteniendo/creando tipo "Marketplace": ${error.message}`);
    throw error;
  }
}

/**
 * Verifica las relaciones con otras tablas
 */
async function verificarRelaciones(tipoClienteId) {
  if (!tipoClienteId) return;
  
  try {
    console.log('\n🔍 Verificando relaciones con otras tablas...');
    
    // Verificar que la relación con clientes funciona
    const clientesConTipo = await crm.query(
      'SELECT COUNT(*) as total FROM clientes WHERE Id_TipoCliente = ?',
      [tipoClienteId]
    );
    console.log(`   ✅ ${clientesConTipo[0].total} clientes con tipo Marketplace`);
    
    // Verificar que no hay problemas de integridad referencial
    const clientesInvalidos = await crm.query(
      `SELECT COUNT(*) as total 
       FROM clientes c 
       LEFT JOIN tipos_clientes tc ON c.Id_TipoCliente = tc.id 
       WHERE c.Id_TipoCliente = ? AND tc.id IS NULL`,
      [tipoClienteId]
    );
    
    if (clientesInvalidos[0].total > 0) {
      console.warn(`   ⚠️  Advertencia: ${clientesInvalidos[0].total} clientes con Id_TipoCliente inválido`);
    } else {
      console.log(`   ✅ Todas las relaciones son válidas`);
    }
    
    // Verificar relaciones con pedidos (si existen)
    try {
      const pedidosConTipo = await crm.query(
        `SELECT COUNT(*) as total 
         FROM pedidos p
         INNER JOIN clientes c ON p.Id_Cliente = c.id
         WHERE c.Id_TipoCliente = ?`,
        [tipoClienteId]
      );
      console.log(`   ✅ ${pedidosConTipo[0].total} pedidos relacionados con clientes Marketplace`);
    } catch (error) {
      // La tabla pedidos puede no existir o tener estructura diferente
      console.log(`   ℹ️  No se pudo verificar pedidos: ${error.message}`);
    }
    
    // Verificar relaciones con visitas (si existen)
    try {
      const visitasConTipo = await crm.query(
        `SELECT COUNT(*) as total 
         FROM visitas v
         INNER JOIN clientes c ON v.Id_Cliente = c.id
         WHERE c.Id_TipoCliente = ?`,
        [tipoClienteId]
      );
      console.log(`   ✅ ${visitasConTipo[0].total} visitas relacionadas con clientes Marketplace`);
    } catch (error) {
      // La tabla visitas puede no existir o tener estructura diferente
      console.log(`   ℹ️  No se pudo verificar visitas: ${error.message}`);
    }
    
    // Verificar relaciones con clientes_cooperativas (si existen)
    try {
      const cooperativasConTipo = await crm.query(
        `SELECT COUNT(*) as total 
         FROM clientes_cooperativas cc
         INNER JOIN clientes c ON cc.Id_Cliente = c.id
         WHERE c.Id_TipoCliente = ?`,
        [tipoClienteId]
      );
      console.log(`   ✅ ${cooperativasConTipo[0].total} relaciones con cooperativas para clientes Marketplace`);
    } catch (error) {
      // La tabla clientes_cooperativas puede no existir o tener estructura diferente
      console.log(`   ℹ️  No se pudo verificar cooperativas: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`   ⚠️  Error verificando relaciones: ${error.message}`);
  }
}

/**
 * Función principal
 */
async function asignarMarketplaceAClientes() {
  try {
    console.log('🚀 Iniciando asignación de tipo "Marketplace" a clientes...\n');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // 1. Obtener o crear el tipo "Marketplace"
    console.log('📋 Paso 1: Verificando tipo de cliente "Marketplace"...');
    const tipoMarketplaceId = await obtenerOCrearMarketplace();
    if (!tipoMarketplaceId && !DRY_RUN) {
      throw new Error('No se pudo obtener o crear el tipo "Marketplace"');
    }
    console.log('');
    
    // 2. Buscar clientes con email que termine en "@notification.mirakl.net"
    console.log('📋 Paso 2: Buscando clientes con email "@notification.mirakl.net"...');
    const clientes = await crm.query(
      `SELECT id, Email, Nombre_Razon_Social, Id_TipoCliente, TipoCliente 
       FROM clientes 
       WHERE Email LIKE '%@notification.mirakl.net' 
       ORDER BY id`
    );
    
    console.log(`   ✅ Encontrados ${clientes.length} clientes con email "@notification.mirakl.net"\n`);
    
    if (clientes.length === 0) {
      console.log('⚠️  No hay clientes para actualizar');
      return;
    }
    
    // 3. Actualizar cada cliente
    console.log('📋 Paso 3: Actualizando clientes...\n');
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];
    
    for (const cliente of clientes) {
      try {
        const clienteId = cliente.id || cliente.Id;
        const nombre = cliente.Nombre_Razon_Social || 'Sin nombre';
        const email = cliente.Email || 'Sin email';
        const tipoActualId = cliente.Id_TipoCliente;
        const tipoActualNombre = cliente.TipoCliente;
        
        // Verificar si ya tiene el tipo correcto
        if (tipoActualId === tipoMarketplaceId && tipoActualNombre === 'Marketplace') {
          console.log(`   ⏭️  Cliente ID ${clienteId}: "${nombre.substring(0, 50)}" - Ya tiene tipo Marketplace`);
          sinCambios++;
          continue;
        }
        
        // Preparar actualización
        const actualizaciones = {
          Id_TipoCliente: tipoMarketplaceId,
          TipoCliente: 'Marketplace'
        };
        
        if (!DRY_RUN) {
          await crm.updateCliente(clienteId, actualizaciones);
          console.log(`   ✅ Cliente ID ${clienteId}: "${nombre.substring(0, 50)}" - Actualizado a Marketplace`);
          console.log(`      Email: ${email}`);
          if (tipoActualId) {
            console.log(`      Tipo anterior: ID ${tipoActualId} (${tipoActualNombre || 'N/A'})`);
          }
          actualizados++;
        } else {
          console.log(`   📝 [SIMULACIÓN] Cliente ID ${clienteId}: "${nombre.substring(0, 50)}"`);
          console.log(`      Email: ${email}`);
          console.log(`      Se actualizaría:`, JSON.stringify(actualizaciones, null, 2));
          actualizados++;
        }
        
      } catch (error) {
        errores.push({
          clienteId: cliente.id || cliente.Id,
          nombre: cliente.Nombre_Razon_Social || 'Sin nombre',
          email: cliente.Email,
          error: error.message
        });
        console.error(`   ❌ Error actualizando cliente ID ${cliente.id || cliente.Id}: ${error.message}`);
      }
    }
    
    // 4. Verificar relaciones
    if (!DRY_RUN && tipoMarketplaceId) {
      console.log('\n📋 Paso 4: Verificando relaciones...');
      await verificarRelaciones(tipoMarketplaceId);
    }
    
    // Resumen
    console.log('\n' + '='.repeat(80));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clientes encontrados: ${clientes.length}`);
    console.log(`   ✅ Clientes actualizados: ${actualizados}`);
    console.log(`   ⏭️  Clientes sin cambios: ${sinCambios}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    
    if (errores.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errores.forEach(e => {
        console.log(`   - Cliente ID ${e.clienteId}: ${e.nombre} (${e.email}) - ${e.error}`);
      });
    }
    
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar si es el script principal
if (require.main === module) {
  asignarMarketplaceAClientes();
}

module.exports = { asignarMarketplaceAClientes, obtenerOCrearMarketplace };
