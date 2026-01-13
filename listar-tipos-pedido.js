// Script para listar los tipos de pedido
const crm = require('./config/mysql-crm');

async function listarTiposPedido() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Verificar si existe la tabla
    console.log('🔍 Verificando tabla tipos_pedido...\n');
    
    try {
      // Intentar obtener la estructura de la tabla (el nombre correcto es tipos_pedidos con 's')
      const estructura = await crm.query('DESCRIBE tipos_pedidos');
      
      console.log('📋 Estructura de la tabla tipos_pedidos:');
      console.log('═══════════════════════════════════════════════════════════');
      estructura.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default || 'NULL'}`);
      });
      console.log('═══════════════════════════════════════════════════════════\n');

      // Obtener todos los tipos de pedido
      const tipos = await crm.query('SELECT * FROM tipos_pedidos ORDER BY id ASC');
      
      if (tipos && tipos.length > 0) {
        console.log(`📋 Tipos de pedido encontrados (${tipos.length}):`);
        console.log('═══════════════════════════════════════════════════════════');
        tipos.forEach((tipo, index) => {
          console.log(`\n${index + 1}. ID: ${tipo.id || tipo.Id || 'N/A'}`);
          console.log(`   Nombre: ${tipo.Nombre || tipo.nombre || tipo.TipoPedido || tipo.tipo_pedido || 'N/A'}`);
          // Mostrar todas las columnas disponibles
          const columnas = Object.keys(tipo).filter(k => k !== 'id' && k !== 'Id' && k !== 'Nombre' && k !== 'nombre' && k !== 'TipoPedido' && k !== 'tipo_pedido');
          if (columnas.length > 0) {
            columnas.forEach(col => {
              console.log(`   ${col}: ${tipo[col]}`);
            });
          }
        });
        console.log('\n═══════════════════════════════════════════════════════════');
      } else {
        console.log('⚠️ La tabla tipos_pedidos existe pero está vacía');
      }
    } catch (error) {
      console.log('❌ Error accediendo a la tabla tipos_pedidos:');
      console.log(`   Mensaje: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);
      
      // Intentar verificar si la tabla existe con otro método
      console.log('\n🔍 Verificando si la tabla existe con SHOW TABLES...');
      try {
        const tablas = await crm.query("SHOW TABLES LIKE 'tipos%'");
        if (tablas && tablas.length > 0) {
          console.log('📋 Tablas encontradas que empiezan con "tipos":');
          tablas.forEach(tabla => {
            const nombreTabla = Object.values(tabla)[0];
            console.log(`   - ${nombreTabla}`);
          });
        } else {
          console.log('⚠️ No se encontraron tablas que empiecen con "tipos"');
        }
      } catch (showError) {
        console.log(`❌ Error ejecutando SHOW TABLES: ${showError.message}`);
      }
    }

    await crm.disconnect();
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

listarTiposPedido();

