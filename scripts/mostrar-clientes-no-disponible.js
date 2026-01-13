/**
 * Script para mostrar los clientes con población "No Disponible"
 */

const crm = require('../config/mysql-crm');

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
        Nombre_Cial,
        Poblacion,
        Id_Provincia,
        CodigoPostal,
        Direccion,
        Telefono,
        Email,
        DNI_CIF
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
    
    // Obtener información de provincias
    const provincias = await crm.getProvincias();
    const provinciasMap = {};
    provincias.forEach(p => {
      const id = p.Id || p.id;
      provinciasMap[id] = p.Nombre || p.nombre;
    });
    
    console.log('='.repeat(80));
    console.log('DETALLE DE CLIENTES');
    console.log('='.repeat(80));
    
    for (const cliente of clientes) {
      const id = cliente.Id || cliente.id;
      const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre';
      const nombreCial = cliente.Nombre_Cial || cliente.Nombre_Cial || 'N/A';
      const poblacion = cliente.Poblacion || 'N/A';
      const idProvincia = cliente.Id_Provincia || cliente.id_Provincia || null;
      const codigoPostal = cliente.CodigoPostal || cliente.codigoPostal || null;
      const direccion = cliente.Direccion || cliente.direccion || 'N/A';
      const telefono = cliente.Telefono || cliente.telefono || 'N/A';
      const email = cliente.Email || cliente.email || 'N/A';
      const dniCif = cliente.DNI_CIF || cliente.dni_cif || 'N/A';
      
      const nombreProvincia = idProvincia ? (provinciasMap[idProvincia] || `ID ${idProvincia}`) : 'N/A';
      
      console.log(`\n📝 Cliente ID ${id}`);
      console.log(`   Nombre/Razón Social: ${nombre}`);
      console.log(`   Nombre Comercial: ${nombreCial}`);
      console.log(`   DNI/CIF: ${dniCif}`);
      console.log(`   Población: "${poblacion}"`);
      console.log(`   Provincia: ${nombreProvincia} (ID: ${idProvincia || 'N/A'})`);
      console.log(`   Código Postal: ${codigoPostal || 'N/A'}`);
      console.log(`   Dirección: ${direccion}`);
      console.log(`   Teléfono: ${telefono}`);
      console.log(`   Email: ${email}`);
      
      // Verificar problemas
      const problemas = [];
      if (!idProvincia) problemas.push('❌ Sin Provincia');
      if (!codigoPostal || codigoPostal === '') problemas.push('❌ Sin Código Postal');
      
      if (problemas.length > 0) {
        console.log(`   ⚠️  PROBLEMAS:`);
        problemas.forEach(p => console.log(`      ${p}`));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    console.log(`Total de clientes: ${clientes.length}`);
    console.log('='.repeat(80));
    console.log('\n💡 Estos clientes requieren revisión manual para determinar su población real.');
    
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
