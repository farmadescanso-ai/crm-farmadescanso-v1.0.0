/**
 * Script para revisar clientes que tienen Población pero les falta Provincia o Código Postal
 * 
 * Uso: node scripts/revisar-poblaciones-sin-datos.js
 */

const crm = require('../config/mysql-crm');

async function main() {
  try {
    console.log('🔍 Revisando clientes con Población pero sin Provincia o Código Postal...\n');
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Buscar todos los clientes con población pero sin provincia o sin CP
    const sql = `
      SELECT 
        Id,
        Nombre_Razon_Social,
        Poblacion,
        Id_Provincia,
        CodigoPostal,
        Direccion
      FROM clientes
      WHERE Poblacion IS NOT NULL 
        AND Poblacion != ''
        AND (Id_Provincia IS NULL 
             OR CodigoPostal IS NULL 
             OR CodigoPostal = '')
      ORDER BY Poblacion, Id
    `;
    
    const clientes = await crm.query(sql);
    
    console.log(`📊 Total de clientes con población pero sin Provincia o CP: ${clientes.length}\n`);
    
    if (clientes.length === 0) {
      console.log('✅ Todos los clientes tienen Provincia y Código Postal completos\n');
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
    
    // Agrupar por población
    const poblacionesMap = {};
    
    for (const cliente of clientes) {
      const poblacion = (cliente.Poblacion || '').trim();
      if (!poblacion) continue;
      
      if (!poblacionesMap[poblacion]) {
        poblacionesMap[poblacion] = {
          nombre: poblacion,
          clientes: [],
          sinProvincia: 0,
          sinCP: 0,
          sinAmbos: 0
        };
      }
      
      const idProvincia = cliente.Id_Provincia || cliente.id_Provincia || null;
      const codigoPostal = cliente.CodigoPostal || cliente.codigoPostal || null;
      
      const sinProvincia = !idProvincia;
      const sinCP = !codigoPostal || codigoPostal === '';
      const sinAmbos = sinProvincia && sinCP;
      
      if (sinProvincia) poblacionesMap[poblacion].sinProvincia++;
      if (sinCP) poblacionesMap[poblacion].sinCP++;
      if (sinAmbos) poblacionesMap[poblacion].sinAmbos++;
      
      poblacionesMap[poblacion].clientes.push({
        id: cliente.Id || cliente.id,
        nombre: cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre',
        idProvincia,
        codigoPostal,
        direccion: cliente.Direccion || cliente.direccion || 'N/A'
      });
    }
    
    // Ordenar poblaciones por cantidad de clientes afectados
    const poblacionesArray = Object.values(poblacionesMap)
      .sort((a, b) => b.clientes.length - a.clientes.length);
    
    console.log('='.repeat(80));
    console.log('RESUMEN POR POBLACIÓN');
    console.log('='.repeat(80));
    console.log(`Total de poblaciones afectadas: ${poblacionesArray.length}\n`);
    
    // Mostrar las 20 poblaciones con más clientes afectados
    const topPoblaciones = poblacionesArray.slice(0, 20);
    
    for (const poblacion of topPoblaciones) {
      console.log(`\n📍 Población: "${poblacion.nombre}"`);
      console.log(`   Total de clientes: ${poblacion.clientes.length}`);
      console.log(`   - Sin Provincia: ${poblacion.sinProvincia}`);
      console.log(`   - Sin Código Postal: ${poblacion.sinCP}`);
      console.log(`   - Sin ambos: ${poblacion.sinAmbos}`);
      
      // Mostrar algunos ejemplos
      const ejemplos = poblacion.clientes.slice(0, 3);
      if (ejemplos.length > 0) {
        console.log(`   Ejemplos:`);
        ejemplos.forEach(c => {
          const provincia = c.idProvincia ? provinciasMap[c.idProvincia] || `ID ${c.idProvincia}` : 'N/A';
          const cp = c.codigoPostal || 'N/A';
          console.log(`     - ID ${c.id}: ${c.nombre.substring(0, 40)}... (Prov: ${provincia}, CP: ${cp})`);
        });
      }
    }
    
    if (poblacionesArray.length > 20) {
      console.log(`\n... y ${poblacionesArray.length - 20} poblaciones más`);
    }
    
    // Resumen general
    let totalSinProvincia = 0;
    let totalSinCP = 0;
    let totalSinAmbos = 0;
    
    poblacionesArray.forEach(p => {
      totalSinProvincia += p.sinProvincia;
      totalSinCP += p.sinCP;
      totalSinAmbos += p.sinAmbos;
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN GENERAL');
    console.log('='.repeat(80));
    console.log(`Total de clientes afectados: ${clientes.length}`);
    console.log(`  - Sin Provincia: ${totalSinProvincia}`);
    console.log(`  - Sin Código Postal: ${totalSinCP}`);
    console.log(`  - Sin ambos: ${totalSinAmbos}`);
    console.log(`Total de poblaciones afectadas: ${poblacionesArray.length}`);
    console.log('='.repeat(80));
    
    console.log('\n💡 Recomendación: Ejecutar el script de verificación y corrección');
    console.log('   node scripts/verificar-corregir-poblacion-provincia-cp.js\n');
    
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
