/**
 * Script para generar un informe detallado de PCP de todos los artículos
 */
const crm = require('../config/mysql-crm');
const fs = require('fs').promises;
const path = require('path');

async function generarInformeDetallado() {
  try {
    console.log('📊 Generando informe detallado de PCP...\n');
    
    const articulos = await crm.getArticulos();
    
    // Ordenar por nombre
    articulos.sort((a, b) => {
      const nombreA = (a.Nombre || a.nombre || '').toLowerCase();
      const nombreB = (b.Nombre || b.nombre || '').toLowerCase();
      return nombreA.localeCompare(nombreB);
    });
    
    // Separar artículos
    const articulosConPCP = articulos.filter(a => a.PCP && parseFloat(a.PCP) > 0);
    const articulosSinPCP = articulos.filter(a => !a.PCP || parseFloat(a.PCP) === 0);
    const articulosConPCPIncorrecto = articulosConPCP.filter(a => {
      const pvl = parseFloat(a.PVL || 0);
      const pcp = parseFloat(a.PCP || 0);
      return pcp > pvl * 2; // Si el PCP es más del doble del PVL, probablemente está mal
    });
    
    // Calcular estadísticas
    const totalPVL = articulos.reduce((sum, a) => sum + parseFloat(a.PVL || 0), 0);
    const totalPCP = articulosConPCP.reduce((sum, a) => sum + parseFloat(a.PCP || 0), 0);
    const totalMargen = articulosConPCP.reduce((sum, a) => {
      const pvl = parseFloat(a.PVL || 0);
      const pcp = parseFloat(a.PCP || 0);
      return sum + (pvl - pcp);
    }, 0);
    const rentabilidadPromedio = articulosConPCP.length > 0
      ? articulosConPCP.reduce((sum, a) => {
          const pvl = parseFloat(a.PVL || 0);
          const pcp = parseFloat(a.PCP || 0);
          return sum + (pcp > 0 ? ((pvl - pcp) / pcp) * 100 : 0);
        }, 0) / articulosConPCP.length
      : 0;
    
    // Generar contenido del informe
    const fecha = new Date().toLocaleString('es-ES');
    let informe = '';
    
    informe += '='.repeat(100) + '\n';
    informe += 'INFORME DETALLADO DE PRECIOS DE COMPRA (PCP) - ARTÍCULOS\n';
    informe += '='.repeat(100) + '\n';
    informe += `Fecha de generación: ${fecha}\n`;
    informe += `Total de artículos en catálogo: ${articulos.length}\n\n`;
    
    // Estadísticas generales
    informe += '='.repeat(100) + '\n';
    informe += 'ESTADÍSTICAS GENERALES\n';
    informe += '='.repeat(100) + '\n\n';
    informe += `✅ Artículos con PCP configurado: ${articulosConPCP.length} (${((articulosConPCP.length / articulos.length) * 100).toFixed(1)}%)\n`;
    informe += `⚠️  Artículos sin PCP: ${articulosSinPCP.length} (${((articulosSinPCP.length / articulos.length) * 100).toFixed(1)}%)\n`;
    if (articulosConPCPIncorrecto.length > 0) {
      informe += `❌ Artículos con PCP sospechoso (PCP > 2x PVL): ${articulosConPCPIncorrecto.length}\n`;
    }
    informe += `\n💰 Total PVL de todos los artículos: ${totalPVL.toFixed(2)}€\n`;
    informe += `💰 Total PCP de artículos con precio: ${totalPCP.toFixed(2)}€\n`;
    informe += `💰 Margen total: ${totalMargen.toFixed(2)}€\n`;
    informe += `📈 Rentabilidad promedio: ${rentabilidadPromedio.toFixed(2)}%\n\n`;
    
    // Artículos con PCP
    if (articulosConPCP.length > 0) {
      informe += '='.repeat(100) + '\n';
      informe += 'ARTÍCULOS CON PRECIO DE COMPRA (PCP)\n';
      informe += '='.repeat(100) + '\n\n';
      
      // Ordenar por rentabilidad
      const articulosOrdenados = [...articulosConPCP].sort((a, b) => {
        const pvlA = parseFloat(a.PVL || 0);
        const pcpA = parseFloat(a.PCP || 0);
        const pvlB = parseFloat(b.PVL || 0);
        const pcpB = parseFloat(b.PCP || 0);
        const rentA = pcpA > 0 ? ((pvlA - pcpA) / pcpA) * 100 : -999;
        const rentB = pcpB > 0 ? ((pvlB - pcpB) / pcpB) * 100 : -999;
        return rentB - rentA; // Mayor rentabilidad primero
      });
      
      informe += String('ID').padEnd(6) + 
                 String('SKU').padEnd(15) + 
                 String('Nombre').padEnd(45) + 
                 String('PVL (€)').padEnd(12) + 
                 String('PCP (€)').padEnd(12) + 
                 String('Margen (€)').padEnd(12) + 
                 String('% Rent.').padEnd(12) + 
                 String('Estado').padEnd(15) + '\n';
      informe += '-'.repeat(100) + '\n';
      
      for (const articulo of articulosOrdenados) {
        const id = articulo.id || articulo.Id || 'N/A';
        const sku = (articulo.SKU || '').substring(0, 14).padEnd(15);
        const nombre = ((articulo.Nombre || articulo.nombre || 'Sin nombre').substring(0, 44)).padEnd(45);
        const pvl = parseFloat(articulo.PVL || 0);
        const pcp = parseFloat(articulo.PCP || 0);
        const margen = pvl - pcp;
        const porcentajeRentabilidad = pcp > 0 ? ((pvl - pcp) / pcp) * 100 : 0;
        
        let estado = '';
        if (pcp > pvl * 2) {
          estado = '⚠️ INCORRECTO';
        } else if (porcentajeRentabilidad < 0) {
          estado = '❌ PÉRDIDA';
        } else if (porcentajeRentabilidad < 10) {
          estado = '⚠️ BAJO';
        } else if (porcentajeRentabilidad < 30) {
          estado = '✅ NORMAL';
        } else {
          estado = '✅ ALTO';
        }
        
        informe += String(id).padEnd(6) + 
                   sku + 
                   nombre + 
                   pvl.toFixed(2).padEnd(12) + 
                   pcp.toFixed(2).padEnd(12) + 
                   margen.toFixed(2).padEnd(12) + 
                   porcentajeRentabilidad.toFixed(2) + '%'.padEnd(8) + 
                   estado.padEnd(15) + '\n';
      }
      
      informe += '\n';
    }
    
    // Artículos sin PCP
    if (articulosSinPCP.length > 0) {
      informe += '='.repeat(100) + '\n';
      informe += 'ARTÍCULOS SIN PRECIO DE COMPRA (PCP)\n';
      informe += '='.repeat(100) + '\n';
      informe += `\nTotal: ${articulosSinPCP.length} artículos\n\n`;
      
      informe += String('ID').padEnd(6) + 
                 String('SKU').padEnd(15) + 
                 String('Nombre').padEnd(50) + 
                 String('PVL (€)').padEnd(12) + 
                 String('Marca').padEnd(20) + '\n';
      informe += '-'.repeat(100) + '\n';
      
      for (const articulo of articulosSinPCP) {
        const id = articulo.id || articulo.Id || 'N/A';
        const sku = (articulo.SKU || '').substring(0, 14).padEnd(15);
        const nombre = ((articulo.Nombre || articulo.nombre || 'Sin nombre').substring(0, 49)).padEnd(50);
        const pvl = parseFloat(articulo.PVL || 0);
        const marca = (articulo.Marca || articulo.marca || 'N/A').substring(0, 19).padEnd(20);
        
        informe += String(id).padEnd(6) + 
                   sku + 
                   nombre + 
                   pvl.toFixed(2).padEnd(12) + 
                   marca + '\n';
      }
      
      informe += '\n';
    }
    
    // Análisis por marca
    const articulosPorMarca = {};
    articulos.forEach(a => {
      const marca = a.Marca || a.marca || 'Sin marca';
      if (!articulosPorMarca[marca]) {
        articulosPorMarca[marca] = { total: 0, conPCP: 0, sinPCP: 0 };
      }
      articulosPorMarca[marca].total++;
      if (a.PCP && parseFloat(a.PCP) > 0) {
        articulosPorMarca[marca].conPCP++;
      } else {
        articulosPorMarca[marca].sinPCP++;
      }
    });
    
    informe += '='.repeat(100) + '\n';
    informe += 'ANÁLISIS POR MARCA\n';
    informe += '='.repeat(100) + '\n\n';
    
    const marcasOrdenadas = Object.entries(articulosPorMarca)
      .sort((a, b) => b[1].total - a[1].total);
    
    informe += String('Marca').padEnd(30) + 
               String('Total').padEnd(10) + 
               String('Con PCP').padEnd(12) + 
               String('Sin PCP').padEnd(12) + 
               String('% Completo').padEnd(15) + '\n';
    informe += '-'.repeat(100) + '\n';
    
    for (const [marca, datos] of marcasOrdenadas) {
      const porcentaje = datos.total > 0 ? ((datos.conPCP / datos.total) * 100).toFixed(1) : '0.0';
      informe += marca.substring(0, 29).padEnd(30) + 
                 String(datos.total).padEnd(10) + 
                 String(datos.conPCP).padEnd(12) + 
                 String(datos.sinPCP).padEnd(12) + 
                 porcentaje + '%'.padEnd(10) + '\n';
    }
    
    informe += '\n';
    
    // Recomendaciones
    informe += '='.repeat(100) + '\n';
    informe += 'RECOMENDACIONES\n';
    informe += '='.repeat(100) + '\n\n';
    
    if (articulosSinPCP.length > 0) {
      informe += `⚠️  Hay ${articulosSinPCP.length} artículos sin PCP configurado.\n`;
      informe += `   Se recomienda revisar las facturas de compra para estos artículos.\n\n`;
    }
    
    if (articulosConPCPIncorrecto.length > 0) {
      informe += `❌ Hay ${articulosConPCPIncorrecto.length} artículos con PCP sospechoso:\n`;
      articulosConPCPIncorrecto.forEach(a => {
        informe += `   - ${a.Nombre || a.nombre} (PVL: ${parseFloat(a.PVL || 0).toFixed(2)}€, PCP: ${parseFloat(a.PCP || 0).toFixed(2)}€)\n`;
      });
      informe += `   Se recomienda revisar las facturas para verificar estos precios.\n\n`;
    }
    
    const articulosConPerdida = articulosConPCP.filter(a => {
      const pvl = parseFloat(a.PVL || 0);
      const pcp = parseFloat(a.PCP || 0);
      return pcp > pvl;
    });
    
    if (articulosConPerdida.length > 0) {
      informe += `❌ Hay ${articulosConPerdida.length} artículos con pérdida (PCP > PVL):\n`;
      articulosConPerdida.forEach(a => {
        const pvl = parseFloat(a.PVL || 0);
        const pcp = parseFloat(a.PCP || 0);
        informe += `   - ${a.Nombre || a.nombre} (PVL: ${pvl.toFixed(2)}€, PCP: ${pcp.toFixed(2)}€, Pérdida: ${(pcp - pvl).toFixed(2)}€)\n`;
      });
      informe += `   Se recomienda revisar estos precios urgentemente.\n\n`;
    }
    
    informe += '='.repeat(100) + '\n';
    informe += 'FIN DEL INFORME\n';
    informe += '='.repeat(100) + '\n';
    
    // Guardar informe en archivo de texto
    const fechaArchivo = new Date().toISOString().split('T')[0];
    const archivoTXT = path.join(__dirname, `informe-pcp-detallado-${fechaArchivo}.txt`);
    await fs.writeFile(archivoTXT, informe, 'utf8');
    
    // Mostrar en consola
    console.log(informe);
    
    console.log(`\n✅ Informe guardado en: ${archivoTXT}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generarInformeDetallado()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  });

