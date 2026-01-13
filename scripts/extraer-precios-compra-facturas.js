/**
 * Script para extraer precios de compra (PCP) de facturas PDF
 * y actualizar la base de datos de artículos
 */
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const crm = require('../config/mysql-crm');

// Rutas de las facturas
const FACTURAS = [
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20251217 FT A_3406_Fourmag.pdf",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20250513 Factura 2931 Fourmag.pdf",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20250106 FT A_2668 Fourmag.pdf",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20251119 Fattura Diff. N. 168 Gemavip.pdf",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20251023 Fattura Diff. N. 144 Gemavip.pdf"
];

/**
 * Extraer texto de un PDF
 */
async function extraerTextoPDF(rutaPDF) {
  try {
    const dataBuffer = await fs.readFile(rutaPDF);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`❌ Error leyendo PDF ${rutaPDF}:`, error.message);
    throw error;
  }
}

/**
 * Buscar un artículo en la base de datos por nombre, código o SKU
 */
async function buscarArticulo(termino) {
  try {
    // Limpiar el término (quitar información de presentación, marca, etc.)
    let terminoLimpio = termino
      .replace(/\s*-\s*Youbelle\/Farmadescanso.*$/i, '')
      .replace(/\s*-\s*\d+cx.*$/i, '')
      .replace(/\s*-\s*\(\d+cx\).*$/i, '')
      .replace(/\s*-\s*\d+mL.*$/i, '')
      .replace(/\s*-\s*\d+L.*$/i, '')
      .replace(/\s*-\s*$/i, '') // Quitar guiones al final
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
    
    // Buscar por código exacto si el término parece un código (formato XX.XXXXX)
    // Nota: Los códigos de Fourmag (41.00648) no coinciden con SKU, así que los ignoramos por ahora
    // y buscamos solo por descripción
    
    // Extraer palabras clave principales (eliminar artículos, preposiciones, etc.)
    // Normalizar: convertir "mL" a "Ml", "L" a "L", etc.
    // También tratar "250mL" como "250 Ml" (con espacio)
    let terminoNormalizado = terminoLimpio
      .replace(/\b(\d+)\s*mL\b/gi, '$1 Ml')
      .replace(/\b(\d+)\s*L\b/gi, '$1 L')
      .replace(/\b(\d+)mL\b/gi, '$1 Ml')
      .replace(/\b(\d+)L\b/gi, '$1 L');
    
    // Extraer palabras clave, pero tratar números con unidades como una sola palabra clave
    const palabrasClave = terminoNormalizado
      .split(/\s+/)
      .filter(p => p.length > 1 && !/^(de|del|la|el|los|las|con|para|por|em|en)$/i.test(p))
      .slice(0, 4); // Tomar las primeras 4 palabras clave
    
    if (palabrasClave.length > 0) {
      // Buscar productos que contengan todas las palabras clave principales
      const condiciones = palabrasClave.map(() => 'Nombre LIKE ?').join(' AND ');
      const valores = palabrasClave.map(p => `%${p}%`);
      let sql = `SELECT * FROM articulos WHERE ${condiciones} LIMIT 5`;
      let rows = await crm.query(sql, valores);
      
      if (rows && rows.length > 0) {
        // Si hay múltiples resultados, intentar encontrar el más similar
        // Buscar el que tenga más palabras en común
        let mejorMatch = rows[0];
        let mejorScore = 0;
        
        for (const row of rows) {
          const nombre = (row.Nombre || row.nombre || '').toLowerCase();
          let score = 0;
          palabrasClave.forEach(palabra => {
            if (nombre.includes(palabra.toLowerCase())) {
              score++;
            }
          });
          if (score > mejorScore) {
            mejorScore = score;
            mejorMatch = row;
          }
        }
        
        return mejorMatch;
      }
    }
    
    // Búsqueda más amplia: buscar por cualquier palabra clave
    if (palabrasClave.length > 0) {
      const condiciones = palabrasClave.map(() => 'Nombre LIKE ?').join(' OR ');
      const valores = palabrasClave.map(p => `%${p}%`);
      const sql = `SELECT * FROM articulos WHERE ${condiciones} LIMIT 1`;
      const rows = await crm.query(sql, valores);
      if (rows && rows.length > 0) {
        return rows[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error buscando artículo "${termino}":`, error.message);
    return null;
  }
}

/**
 * Parsear una factura PDF y extraer productos y precios
 */
async function parsearFactura(rutaPDF) {
  console.log(`\n📄 Procesando factura: ${path.basename(rutaPDF)}`);
  
  const texto = await extraerTextoPDF(rutaPDF);
  
  // Detectar si es factura Fourmag o Gemavip
  const esFourmag = texto.includes('Fourmag') || rutaPDF.includes('Fourmag');
  const esGemavip = texto.includes('Gemavip') || rutaPDF.includes('Gemavip');
  
  const productos = [];
  let totalFactura = 0;
  let portes = 0;
  
  if (esFourmag) {
    // Parsear factura Fourmag (formato portugués)
    const lineas = texto.split('\n');
    
    // Buscar total de la factura (formato: Total 8 743,80 €)
    const totalMatch = texto.match(/Total[\s]+(\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s*[€Ôé¼ÔÇ£]/i);
    if (totalMatch) {
      totalFactura = parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'));
    }
    
    // Buscar portes (formato: PORTES (2 Paletes)1,00UN180,000 Ôé¼)
    const portesMatch = texto.match(/PORTES[^(]*\([^)]+\)([\d.,]+)UN([\d.,]+)\s*[€Ôé¼ÔÇ£]/i);
    if (portesMatch) {
      portes = parseFloat(portesMatch[2].replace(/\./g, '').replace(',', '.'));
    }
    
    // Buscar productos (formato: Código Descripción Cantidad UN Precio Dsc IVA Total)
    // Ejemplo: 41.00648 Talco Liquido 250mL - Youbelle/Farmadescanso - 70cx 1 260,00 UN 3,250 € 0,00 0,00% 4 095,00 €
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      
      // Buscar línea que empiece con código numérico (formato: XX.XXXXX)
      if (/^\d+\.\d{5}$/.test(linea.trim())) {
        const codigo = linea.trim();
        let descripcion = '';
        let cantidad = 0;
        let precioUnitario = 0;
        let totalLinea = 0;
        
        // Buscar descripción en las siguientes líneas (hasta encontrar la línea con UN)
        let j = i + 1;
        while (j < lineas.length && j < i + 6) {
          const siguienteLinea = lineas[j];
          
          // Si encontramos la línea con cantidad y precio (formato: cantidad UN precio € descuento IVA% total €)
          // Ejemplo: 1 260,00UN3,250 Ôé¼0,000,00%4 095,00 Ôé¼
          // También puede ser: 1 260,00UN3,250 Ôé¼0,000,00%4 095,00 Ôé¼ (sin espacios)
          const matchDatos = siguienteLinea.match(/(\d{1,3}(?:\s\d{3})*(?:,\d+)?)UN([\d.,]+)\s*[€Ôé¼ÔÇ£][\d.,]+[\d.,]+%([\d.,]+)\s*[€Ôé¼ÔÇ£]/);
          
          if (matchDatos) {
            cantidad = parseFloat(matchDatos[1].replace(/\s/g, '').replace(',', '.'));
            precioUnitario = parseFloat(matchDatos[2].replace(/\./g, '').replace(',', '.'));
            totalLinea = parseFloat(matchDatos[3].replace(/\s/g, '').replace(',', '.'));
            break;
          }
          
          // Acumular descripción (líneas que no son códigos ni datos numéricos)
          if (!/^\d+\.\d{5}$/.test(siguienteLinea.trim()) && 
              !siguienteLinea.match(/UN[\d.,]+/) &&
              !siguienteLinea.match(/^Lote:/i) &&
              !siguienteLinea.match(/^PORTES/i) &&
              siguienteLinea.trim().length > 0) {
            const lineaLimpia = siguienteLinea.trim();
            // No agregar si es solo un número o código
            if (!/^\d+$/.test(lineaLimpia) && !/^\d+\.\d+$/.test(lineaLimpia)) {
              descripcion += (descripcion ? ' ' : '') + lineaLimpia;
            }
          }
          
          j++;
        }
        
        // Limpiar descripción
        descripcion = descripcion.trim();
        
        if (cantidad > 0 && precioUnitario > 0 && descripcion) {
          productos.push({
            codigo,
            descripcion,
            cantidad,
            precio_unitario: precioUnitario,
            total_linea: totalLinea || (cantidad * precioUnitario)
          });
        }
      }
    }
    
    // Si no encontramos productos, intentar patrón más flexible
    if (productos.length === 0) {
      const patronFlexible = /(\d+\.\d{5})\s+([A-Za-z0-9\s\-\/]+?)\s+(\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s+UN\s+([\d.,]+)/g;
      let match;
      
      while ((match = patronFlexible.exec(texto)) !== null) {
        const codigo = match[1];
        const descripcion = match[2].trim().split(/Lote:|Validade:/i)[0].trim();
        const cantidadStr = match[3].replace(/\s/g, '').replace(',', '.');
        const cantidad = parseFloat(cantidadStr);
        const precioUnitario = parseFloat(match[4].replace(/\./g, '').replace(',', '.'));
        
        if (cantidad > 0 && precioUnitario > 0) {
          productos.push({
            codigo,
            descripcion,
            cantidad,
            precio_unitario: precioUnitario,
            total_linea: cantidad * precioUnitario
          });
        }
      }
    }
  } else if (esGemavip) {
    // Parsear factura Gemavip (italiana)
    const lineas = texto.split('\n');
    
    // Buscar total
    const totalMatch = texto.match(/TOTALE[:\s]+([\d.,]+)/i) ||
                      texto.match(/TOTAL[:\s]+EUR[:\s]+([\d.,]+)/i);
    if (totalMatch) {
      totalFactura = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
    }
    
    // Buscar portes
    const portesMatch = texto.match(/SPEDIZIONE[:\s]+([\d.,]+)/i) ||
                       texto.match(/TRASPORTO[:\s]+([\d.,]+)/i);
    if (portesMatch) {
      portes = parseFloat(portesMatch[1].replace(/\./g, '').replace(',', '.'));
    }
    
    // Buscar productos (formato italiano similar)
    const patronProducto = /(\d+)\s+([A-Z0-9\s\-]+?)\s+([\d.,]+)\s+([\d.,]+)/gi;
    let match;
    
    while ((match = patronProducto.exec(texto)) !== null) {
      const cantidad = parseInt(match[1]);
      const descripcion = match[2].trim();
      const precioUnitario = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));
      const totalLinea = parseFloat(match[4].replace(/\./g, '').replace(',', '.'));
      
      if (cantidad > 0 && precioUnitario > 0) {
        productos.push({
          descripcion,
          cantidad,
          precio_unitario: precioUnitario,
          total_linea: totalLinea
        });
      }
    }
  }
  
      // Eliminar productos duplicados (mismo código)
      const productosUnicos = [];
      const codigosVistos = new Set();
      
      for (const producto of productos) {
        if (producto.codigo && !codigosVistos.has(producto.codigo)) {
          codigosVistos.add(producto.codigo);
          productosUnicos.push(producto);
        } else if (!producto.codigo) {
          // Si no tiene código, verificar por descripción
          const descKey = producto.descripcion.toLowerCase().trim();
          if (!codigosVistos.has(descKey)) {
            codigosVistos.add(descKey);
            productosUnicos.push(producto);
          }
        }
      }
      
      return {
        ruta: rutaPDF,
        nombre: path.basename(rutaPDF),
        productos: productosUnicos,
        total_factura: totalFactura,
        portes
      };
}

/**
 * Actualizar PCP de un artículo
 */
async function actualizarPCP(articuloId, nuevoPCP) {
  try {
    await crm.updateArticulo(articuloId, { PCP: nuevoPCP });
    console.log(`  ✅ Actualizado PCP: ${nuevoPCP.toFixed(2)}€`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error actualizando PCP:`, error.message);
    return false;
  }
}

/**
 * Procesar todas las facturas
 */
async function procesarFacturas() {
  console.log('🚀 Iniciando extracción de precios de compra desde facturas PDF...\n');
  
  const resultados = [];
  
  for (const rutaFactura of FACTURAS) {
    try {
      // Verificar que el archivo existe
      await fs.access(rutaFactura);
      
      const factura = await parsearFactura(rutaFactura);
      
      console.log(`\n📊 Factura: ${factura.nombre}`);
      console.log(`   Total factura: ${factura.total_factura.toFixed(2)}€`);
      console.log(`   Portes: ${factura.portes.toFixed(2)}€`);
      console.log(`   Productos encontrados: ${factura.productos.length}`);
      
      // Calcular total de productos (sin portes)
      const totalProductos = factura.productos.reduce((sum, p) => sum + p.total_linea, 0);
      const totalConPortes = totalProductos + factura.portes;
      
      // Repartir portes proporcionalmente entre productos
      // El portes se reparte según el valor de cada línea de producto
      const factorPortes = factura.portes > 0 && totalProductos > 0 
        ? factura.portes / totalProductos 
        : 0;
      
      let productosActualizados = 0;
      let productosNoEncontrados = [];
      
      for (const producto of factura.productos) {
        // Calcular precio unitario con portes
        // Portes proporcional de esta línea = (portes * valor_linea) / total_productos
        // Portes por unidad = portes_proporcional / cantidad
        const portesProporcionalLinea = factura.portes > 0 && totalProductos > 0
          ? (factura.portes * producto.total_linea) / totalProductos
          : 0;
        const portesPorUnidad = portesProporcionalLinea / producto.cantidad;
        const precioUnitarioConPortes = producto.precio_unitario + portesPorUnidad;
        
        // Buscar artículo en la base de datos (primero por código, luego por descripción)
        let articulo = null;
        if (producto.codigo) {
          articulo = await buscarArticulo(producto.codigo);
        }
        if (!articulo) {
          articulo = await buscarArticulo(producto.descripcion);
        }
        
        if (articulo) {
          console.log(`\n  📦 ${articulo.Nombre || articulo.nombre}`);
          console.log(`     Descripción factura: ${producto.descripcion}`);
          console.log     (`     Cantidad: ${producto.cantidad}`);
          console.log(`     Precio unitario: ${producto.precio_unitario.toFixed(2)}€`);
          console.log(`     Precio con portes: ${precioUnitarioConPortes.toFixed(2)}€`);
          
          // Actualizar PCP
          const actualizado = await actualizarPCP(articulo.id || articulo.Id, precioUnitarioConPortes);
          if (actualizado) {
            productosActualizados++;
          }
        } else {
          console.log(`\n  ⚠️  Producto no encontrado: ${producto.descripcion}`);
          productosNoEncontrados.push(producto.descripcion);
        }
      }
      
      resultados.push({
        factura: factura.nombre,
        productos_encontrados: factura.productos.length,
        productos_actualizados: productosActualizados,
        productos_no_encontrados: productosNoEncontrados,
        total_factura: factura.total_factura,
        portes: factura.portes
      });
      
    } catch (error) {
      console.error(`\n❌ Error procesando factura ${rutaFactura}:`, error.message);
      resultados.push({
        factura: path.basename(rutaFactura),
        error: error.message
      });
    }
  }
  
  // Resumen
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE PROCESAMIENTO');
  console.log('='.repeat(80));
  
  resultados.forEach(r => {
    console.log(`\n📄 ${r.factura}`);
    if (r.error) {
      console.log(`   ❌ Error: ${r.error}`);
    } else {
      console.log(`   ✅ Productos encontrados: ${r.productos_encontrados}`);
      console.log(`   ✅ Productos actualizados: ${r.productos_actualizados}`);
      if (r.productos_no_encontrados.length > 0) {
        console.log(`   ⚠️  No encontrados: ${r.productos_no_encontrados.length}`);
        r.productos_no_encontrados.forEach(p => console.log(`      - ${p}`));
      }
      console.log(`   💰 Total factura: ${r.total_factura.toFixed(2)}€`);
      console.log(`   🚚 Portes: ${r.portes.toFixed(2)}€`);
    }
  });
  
  const totalActualizados = resultados.reduce((sum, r) => sum + (r.productos_actualizados || 0), 0);
  console.log(`\n✅ Total productos actualizados: ${totalActualizados}`);
  console.log('='.repeat(80));
}

// Ejecutar
procesarFacturas()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });

