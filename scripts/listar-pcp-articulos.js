/**
 * Script para listar todos los artículos con su PCP (Precio de Compra)
 */
const crm = require('../config/mysql-crm');
const fs = require('fs').promises;
const path = require('path');

async function listarPCPArticulos() {
  try {
    console.log('📋 Obteniendo listado de artículos con PCP...\n');
    
    const articulos = await crm.getArticulos();
    
    // Ordenar por nombre
    articulos.sort((a, b) => {
      const nombreA = (a.Nombre || a.nombre || '').toLowerCase();
      const nombreB = (b.Nombre || b.nombre || '').toLowerCase();
      return nombreA.localeCompare(nombreB);
    });
    
    console.log('='.repeat(100));
    console.log('LISTADO DE ARTÍCULOS CON PRECIO DE COMPRA (PCP)');
    console.log('='.repeat(100));
    console.log(`\nTotal de artículos: ${articulos.length}\n`);
    
    // Separar artículos con y sin PCP
    const articulosConPCP = articulos.filter(a => a.PCP && parseFloat(a.PCP) > 0);
    const articulosSinPCP = articulos.filter(a => !a.PCP || parseFloat(a.PCP) === 0);
    
    console.log(`✅ Artículos con PCP: ${articulosConPCP.length}`);
    console.log(`⚠️  Artículos sin PCP: ${articulosSinPCP.length}\n`);
    
    // Mostrar artículos con PCP
    if (articulosConPCP.length > 0) {
      console.log('='.repeat(100));
      console.log('ARTÍCULOS CON PRECIO DE COMPRA (PCP)');
      console.log('='.repeat(100));
      console.log('\n');
      console.log(String('ID').padEnd(6) + String('SKU').padEnd(15) + String('Nombre').padEnd(50) + String('PVL (€)').padEnd(12) + String('PCP (€)').padEnd(12) + String('Margen (€)').padEnd(12) + String('% Rent.').padEnd(12));
      console.log('-'.repeat(100));
      
      let totalPVL = 0;
      let totalPCP = 0;
      
      for (const articulo of articulosConPCP) {
        const id = articulo.id || articulo.Id || 'N/A';
        const sku = (articulo.SKU || '').padEnd(15);
        const nombre = ((articulo.Nombre || articulo.nombre || 'Sin nombre').substring(0, 48)).padEnd(50);
        const pvl = parseFloat(articulo.PVL || 0);
        const pcp = parseFloat(articulo.PCP || 0);
        const margen = pvl - pcp;
        const porcentajeRentabilidad = pcp > 0 ? ((pvl - pcp) / pcp) * 100 : 0;
        
        totalPVL += pvl;
        totalPCP += pcp;
        
        const pvlStr = pvl.toFixed(2).padEnd(12);
        const pcpStr = pcp.toFixed(2).padEnd(12);
        const margenStr = margen.toFixed(2).padEnd(12);
        const porcentajeStr = porcentajeRentabilidad.toFixed(2) + '%';
        
        console.log(
          String(id).padEnd(6) + 
          sku + 
          nombre + 
          pvlStr + 
          pcpStr + 
          margenStr + 
          porcentajeStr
        );
      }
      
      console.log('-'.repeat(100));
      const margenTotal = totalPVL - totalPCP;
      const porcentajeTotal = totalPCP > 0 ? ((totalPVL - totalPCP) / totalPCP) * 100 : 0;
      console.log(
        String('TOTAL').padEnd(6) + 
        String('').padEnd(15) + 
        String('').padEnd(50) + 
        totalPVL.toFixed(2).padEnd(12) + 
        totalPCP.toFixed(2).padEnd(12) + 
        margenTotal.toFixed(2).padEnd(12) + 
        porcentajeTotal.toFixed(2) + '%'
      );
    }
    
    // Mostrar artículos sin PCP
    if (articulosSinPCP.length > 0) {
      console.log('\n\n');
      console.log('='.repeat(100));
      console.log('ARTÍCULOS SIN PRECIO DE COMPRA (PCP)');
      console.log('='.repeat(100));
      console.log('\n');
      console.log(String('ID').padEnd(6) + String('SKU').padEnd(15) + String('Nombre').padEnd(50) + String('PVL (€)').padEnd(12));
      console.log('-'.repeat(100));
      
      for (const articulo of articulosSinPCP) {
        const id = articulo.id || articulo.Id || 'N/A';
        const sku = (articulo.SKU || '').padEnd(15);
        const nombre = ((articulo.Nombre || articulo.nombre || 'Sin nombre').substring(0, 48)).padEnd(50);
        const pvl = parseFloat(articulo.PVL || 0);
        const pvlStr = pvl.toFixed(2).padEnd(12);
        
        console.log(
          String(id).padEnd(6) + 
          sku + 
          nombre + 
          pvlStr
        );
      }
    }
    
    // Generar archivo CSV
    const fecha = new Date().toISOString().split('T')[0];
    const archivoCSV = path.join(__dirname, `listado-pcp-articulos-${fecha}.csv`);
    
    let csvContent = 'ID,SKU,Nombre,PVL (€),PCP (€),Margen (€),% Rentabilidad\n';
    
    for (const articulo of articulos) {
      const id = articulo.id || articulo.Id || '';
      const sku = articulo.SKU || '';
      const nombre = (articulo.Nombre || articulo.nombre || 'Sin nombre').replace(/,/g, ';');
      const pvl = parseFloat(articulo.PVL || 0);
      const pcp = parseFloat(articulo.PCP || 0);
      const margen = pvl - pcp;
      const porcentajeRentabilidad = pcp > 0 ? ((pvl - pcp) / pcp) * 100 : 0;
      
      csvContent += `${id},${sku},"${nombre}",${pvl.toFixed(2)},${pcp.toFixed(2)},${margen.toFixed(2)},${porcentajeRentabilidad.toFixed(2)}\n`;
    }
    
    await fs.writeFile(archivoCSV, csvContent, 'utf8');
    console.log(`\n\n✅ Listado exportado a CSV: ${archivoCSV}`);
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ Proceso completado');
    console.log('='.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listarPCPArticulos()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  });

