const crm = require('../config/mysql-crm');

async function verificarRelaciones() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // 1. Verificar artículos con Id_Marca = 1
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. ARTÍCULOS CON Id_Marca = 1:');
    console.log('═══════════════════════════════════════════════════════════');
    const articulos = await crm.query('SELECT id, Nombre, Id_Marca FROM articulos WHERE Id_Marca = 1 LIMIT 5');
    console.log(`Total artículos con Id_Marca = 1: ${articulos.length}`);
    if (articulos.length > 0) {
      articulos.forEach((art, i) => {
        console.log(`  ${i + 1}. ID: ${art.id}, Nombre: ${art.Nombre || 'N/A'}, Id_Marca: ${art.Id_Marca}`);
      });
    }
    
    // 2. Verificar líneas de pedidos
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('2. LÍNEAS DE PEDIDOS (muestra):');
    console.log('═══════════════════════════════════════════════════════════');
    const lineas = await crm.query('SELECT * FROM pedidos_articulos LIMIT 5');
    console.log(`Total líneas en pedidos_articulos: ${lineas.length} (mostrando primeras 5)`);
    if (lineas.length > 0) {
      lineas.forEach((linea, i) => {
        console.log(`  ${i + 1}. Id_NumPedido: ${linea.Id_NumPedido}, NumPedido: ${linea.NumPedido}, Id_Articulo: ${linea.Id_Articulo}`);
      });
    }
    
    // 3. Verificar relación entre pedidos_articulos y articulos
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('3. VERIFICANDO RELACIÓN:');
    console.log('═══════════════════════════════════════════════════════════');
    const relacion = await crm.query(`
      SELECT pa.Id_NumPedido, pa.NumPedido, pa.Id_Articulo, a.Id_Marca, a.Nombre as ArticuloNombre
      FROM pedidos_articulos pa
      LEFT JOIN articulos a ON a.id = pa.Id_Articulo
      LIMIT 10
    `);
    console.log(`Total relaciones encontradas: ${relacion.length} (mostrando primeras 10)`);
    relacion.forEach((r, i) => {
      console.log(`  ${i + 1}. Pedido: ${r.Id_NumPedido || r.NumPedido}, Artículo ID: ${r.Id_Articulo}, Marca: ${r.Id_Marca || 'NULL'}, Nombre: ${r.ArticuloNombre || 'N/A'}`);
    });
    
    // 4. Verificar si hay artículos de marca 1 en pedidos
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('4. ARTÍCULOS DE MARCA 1 EN PEDIDOS:');
    console.log('═══════════════════════════════════════════════════════════');
    const marcaEnPedidos = await crm.query(`
      SELECT pa.*, a.Id_Marca, a.Nombre as ArticuloNombre
      FROM pedidos_articulos pa
      INNER JOIN articulos a ON a.id = pa.Id_Articulo
      WHERE a.Id_Marca = 1
      LIMIT 10
    `);
    console.log(`Total líneas con artículos de marca 1: ${marcaEnPedidos.length}`);
    if (marcaEnPedidos.length > 0) {
      marcaEnPedidos.forEach((item, i) => {
        console.log(`  ${i + 1}. Pedido: ${item.Id_NumPedido || item.NumPedido}, Artículo: ${item.ArticuloNombre}, Marca: ${item.Id_Marca}`);
      });
    } else {
      console.log('  ⚠️ No se encontraron líneas de pedidos con artículos de marca 1');
    }
    
    // 5. Verificar estructura de columnas
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('5. ESTRUCTURA DE COLUMNAS:');
    console.log('═══════════════════════════════════════════════════════════');
    const estructuraArticulos = await crm.query('DESCRIBE articulos');
    console.log('Columnas de articulos:');
    estructuraArticulos.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    const estructuraPedidosArticulos = await crm.query('DESCRIBE pedidos_articulos');
    console.log('\nColumnas de pedidos_articulos:');
    estructuraPedidosArticulos.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    const estructuraPedidos = await crm.query('DESCRIBE pedidos');
    console.log('\nColumnas de pedidos:');
    estructuraPedidos.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

verificarRelaciones();
