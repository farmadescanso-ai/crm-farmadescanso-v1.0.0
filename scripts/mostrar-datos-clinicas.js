/**
 * Script para mostrar los datos de clínicas preparados de forma más clara
 */

const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');

try {
  const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
  
  console.log('='.repeat(100));
  console.log('📋 RESUMEN DE CLÍNICAS DENTALES PREPARADAS');
  console.log('='.repeat(100));
  console.log(`\nTotal de clínicas: ${datos.length}`);
  console.log(`Tipo de cliente: ${datos[0]?.TipoCliente || 'N/A'}`);
  console.log(`ID Tipo Cliente: ${datos[0]?.Id_TipoCliente || 'N/A'}`);
  console.log(`Comercial asignado (Id_Cial): ${datos[0]?.Id_Cial || 'N/A'}`);
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 DATOS COMPLETOS DE LAS PRIMERAS 20 CLÍNICAS:');
  console.log('='.repeat(100));
  
  datos.slice(0, 20).forEach((cliente, index) => {
    console.log(`\n${(index + 1).toString().padStart(3, '0')}. ${cliente.Nombre_Razon_Social}`);
    console.log(`    Tipo Cliente: ${cliente.TipoCliente} (ID: ${cliente.Id_TipoCliente})`);
    console.log(`    Comercial (Id_Cial): ${cliente.Id_Cial}`);
    console.log(`    Dirección: ${cliente.Direccion || '(pendiente)'}`);
    console.log(`    Población: ${cliente.Poblacion || '(pendiente)'}`);
    console.log(`    Código Postal: ${cliente.CodigoPostal || '(pendiente)'}`);
    console.log(`    Provincia (Id_Provincia): ${cliente.Id_Provincia || '(pendiente)'}`);
    console.log(`    Teléfono: ${cliente.Movil || '(pendiente)'}`);
    console.log(`    Email: ${cliente.Email || '(pendiente)'}`);
    console.log(`    DNI/CIF: ${cliente.DNI_CIF || '(pendiente - requerido)'}`);
    console.log(`    País: ${cliente.Pais || '(pendiente)'}`);
    console.log(`    Idioma: ${cliente.Idioma || '(pendiente)'}`);
  });
  
  console.log('\n' + '='.repeat(100));
  console.log('📈 ESTADÍSTICAS:');
  console.log('='.repeat(100));
  
  const conDireccion = datos.filter(c => c.Direccion).length;
  const conTelefono = datos.filter(c => c.Movil).length;
  const conEmail = datos.filter(c => c.Email).length;
  const conCodigoPostal = datos.filter(c => c.CodigoPostal).length;
  const conPoblacion = datos.filter(c => c.Poblacion).length;
  
  console.log(`\n✅ Con dirección: ${conDireccion} (${(conDireccion/datos.length*100).toFixed(1)}%)`);
  console.log(`✅ Con teléfono: ${conTelefono} (${(conTelefono/datos.length*100).toFixed(1)}%)`);
  console.log(`✅ Con email: ${conEmail} (${(conEmail/datos.length*100).toFixed(1)}%)`);
  console.log(`✅ Con código postal: ${conCodigoPostal} (${(conCodigoPostal/datos.length*100).toFixed(1)}%)`);
  console.log(`✅ Con población: ${conPoblacion} (${(conPoblacion/datos.length*100).toFixed(1)}%)`);
  
  console.log('\n' + '='.repeat(100));
  console.log('💾 Los datos completos están guardados en:');
  console.log(`   ${archivoDatos}`);
  console.log('='.repeat(100));
  
  console.log('\n⚠️  NOTA IMPORTANTE:');
  console.log('   - Los datos actuales solo incluyen el nombre de la clínica');
  console.log('   - Para completar información (dirección, teléfono, email, etc.),');
  console.log('     se requiere scraping web, lo cual para 197 clínicas sería muy lento');
  console.log('   - Recomendación: Revisar el archivo JSON y completar manualmente');
  console.log('     o usar herramientas especializadas de scraping');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
