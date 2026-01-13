// Script para crear tipos de pedido por defecto
const crm = require('./config/mysql-crm');

async function crearTiposPedido() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Verificar tipos existentes
    const tiposExistentes = await crm.query('SELECT * FROM tipos_pedidos');
    console.log(`📋 Tipos de pedido existentes: ${tiposExistentes.length}\n`);

    if (tiposExistentes.length === 0) {
      console.log('📝 Creando tipos de pedido por defecto...\n');
      
      // Crear tipos de pedido comunes
      const tipos = [
        { Tipo: 'Normal' },
        { Tipo: 'Transfer Hefame' },
        { Tipo: 'Transfer Alliance' },
        { Tipo: 'Transfer Cofares' }
      ];

      for (const tipo of tipos) {
        try {
          const resultado = await crm.query('INSERT INTO tipos_pedidos (Tipo) VALUES (?)', [tipo.Tipo]);
          console.log(`✅ Tipo de pedido creado: "${tipo.Tipo}" (ID: ${resultado.insertId || 'N/A'})`);
        } catch (error) {
          console.error(`❌ Error creando tipo "${tipo.Tipo}": ${error.message}`);
        }
      }
    } else {
      console.log('📋 Tipos de pedido existentes:');
      tiposExistentes.forEach((tipo, index) => {
        console.log(`  ${index + 1}. ID: ${tipo.id}, Tipo: ${tipo.Tipo}`);
      });
    }

    // Mostrar todos los tipos después de crear
    console.log('\n📋 Lista completa de tipos de pedido:');
    console.log('═══════════════════════════════════════════════════════════');
    const todosLosTipos = await crm.query('SELECT * FROM tipos_pedidos ORDER BY id ASC');
    todosLosTipos.forEach((tipo, index) => {
      console.log(`${index + 1}. ID: ${tipo.id}, Tipo: ${tipo.Tipo}`);
    });
    console.log('═══════════════════════════════════════════════════════════');

    await crm.disconnect();
    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

crearTiposPedido();

