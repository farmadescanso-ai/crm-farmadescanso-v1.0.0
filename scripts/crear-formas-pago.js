// Script para crear las tres nuevas formas de pago
const mysql = require('mysql2/promise');
require('dotenv').config();

async function crearFormasPago() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos\n');

    // Verificar estructura de la tabla
    console.log('📋 Verificando estructura de la tabla formas_pago...');
    const [columns] = await connection.query('DESCRIBE formas_pago');
    console.log('Columnas encontradas:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    console.log('');

    // Verificar formas de pago existentes
    const [existentes] = await connection.query('SELECT * FROM formas_pago ORDER BY id ASC');
    console.log(`📋 Formas de pago existentes: ${existentes.length}`);
    existentes.forEach(fp => {
      console.log(`  - ID: ${fp.id}, FormaPago: ${fp.FormaPago}, Dias: ${fp.Dias || 'N/A'}`);
    });
    console.log('');

    // Formas de pago a crear
    const nuevasFormasPago = [
      { nombre: 'Hefame', dias: 30 },
      { nombre: 'Cofares', dias: 30 },
      { nombre: 'Alliance', dias: 30 }
    ];

    console.log('📝 Creando nuevas formas de pago...\n');
    
    for (const formaPago of nuevasFormasPago) {
      // Verificar si ya existe
      const [existentes] = await connection.query(
        'SELECT * FROM formas_pago WHERE FormaPago = ?',
        [formaPago.nombre]
      );

      if (existentes.length > 0) {
        console.log(`⚠️  "${formaPago.nombre}" ya existe (ID: ${existentes[0].id})`);
      } else {
        // Insertar nueva forma de pago
        // Intentar con diferentes estructuras de columnas
        try {
          // Intentar con FormaPago y Dias
          await connection.query(
            'INSERT INTO formas_pago (FormaPago, Dias) VALUES (?, ?)',
            [formaPago.nombre, formaPago.dias]
          );
          console.log(`✅ Creada: "${formaPago.nombre}" (${formaPago.dias} días)`);
        } catch (error) {
          // Si falla, intentar solo con FormaPago
          try {
            await connection.query(
              'INSERT INTO formas_pago (FormaPago) VALUES (?)',
              [formaPago.nombre]
            );
            console.log(`✅ Creada: "${formaPago.nombre}" (sin días especificados)`);
          } catch (error2) {
            console.error(`❌ Error creando "${formaPago.nombre}":`, error2.message);
          }
        }
      }
    }

    console.log('\n📋 Formas de pago finales:');
    const [todas] = await connection.query('SELECT * FROM formas_pago ORDER BY id ASC');
    todas.forEach(fp => {
      console.log(`  - ID: ${fp.id}, FormaPago: ${fp.FormaPago}, Dias: ${fp.Dias || 'N/A'}`);
    });

    console.log('\n✅ Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

crearFormasPago();

