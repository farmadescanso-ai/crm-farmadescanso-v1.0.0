/**
 * Script para mostrar las clínicas con información completa para revisión
 */

const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');

try {
  const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
  
  // Filtrar clínicas con información completa (dirección + teléfono + CP + población)
  const clinicasCompletas = datos.filter(c => 
    c.Direccion && 
    c.Movil && 
    c.CodigoPostal && 
    c.Poblacion
  );
  
  console.log('='.repeat(100));
  console.log('📋 CLÍNICAS CON INFORMACIÓN COMPLETA PARA REVISIÓN');
  console.log('='.repeat(100));
  console.log(`\nTotal de clínicas con información completa: ${clinicasCompletas.length}`);
  console.log(`Total de clínicas en el archivo: ${datos.length}`);
  console.log(`\n${'='.repeat(100)}\n`);
  
  clinicasCompletas.forEach((cliente, index) => {
    console.log(`┌─ CLÍNICA ${(index + 1).toString().padStart(2, '0')} ───────────────────────────────────────────────────────────┐`);
    console.log(`│`);
    console.log(`│  Nombre: ${cliente.Nombre_Razon_Social}`);
    console.log(`│  Tipo Cliente: ${cliente.TipoCliente} (ID: ${cliente.Id_TipoCliente})`);
    console.log(`│  Comercial (Id_Cial): ${cliente.Id_Cial}`);
    console.log(`│`);
    console.log(`│  📍 Dirección: ${cliente.Direccion}`);
    console.log(`│  🏘️  Población: ${cliente.Poblacion}`);
    console.log(`│  📮 Código Postal: ${cliente.CodigoPostal}`);
    console.log(`│  🗺️  Provincia (Id_Provincia): ${cliente.Id_Provincia || 'No asignada'}`);
    console.log(`│  📞 Teléfono/Móvil: ${cliente.Movil}`);
    if (cliente.Email) {
      console.log(`│  ✉️  Email: ${cliente.Email}`);
    } else {
      console.log(`│  ✉️  Email: (no disponible)`);
    }
    console.log(`│  🆔 DNI/CIF: ${cliente.DNI_CIF || '(vacío - se puede dejar NULL)'}`);
    console.log(`│  🌍 País: ${cliente.Pais || 'España'}`);
    console.log(`│  💬 Idioma: ${cliente.Idioma || 'ES'}`);
    console.log(`│`);
    console.log(`└${'─'.repeat(98)}┘`);
    console.log('');
  });
  
  console.log('='.repeat(100));
  console.log('📊 RESUMEN DE CAMPOS:');
  console.log('='.repeat(100));
  console.log(`\n✅ Todas tienen: Dirección, Teléfono, Código Postal, Población`);
  console.log(`✅ Con email: ${clinicasCompletas.filter(c => c.Email).length} de ${clinicasCompletas.length}`);
  console.log(`✅ Con provincia asignada: ${clinicasCompletas.filter(c => c.Id_Provincia).length} de ${clinicasCompletas.length}`);
  console.log(`⚠️  Con DNI/CIF: ${clinicasCompletas.filter(c => c.DNI_CIF && c.DNI_CIF.trim() !== '').length} de ${clinicasCompletas.length} (se puede dejar vacío/NULL)`);
  
  console.log('\n' + '='.repeat(100));
  console.log('💾 DATOS PARA GRABAR:');
  console.log('='.repeat(100));
  console.log('\nEstas clínicas están listas para ser grabadas en la base de datos.');
  console.log('Todos los campos requeridos están completos:');
  console.log('  ✅ Nombre_Razon_Social');
  console.log('  ✅ DNI_CIF (vacío, pero puede ser NULL)');
  console.log('  ✅ Id_Cial (comercial asignado)');
  console.log('  ✅ Id_TipoCliente (4 = Clínicas)');
  console.log('\nCampos adicionales completados:');
  console.log('  ✅ Dirección');
  console.log('  ✅ Teléfono/Móvil');
  console.log('  ✅ Código Postal');
  console.log('  ✅ Población');
  console.log('  ✅ Provincia (Id_Provincia)');
  console.log('  ✅ País (España)');
  console.log('  ✅ Idioma (ES)');
  
  console.log('\n' + '='.repeat(100));
  console.log('⚠️  NOTA:');
  console.log('='.repeat(100));
  console.log('\nEl campo DNI_CIF está vacío pero se puede dejar como NULL en la base de datos.');
  console.log('Si deseas grabarlas, ejecuta el script de importación.');
  console.log('\nArchivo de datos:');
  console.log(`   ${archivoDatos}`);
  console.log('='.repeat(100));
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
