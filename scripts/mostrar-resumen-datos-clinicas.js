/**
 * Script para mostrar un resumen completo de los datos de clínicas preparados
 */

const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');

try {
  const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
  
  console.log('='.repeat(100));
  console.log('📋 RESUMEN COMPLETO DE CLÍNICAS DENTALES PREPARADAS');
  console.log('='.repeat(100));
  
  // Estadísticas generales
  console.log(`\n📊 ESTADÍSTICAS GENERALES:`);
  console.log(`   Total de clínicas: ${datos.length}`);
  console.log(`   Tipo de cliente: ${datos[0]?.TipoCliente || 'N/A'}`);
  console.log(`   ID Tipo Cliente: ${datos[0]?.Id_TipoCliente || 'N/A'}`);
  console.log(`   Comercial asignado (Id_Cial): ${datos[0]?.Id_Cial || 'N/A'}`);
  
  // Estadísticas de campos
  const conDireccion = datos.filter(c => c.Direccion).length;
  const conTelefono = datos.filter(c => c.Movil).length;
  const conEmail = datos.filter(c => c.Email).length;
  const conCodigoPostal = datos.filter(c => c.CodigoPostal).length;
  const conPoblacion = datos.filter(c => c.Poblacion).length;
  const conProvincia = datos.filter(c => c.Id_Provincia).length;
  const conDNI = datos.filter(c => c.DNI_CIF && c.DNI_CIF.trim() !== '').length;
  
  console.log(`\n📈 ESTADÍSTICAS DE CAMPOS COMPLETADOS:`);
  console.log(`   ✅ Con dirección: ${conDireccion} (${(conDireccion/datos.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Con teléfono: ${conTelefono} (${(conTelefono/datos.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Con email: ${conEmail} (${(conEmail/datos.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Con código postal: ${conCodigoPostal} (${(conCodigoPostal/datos.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Con población: ${conPoblacion} (${(conPoblacion/datos.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Con provincia (Id_Provincia): ${conProvincia} (${(conProvincia/datos.length*100).toFixed(1)}%)`);
  console.log(`   ⚠️  Con DNI/CIF: ${conDNI} (${(conDNI/datos.length*100).toFixed(1)}%) - REQUERIDO`);
  
  // Clínicas con información completa
  const completas = datos.filter(c => 
    c.Direccion && 
    c.Movil && 
    c.CodigoPostal && 
    c.Poblacion
  ).length;
  
  console.log(`\n🎯 CLÍNICAS CON INFORMACIÓN COMPLETA (dirección + teléfono + CP + población):`);
  console.log(`   ${completas} (${(completas/datos.length*100).toFixed(1)}%)`);
  
  // Mostrar clínicas con información
  const clinicasConInfo = datos.filter(c => c.Direccion || c.Movil || c.Email);
  
  console.log(`\n📋 CLÍNICAS CON INFORMACIÓN ENCONTRADA (${clinicasConInfo.length}):`);
  console.log('-'.repeat(100));
  
  clinicasConInfo.slice(0, 30).forEach((cliente, index) => {
    console.log(`\n${(index + 1).toString().padStart(3, '0')}. ${cliente.Nombre_Razon_Social}`);
    if (cliente.Direccion) console.log(`    📍 Dirección: ${cliente.Direccion}`);
    if (cliente.Poblacion) console.log(`    🏘️  Población: ${cliente.Poblacion}`);
    if (cliente.CodigoPostal) console.log(`    📮 CP: ${cliente.CodigoPostal}`);
    if (cliente.Movil) console.log(`    📞 Teléfono: ${cliente.Movil}`);
    if (cliente.Email) console.log(`    ✉️  Email: ${cliente.Email}`);
    if (cliente.Id_Provincia) console.log(`    🗺️  Provincia ID: ${cliente.Id_Provincia}`);
  });
  
  if (clinicasConInfo.length > 30) {
    console.log(`\n... y ${clinicasConInfo.length - 30} clínicas más con información`);
  }
  
  // Clínicas sin información
  const clinicasSinInfo = datos.filter(c => !c.Direccion && !c.Movil && !c.Email);
  console.log(`\n⚠️  CLÍNICAS SIN INFORMACIÓN (${clinicasSinInfo.length}):`);
  if (clinicasSinInfo.length <= 20) {
    clinicasSinInfo.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.Nombre_Razon_Social}`);
    });
  } else {
    clinicasSinInfo.slice(0, 20).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.Nombre_Razon_Social}`);
    });
    console.log(`   ... y ${clinicasSinInfo.length - 20} más`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('💾 Archivo de datos:');
  console.log(`   ${archivoDatos}`);
  console.log('='.repeat(100));
  
  console.log('\n⚠️  NOTA IMPORTANTE:');
  console.log('   - El campo DNI_CIF es REQUERIDO en la base de datos');
  console.log('   - Actualmente está vacío para todas las clínicas');
  console.log('   - Se debe completar antes de grabar o usar un valor por defecto');
  console.log('   - Recomendación: Usar un valor temporal o dejar vacío si se permite');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
