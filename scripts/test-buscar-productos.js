const crm = require('../config/mysql-crm');

const productos = [
  'Talco Liquido 250mL - Youbelle/Farmadescanso - 70cx',
  'Gel Íntimo Hidratante 250mL - Youbelle/Farmadescanso - 70cx',
  'Gel Íntimo Calmante 250mL - Youbelle/Farmadescanso - 70cx',
  '41.00648',
  '41.00633',
  '41.00634'
];

async function buscarArticulo(termino) {
  try {
    // Limpiar el término
    let terminoLimpio = termino
      .replace(/\s*-\s*Youbelle\/Farmadescanso.*$/i, '')
      .replace(/\s*-\s*\d+cx.*$/i, '')
      .replace(/\s*-\s*\(\d+cx\).*$/i, '')
      .replace(/\s*-\s*\d+mL.*$/i, '')
      .replace(/\s*-\s*\d+L.*$/i, '')
      .replace(/\s*-\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`\n🔍 Buscando: "${termino}"`);
    console.log(`   Limpio: "${terminoLimpio}"`);
    
    // Buscar por código
    if (/^\d+\.\d{5}$/.test(termino.trim())) {
      const sql = `SELECT * FROM articulos WHERE SKU = ? LIMIT 1`;
      const rows = await crm.query(sql, [termino.trim()]);
      if (rows && rows.length > 0) {
        console.log(`   ✅ Encontrado por código: ${rows[0].Nombre}`);
        return rows[0];
      }
    }
    
    // Normalizar
    let terminoNormalizado = terminoLimpio
      .replace(/\b(\d+)\s*mL\b/gi, '$1 Ml')
      .replace(/\b(\d+)\s*L\b/gi, '$1 L');
    
    console.log(`   Normalizado: "${terminoNormalizado}"`);
    
    const palabrasClave = terminoNormalizado
      .split(/\s+/)
      .filter(p => p.length > 1 && !/^(de|del|la|el|los|las|con|para|por|em|en)$/i.test(p))
      .slice(0, 5);
    
    console.log(`   Palabras clave: ${palabrasClave.join(', ')}`);
    
    if (palabrasClave.length > 0) {
      const condiciones = palabrasClave.map(() => 'Nombre LIKE ?').join(' AND ');
      const valores = palabrasClave.map(p => `%${p}%`);
      const sql = `SELECT * FROM articulos WHERE ${condiciones} LIMIT 5`;
      const rows = await crm.query(sql, valores);
      
      if (rows && rows.length > 0) {
        console.log(`   ✅ Encontrados ${rows.length} resultados:`);
        rows.forEach(r => console.log(`      - ${r.Nombre}`));
        return rows[0];
      } else {
        console.log(`   ❌ No encontrado con todas las palabras`);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

(async () => {
  for (const producto of productos) {
    await buscarArticulo(producto);
  }
  process.exit(0);
})();

