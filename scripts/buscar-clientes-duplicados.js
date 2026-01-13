/**
 * Script para buscar clientes duplicados en la base de datos
 * 
 * Busca duplicados por:
 * - DNI/CIF (más confiable)
 * - Nombre/Razón Social exacto
 * - Nombre + Dirección
 * - Nombre + Teléfono
 * - Nombre + Email
 * 
 * Uso: node scripts/buscar-clientes-duplicados.js
 */

const crm = require('../config/mysql-crm');

/**
 * Normaliza un texto para comparación
 */
function normalizar(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    .trim()
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🔍 Buscando clientes duplicados...\n');
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todos los clientes
    const clientes = await crm.getClientes();
    console.log(`📊 Total de clientes en la BD: ${clientes.length}\n`);
    
    // Agrupar por diferentes criterios
    const duplicadosPorDNI = {};
    const duplicadosPorNombre = {};
    const duplicadosPorNombreDireccion = {};
    const duplicadosPorNombreTelefono = {};
    const duplicadosPorNombreEmail = {};
    
    // Procesar cada cliente
    for (const cliente of clientes) {
      const id = cliente.Id || cliente.id;
      const dniCif = normalizar(cliente.DNI_CIF || cliente.dni_cif || '');
      const nombre = normalizar(cliente.Nombre_Razon_Social || cliente.Nombre || '');
      const direccion = normalizar(cliente.Direccion || cliente.direccion || '');
      const telefono = normalizar(cliente.Telefono || cliente.telefono || '');
      const email = normalizar(cliente.Email || cliente.email || '');
      
      // 1. Duplicados por DNI/CIF (si tiene)
      if (dniCif && dniCif.length > 3) {
        if (!duplicadosPorDNI[dniCif]) {
          duplicadosPorDNI[dniCif] = [];
        }
        duplicadosPorDNI[dniCif].push({
          id,
          dniCif: cliente.DNI_CIF || cliente.dni_cif,
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre || '',
          direccion: cliente.Direccion || cliente.direccion || '',
          telefono: cliente.Telefono || cliente.telefono || '',
          email: cliente.Email || cliente.email || ''
        });
      }
      
      // 2. Duplicados por Nombre exacto
      if (nombre && nombre.length > 3) {
        if (!duplicadosPorNombre[nombre]) {
          duplicadosPorNombre[nombre] = [];
        }
        duplicadosPorNombre[nombre].push({
          id,
          dniCif: cliente.DNI_CIF || cliente.dni_cif || '',
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre || '',
          direccion: cliente.Direccion || cliente.direccion || '',
          telefono: cliente.Telefono || cliente.telefono || '',
          email: cliente.Email || cliente.email || ''
        });
      }
      
      // 3. Duplicados por Nombre + Dirección
      if (nombre && direccion && nombre.length > 3 && direccion.length > 5) {
        const clave = `${nombre}|${direccion}`;
        if (!duplicadosPorNombreDireccion[clave]) {
          duplicadosPorNombreDireccion[clave] = [];
        }
        duplicadosPorNombreDireccion[clave].push({
          id,
          dniCif: cliente.DNI_CIF || cliente.dni_cif || '',
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre || '',
          direccion: cliente.Direccion || cliente.direccion || '',
          telefono: cliente.Telefono || cliente.telefono || '',
          email: cliente.Email || cliente.email || ''
        });
      }
      
      // 4. Duplicados por Nombre + Teléfono
      if (nombre && telefono && nombre.length > 3 && telefono.length > 5) {
        const clave = `${nombre}|${telefono}`;
        if (!duplicadosPorNombreTelefono[clave]) {
          duplicadosPorNombreTelefono[clave] = [];
        }
        duplicadosPorNombreTelefono[clave].push({
          id,
          dniCif: cliente.DNI_CIF || cliente.dni_cif || '',
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre || '',
          direccion: cliente.Direccion || cliente.direccion || '',
          telefono: cliente.Telefono || cliente.telefono || '',
          email: cliente.Email || cliente.email || ''
        });
      }
      
      // 5. Duplicados por Nombre + Email
      if (nombre && email && nombre.length > 3 && email.length > 5) {
        const clave = `${nombre}|${email}`;
        if (!duplicadosPorNombreEmail[clave]) {
          duplicadosPorNombreEmail[clave] = [];
        }
        duplicadosPorNombreEmail[clave].push({
          id,
          dniCif: cliente.DNI_CIF || cliente.dni_cif || '',
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre || '',
          direccion: cliente.Direccion || cliente.direccion || '',
          telefono: cliente.Telefono || cliente.telefono || '',
          email: cliente.Email || cliente.email || ''
        });
      }
    }
    
    // Filtrar solo los que tienen más de 1 cliente
    const duplicadosDNI = Object.entries(duplicadosPorDNI)
      .filter(([_, clientes]) => clientes.length > 1)
      .map(([dni, clientes]) => ({ dni, clientes }));
    
    const duplicadosNombre = Object.entries(duplicadosPorNombre)
      .filter(([_, clientes]) => clientes.length > 1)
      .map(([nombre, clientes]) => ({ nombre, clientes }));
    
    const duplicadosNombreDireccion = Object.entries(duplicadosPorNombreDireccion)
      .filter(([_, clientes]) => clientes.length > 1)
      .map(([clave, clientes]) => ({ clave, clientes }));
    
    const duplicadosNombreTelefono = Object.entries(duplicadosPorNombreTelefono)
      .filter(([_, clientes]) => clientes.length > 1)
      .map(([clave, clientes]) => ({ clave, clientes }));
    
    const duplicadosNombreEmail = Object.entries(duplicadosPorNombreEmail)
      .filter(([_, clientes]) => clientes.length > 1)
      .map(([clave, clientes]) => ({ clave, clientes }));
    
    // Mostrar resultados
    console.log('='.repeat(80));
    console.log('📊 RESUMEN DE DUPLICADOS');
    console.log('='.repeat(80));
    console.log(`Duplicados por DNI/CIF: ${duplicadosDNI.length} grupos (${duplicadosDNI.reduce((sum, d) => sum + d.clientes.length, 0)} clientes)`);
    console.log(`Duplicados por Nombre: ${duplicadosNombre.length} grupos (${duplicadosNombre.reduce((sum, d) => sum + d.clientes.length, 0)} clientes)`);
    console.log(`Duplicados por Nombre + Dirección: ${duplicadosNombreDireccion.length} grupos (${duplicadosNombreDireccion.reduce((sum, d) => sum + d.clientes.length, 0)} clientes)`);
    console.log(`Duplicados por Nombre + Teléfono: ${duplicadosNombreTelefono.length} grupos (${duplicadosNombreTelefono.reduce((sum, d) => sum + d.clientes.length, 0)} clientes)`);
    console.log(`Duplicados por Nombre + Email: ${duplicadosNombreEmail.length} grupos (${duplicadosNombreEmail.reduce((sum, d) => sum + d.clientes.length, 0)} clientes)`);
    console.log('='.repeat(80));
    
    // Mostrar duplicados por DNI/CIF (más críticos)
    if (duplicadosDNI.length > 0) {
      console.log('\n🔴 DUPLICADOS POR DNI/CIF (CRÍTICOS)');
      console.log('='.repeat(80));
      
      for (const grupo of duplicadosDNI.slice(0, 20)) {
        console.log(`\n📋 DNI/CIF: ${grupo.clientes[0].dniCif} (${grupo.clientes.length} registros)`);
        grupo.clientes.forEach((c, idx) => {
          console.log(`   ${idx + 1}. ID ${c.id}: ${c.nombre}`);
          if (c.direccion) console.log(`      Dirección: ${c.direccion}`);
          if (c.telefono) console.log(`      Teléfono: ${c.telefono}`);
          if (c.email) console.log(`      Email: ${c.email}`);
        });
      }
      
      if (duplicadosDNI.length > 20) {
        console.log(`\n... y ${duplicadosDNI.length - 20} grupos más`);
      }
    }
    
    // Mostrar duplicados por Nombre + Dirección (también importantes)
    if (duplicadosNombreDireccion.length > 0) {
      console.log('\n🟡 DUPLICADOS POR NOMBRE + DIRECCIÓN');
      console.log('='.repeat(80));
      
      for (const grupo of duplicadosNombreDireccion.slice(0, 15)) {
        const primerCliente = grupo.clientes[0];
        console.log(`\n📋 "${primerCliente.nombre}" - "${primerCliente.direccion}" (${grupo.clientes.length} registros)`);
        grupo.clientes.forEach((c, idx) => {
          console.log(`   ${idx + 1}. ID ${c.id}`);
          if (c.dniCif) console.log(`      DNI/CIF: ${c.dniCif}`);
          if (c.telefono) console.log(`      Teléfono: ${c.telefono}`);
          if (c.email) console.log(`      Email: ${c.email}`);
        });
      }
      
      if (duplicadosNombreDireccion.length > 15) {
        console.log(`\n... y ${duplicadosNombreDireccion.length - 15} grupos más`);
      }
    }
    
    // Mostrar duplicados por Nombre + Teléfono
    if (duplicadosNombreTelefono.length > 0) {
      console.log('\n🟡 DUPLICADOS POR NOMBRE + TELÉFONO');
      console.log('='.repeat(80));
      
      for (const grupo of duplicadosNombreTelefono.slice(0, 10)) {
        const primerCliente = grupo.clientes[0];
        console.log(`\n📋 "${primerCliente.nombre}" - "${primerCliente.telefono}" (${grupo.clientes.length} registros)`);
        grupo.clientes.forEach((c, idx) => {
          console.log(`   ${idx + 1}. ID ${c.id}`);
          if (c.dniCif) console.log(`      DNI/CIF: ${c.dniCif}`);
          if (c.direccion) console.log(`      Dirección: ${c.direccion}`);
        });
      }
      
      if (duplicadosNombreTelefono.length > 10) {
        console.log(`\n... y ${duplicadosNombreTelefono.length - 10} grupos más`);
      }
    }
    
    // Mostrar algunos duplicados solo por nombre (menos críticos, pero muchos)
    if (duplicadosNombre.length > 0 && duplicadosNombre.length <= 50) {
      console.log('\n🟢 DUPLICADOS SOLO POR NOMBRE (menos críticos)');
      console.log('='.repeat(80));
      console.log(`Total: ${duplicadosNombre.length} grupos`);
      console.log('(Mostrando solo los primeros 5 para referencia)');
      
      for (const grupo of duplicadosNombre.slice(0, 5)) {
        const primerCliente = grupo.clientes[0];
        console.log(`\n📋 "${primerCliente.nombre}" (${grupo.clientes.length} registros)`);
        grupo.clientes.forEach((c, idx) => {
          console.log(`   ${idx + 1}. ID ${c.id} - ${c.direccion || 'Sin dirección'}`);
        });
      }
    } else if (duplicadosNombre.length > 50) {
      console.log('\n🟢 DUPLICADOS SOLO POR NOMBRE');
      console.log('='.repeat(80));
      console.log(`Total: ${duplicadosNombre.length} grupos (demasiados para mostrar)`);
      console.log(`Total de clientes afectados: ${duplicadosNombre.reduce((sum, d) => sum + d.clientes.length, 0)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 NOTAS');
    console.log('='.repeat(80));
    console.log('• Los duplicados por DNI/CIF son los más críticos y deben revisarse primero');
    console.log('• Los duplicados por Nombre + Dirección también son importantes');
    console.log('• Los duplicados solo por Nombre pueden ser falsos positivos');
    console.log('• Revisar manualmente cada caso antes de eliminar o fusionar');
    console.log('='.repeat(80));
    
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
