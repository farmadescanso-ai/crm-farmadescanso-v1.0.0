/**
 * Script para revisar los registros de clientes con población "Totana"
 * 
 * Uso: node scripts/revisar-totana.js
 */

const crm = require('../config/mysql-crm');

async function main() {
  try {
    console.log('🔍 Revisando registros de Totana...\n');
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Buscar todos los clientes con población Totana (case insensitive)
    const sql = `
      SELECT 
        Id,
        Nombre_Razon_Social,
        Poblacion,
        Id_Provincia,
        CodigoPostal,
        Direccion
      FROM clientes
      WHERE LOWER(Poblacion) LIKE '%totana%'
      ORDER BY Id
    `;
    
    const clientes = await crm.query(sql);
    
    console.log(`📊 Total de clientes encontrados con población "Totana": ${clientes.length}\n`);
    
    if (clientes.length === 0) {
      console.log('⚠️  No se encontraron clientes con población "Totana"\n');
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
    
    // Verificar cada cliente
    let clientesConProblemas = 0;
    let clientesSinProvincia = 0;
    let clientesSinCP = 0;
    let clientesConProvinciaIncorrecta = 0;
    let clientesConCPIncorrecto = 0;
    
    console.log('='.repeat(80));
    console.log('DETALLE DE CLIENTES');
    console.log('='.repeat(80));
    
    for (const cliente of clientes) {
      const id = cliente.Id || cliente.id;
      const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre';
      const poblacion = cliente.Poblacion || 'N/A';
      const idProvincia = cliente.Id_Provincia || cliente.id_Provincia || null;
      const codigoPostal = cliente.CodigoPostal || cliente.codigoPostal || null;
      const direccion = cliente.Direccion || cliente.direccion || 'N/A';
      
      const nombreProvincia = idProvincia ? (provinciasMap[idProvincia] || `ID ${idProvincia}`) : 'N/A';
      
      console.log(`\n📝 Cliente ID ${id}: ${nombre}`);
      console.log(`   Población: "${poblacion}"`);
      console.log(`   Provincia: ${nombreProvincia} (ID: ${idProvincia || 'N/A'})`);
      console.log(`   Código Postal: ${codigoPostal || 'N/A'}`);
      console.log(`   Dirección: ${direccion}`);
      
      // Verificar problemas
      const problemas = [];
      
      // Totana debería estar en Murcia (ID: 30) con CP 30850
      const provinciaCorrecta = 30; // Murcia
      const cpCorrecto = '30850'; // Código postal de Totana
      
      if (!idProvincia) {
        problemas.push('❌ Sin Provincia');
        clientesSinProvincia++;
        clientesConProblemas++;
      } else if (idProvincia != provinciaCorrecta) {
        problemas.push(`❌ Provincia incorrecta: ${nombreProvincia} (debería ser Murcia)`);
        clientesConProvinciaIncorrecta++;
        clientesConProblemas++;
      }
      
      if (!codigoPostal) {
        problemas.push('❌ Sin Código Postal');
        clientesSinCP++;
        clientesConProblemas++;
      } else if (codigoPostal !== cpCorrecto) {
        problemas.push(`⚠️  CP diferente: ${codigoPostal} (esperado: ${cpCorrecto})`);
        clientesConCPIncorrecto++;
      }
      
      if (problemas.length > 0) {
        console.log(`   ⚠️  PROBLEMAS:`);
        problemas.forEach(p => console.log(`      ${p}`));
      } else {
        console.log(`   ✅ Datos correctos`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    console.log(`Total de clientes con población "Totana": ${clientes.length}`);
    console.log(`Clientes con problemas: ${clientesConProblemas}`);
    console.log(`  - Sin Provincia: ${clientesSinProvincia}`);
    console.log(`  - Provincia incorrecta: ${clientesConProvinciaIncorrecta}`);
    console.log(`  - Sin Código Postal: ${clientesSinCP}`);
    console.log(`  - CP diferente al esperado: ${clientesConCPIncorrecto}`);
    console.log(`Clientes correctos: ${clientes.length - clientesConProblemas}`);
    console.log('='.repeat(80));
    
    if (clientesConProblemas > 0) {
      console.log('\n💡 Recomendación: Ejecutar el script de verificación y corrección para Totana');
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
