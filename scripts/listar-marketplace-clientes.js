/**
 * Script para listar clientes de tipo Marketplace
 * 
 * Uso: node scripts/listar-marketplace-clientes.js [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 10;

/**
 * Función principal
 */
async function listarMarketplaceClientes() {
  try {
    console.log('🚀 Listando clientes de tipo Marketplace...\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Buscar tipo Marketplace
    const tiposMarketplace = await crm.query(
      'SELECT id, Tipo FROM tipos_clientes WHERE Tipo = ?',
      ['Marketplace']
    );
    
    if (tiposMarketplace.length === 0) {
      console.log('⚠️  No existe el tipo de cliente "Marketplace" en la base de datos.');
      console.log('   Ejecuta primero: node scripts/asignar-marketplace-clientes.js\n');
      process.exit(0);
    }
    
    const tipoMarketplaceId = tiposMarketplace[0].id;
    console.log(`✅ Tipo "Marketplace" encontrado (ID: ${tipoMarketplaceId})\n`);
    
    // Buscar clientes Marketplace
    const clientes = await crm.query(
      `SELECT 
        c.id,
        c.Nombre_Razon_Social,
        c.Email,
        c.DNI_CIF,
        c.Direccion,
        c.Poblacion,
        c.CodigoPostal,
        c.Movil,
        c.Telefono,
        c.Id_TipoCliente,
        c.TipoCliente,
        c.OK_KO,
        cial.Nombre as ComercialNombre
       FROM clientes c
       LEFT JOIN comerciales cial ON c.Id_Cial = cial.id
       WHERE c.Id_TipoCliente = ?
       ORDER BY c.id
       LIMIT ?`,
      [tipoMarketplaceId, LIMIT]
    );
    
    console.log(`📊 Total de clientes Marketplace encontrados: ${clientes.length}\n`);
    
    if (clientes.length === 0) {
      console.log('⚠️  No hay clientes de tipo Marketplace.');
      console.log('   Ejecuta: node scripts/asignar-marketplace-clientes.js\n');
      process.exit(0);
    }
    
    // Mostrar lista
    console.log('='.repeat(100));
    console.log('LISTA DE CLIENTES MARKETPLACE');
    console.log('='.repeat(100));
    console.log('');
    
    clientes.forEach((cliente, index) => {
      const estado = cliente.OK_KO === 1 || cliente.OK_KO === '1' || cliente.OK_KO === 'OK' ? '✅ Activo' : '❌ Inactivo';
      
      console.log(`${index + 1}. ID: ${cliente.id}`);
      console.log(`   Nombre: ${cliente.Nombre_Razon_Social || 'Sin nombre'}`);
      console.log(`   Email: ${cliente.Email || 'Sin email'}`);
      console.log(`   DNI/CIF: ${cliente.DNI_CIF || 'Sin DNI/CIF'}`);
      console.log(`   Dirección: ${cliente.Direccion || 'Sin dirección'}`);
      console.log(`   Población: ${cliente.Poblacion || 'Sin población'}`);
      console.log(`   Código Postal: ${cliente.CodigoPostal || 'Sin CP'}`);
      console.log(`   Móvil: ${cliente.Movil || 'Sin móvil'}`);
      console.log(`   Teléfono: ${cliente.Telefono || 'Sin teléfono'}`);
      console.log(`   Comercial: ${cliente.ComercialNombre || 'Sin asignar'}`);
      console.log(`   Estado: ${estado}`);
      console.log(`   Tipo Cliente: ${cliente.TipoCliente || 'Marketplace'} (ID: ${cliente.Id_TipoCliente})`);
      console.log('');
    });
    
    // Obtener total
    const total = await crm.query(
      'SELECT COUNT(*) as total FROM clientes WHERE Id_TipoCliente = ?',
      [tipoMarketplaceId]
    );
    
    console.log('='.repeat(100));
    console.log(`📊 Total de clientes Marketplace en la base de datos: ${total[0].total}`);
    console.log(`📋 Mostrados: ${clientes.length}`);
    console.log('='.repeat(100));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es el script principal
if (require.main === module) {
  listarMarketplaceClientes();
}

module.exports = { listarMarketplaceClientes };
