/**
 * Script para importar las clínicas dentales con información completa a la base de datos
 */

const crm = require('../config/mysql-crm');
const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

/**
 * Inserta un cliente en la base de datos
 */
async function insertarCliente(cliente) {
  // Preparar campos y valores
  const campos = [];
  const valores = [];
  const placeholders = [];
  
  // Campos requeridos
  campos.push('`Id_Cial`');
  valores.push(cliente.Id_Cial || 1);
  placeholders.push('?');
  
  campos.push('`DNI_CIF`');
  valores.push(cliente.DNI_CIF || null); // Puede ser NULL
  placeholders.push('?');
  
  campos.push('`Nombre_Razon_Social`');
  valores.push(cliente.Nombre_Razon_Social);
  placeholders.push('?');
  
  // Campos opcionales
  if (cliente.Nombre_Cial) {
    campos.push('`Nombre_Cial`');
    valores.push(cliente.Nombre_Cial);
    placeholders.push('?');
  }
  
  if (cliente.Direccion) {
    campos.push('`Direccion`');
    valores.push(cliente.Direccion);
    placeholders.push('?');
  }
  
  if (cliente.Poblacion) {
    campos.push('`Poblacion`');
    valores.push(cliente.Poblacion);
    placeholders.push('?');
  }
  
  if (cliente.CodigoPostal) {
    campos.push('`CodigoPostal`');
    valores.push(cliente.CodigoPostal);
    placeholders.push('?');
  }
  
  if (cliente.Id_Provincia) {
    campos.push('`Id_Provincia`');
    valores.push(cliente.Id_Provincia);
    placeholders.push('?');
  }
  
  if (cliente.Movil) {
    campos.push('`Movil`');
    valores.push(cliente.Movil);
    placeholders.push('?');
  }
  
  if (cliente.Email) {
    campos.push('`Email`');
    valores.push(cliente.Email);
    placeholders.push('?');
  }
  
  if (cliente.Web) {
    campos.push('`Web`');
    valores.push(cliente.Web);
    placeholders.push('?');
  }
  
  if (cliente.TipoCliente) {
    campos.push('`TipoCliente`');
    valores.push(cliente.TipoCliente);
    placeholders.push('?');
  }
  
  if (cliente.Id_TipoCliente) {
    campos.push('`Id_TipoCliente`');
    valores.push(cliente.Id_TipoCliente);
    placeholders.push('?');
  }
  
  if (cliente.Pais) {
    campos.push('`Pais`');
    valores.push(cliente.Pais);
    placeholders.push('?');
  }
  
  if (cliente.CodPais) {
    campos.push('`CodPais`');
    valores.push(cliente.CodPais);
    placeholders.push('?');
  }
  
  if (cliente.Idioma) {
    campos.push('`Idioma`');
    valores.push(cliente.Idioma);
    placeholders.push('?');
  }
  
  const sql = `INSERT INTO \`clientes\` (${campos.join(', ')}) VALUES (${placeholders.join(', ')})`;
  await crm.query(sql, valores);
}

/**
 * Busca si un cliente ya existe (por nombre exacto o similar)
 */
async function buscarClienteExistente(nombre) {
  const nombreNormalizado = nombre.trim().toLowerCase();
  
  // Buscar por nombre exacto
  const resultados = await crm.query(
    'SELECT id, Nombre_Razon_Social FROM clientes WHERE LOWER(TRIM(Nombre_Razon_Social)) = ? LIMIT 1',
    [nombreNormalizado]
  );
  
  if (resultados && resultados.length > 0) {
    return resultados[0];
  }
  
  return null;
}

/**
 * Función principal
 */
async function importarClinicas() {
  try {
    console.log('🚀 Iniciando importación de clínicas dentales...\n');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    console.log(`📁 Archivo de datos: ${archivoDatos}\n`);
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Leer datos
    console.log('📖 Leyendo datos preparados...');
    const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
    console.log(`✅ ${datos.length} clínicas encontradas en el archivo\n`);
    
    // Filtrar clínicas con información completa
    const clinicasCompletas = datos.filter(c => 
      c.Direccion && 
      c.Movil && 
      c.CodigoPostal && 
      c.Poblacion &&
      c.Nombre_Razon_Social
    );
    
    console.log(`📊 Clínicas con información completa: ${clinicasCompletas.length}`);
    console.log(`📊 Clínicas sin información completa: ${datos.length - clinicasCompletas.length}\n`);
    
    if (clinicasCompletas.length === 0) {
      console.log('⚠️  No hay clínicas con información completa para importar');
      return;
    }
    
    // Mostrar resumen de clínicas a importar
    console.log('='.repeat(80));
    console.log('📋 RESUMEN DE CLÍNICAS A IMPORTAR:');
    console.log('='.repeat(80));
    console.log(`\nTotal: ${clinicasCompletas.length} clínicas`);
    console.log(`Tipo: ${clinicasCompletas[0]?.TipoCliente || 'Clínicas'}`);
    console.log(`Comercial asignado (Id_Cial): ${clinicasCompletas[0]?.Id_Cial || 1}`);
    console.log(`\nPrimeras 10 clínicas:`);
    clinicasCompletas.slice(0, 10).forEach((c, i) => {
      console.log(`${(i + 1).toString().padStart(2, '0')}. ${c.Nombre_Razon_Social}`);
      console.log(`    📍 ${c.Direccion}, ${c.Poblacion} (CP: ${c.CodigoPostal})`);
      console.log(`    📞 ${c.Movil}${c.Email ? ` | ✉️  ${c.Email}` : ''}`);
    });
    if (clinicasCompletas.length > 10) {
      console.log(`\n... y ${clinicasCompletas.length - 10} clínicas más`);
    }
    console.log('='.repeat(80));
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizarán cambios reales');
      console.log('   Para realizar la importación, ejecuta sin --dry-run\n');
      return;
    }
    
    // Confirmar antes de importar
    console.log('\n⚠️  ADVERTENCIA: Se van a insertar nuevas clínicas en la base de datos.');
    console.log('   Presiona Ctrl+C para cancelar, o espera 3 segundos para continuar...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Importar clínicas
    console.log('💾 Importando clínicas...\n');
    let importadas = 0;
    let duplicadas = 0;
    let errores = 0;
    const erroresList = [];
    
    for (let i = 0; i < clinicasCompletas.length; i++) {
      const cliente = clinicasCompletas[i];
      const numero = i + 1;
      const nombre = cliente.Nombre_Razon_Social;
      
      try {
        // Verificar si ya existe
        const existente = await buscarClienteExistente(nombre);
        
        if (existente) {
          console.log(`[${numero}/${clinicasCompletas.length}] ⏭️  Ya existe: ${nombre} (ID: ${existente.id})`);
          duplicadas++;
        } else {
          await insertarCliente(cliente);
          console.log(`[${numero}/${clinicasCompletas.length}] ✅ Importada: ${nombre}`);
          importadas++;
        }
        
        // Pequeña pausa cada 10 registros
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errores++;
        const errorMsg = `Error en clínica ${numero} (${nombre}): ${error.message}`;
        erroresList.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Importación completada');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clínicas importadas: ${importadas}`);
    console.log(`   ⏭️  Clínicas duplicadas (ya existían): ${duplicadas}`);
    console.log(`   ❌ Errores: ${errores}`);
    
    if (errores > 0) {
      console.log('\n❌ Errores encontrados:');
      erroresList.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (erroresList.length > 10) {
        console.log(`   ... y ${erroresList.length - 10} errores más`);
      }
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  importarClinicas()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { importarClinicas };
