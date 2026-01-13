// Script para crear/actualizar el comercial F. Antonio Luque Ramos
const mysql = require('mysql2/promise');
require('dotenv').config();

async function crearComercial() {
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

    // Datos del comercial
    const comercial = {
      Nombre: 'Luque Ramos, F. Antonio',
      Email: 'fanlura@gmail.com',
      DNI: '', // Se pedirá al usuario si no está
      Password: '', // Se usará el DNI como contraseña inicial
      Roll: '["Comercial"]',
      Movil: '684109004', // +34 684 10 90 04 -> sin espacios ni prefijo
      Direccion: 'Calle Donantes de Sangre, 9 , 3º Izda.',
      CodigoPostal: '23002',
      Poblacion: 'Jaén'
    };

    // Obtener DNI de los argumentos o pedirlo
    const args = process.argv.slice(2);
    if (args.length > 0 && args[0]) {
      comercial.DNI = args[0].toUpperCase().trim();
      comercial.Password = comercial.DNI; // Usar DNI como password inicial
    } else {
      console.log('⚠️  No se proporcionó DNI. Usando valor temporal "PENDIENTE".');
      console.log('   Para agregarlo después, ejecuta: node scripts/crear-comercial-antonio-luque.js [DNI]\n');
      comercial.DNI = 'PENDIENTE';
      comercial.Password = 'PENDIENTE';
    }

    console.log('📝 Procesando comercial...\n');
    console.log(`   Nombre: ${comercial.Nombre}`);
    console.log(`   Email: ${comercial.Email}`);
    console.log(`   DNI: ${comercial.DNI}`);
    console.log(`   Móvil: +34 ${comercial.Movil}`);
    console.log(`   Dirección: ${comercial.Direccion}`);
    console.log(`   Código Postal: ${comercial.CodigoPostal}`);
    console.log(`   Población: ${comercial.Poblacion}\n`);

    // Verificar si ya existe por email
    const [existentes] = await connection.query(
      'SELECT id, Nombre, Email, DNI FROM comerciales WHERE Email = ? OR (DNI = ? AND DNI != "PENDIENTE")',
      [comercial.Email, comercial.DNI]
    );

    if (existentes.length > 0) {
      const existente = existentes[0];
      console.log(`📝 Comercial existente encontrado:`);
      console.log(`  ID: ${existente.id}`);
      console.log(`  Nombre: ${existente.Nombre}`);
      console.log(`  Email: ${existente.Email}`);
      console.log(`  DNI: ${existente.DNI}\n`);
      
      console.log(`📝 Actualizando datos del comercial...`);
      await connection.query(
        `UPDATE comerciales SET 
         Nombre = ?, DNI = ?, Password = ?, Movil = ?, Direccion = ?, CodigoPostal = ?, Poblacion = ?
         WHERE id = ?`,
        [
          comercial.Nombre,
          comercial.DNI,
          comercial.Password,
          comercial.Movil,
          comercial.Direccion,
          comercial.CodigoPostal,
          comercial.Poblacion,
          existente.id
        ]
      );
      console.log(`✅ Comercial actualizado: ${comercial.Nombre}`);
      console.log(`   Email: ${comercial.Email}`);
      console.log(`   DNI: ${comercial.DNI}`);
      console.log(`   Dirección: ${comercial.Direccion}\n`);
    } else {
      console.log(`📝 Creando nuevo comercial: ${comercial.Nombre}...`);
      const [result] = await connection.query(
        `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll, Movil, Direccion, CodigoPostal, Poblacion) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comercial.Nombre,
          comercial.Email,
          comercial.DNI,
          comercial.Password,
          comercial.Roll,
          comercial.Movil,
          comercial.Direccion,
          comercial.CodigoPostal,
          comercial.Poblacion
        ]
      );
      console.log(`✅ Comercial creado: ${comercial.Nombre}`);
      console.log(`   ID asignado: ${result.insertId}`);
      console.log(`   Email: ${comercial.Email}`);
      console.log(`   DNI: ${comercial.DNI}`);
      console.log(`   Contraseña inicial: ${comercial.Password}`);
      console.log(`   Dirección: ${comercial.Direccion}\n`);
    }

    // Listar todos los comerciales
    console.log('📋 Listado de comerciales:');
    console.log('═══════════════════════════════════════════════════════════');
    const [todosComerciales] = await connection.query(
      'SELECT id, Nombre, Email, DNI, Movil, Poblacion FROM comerciales ORDER BY id DESC'
    );
    todosComerciales.forEach((c, index) => {
      console.log(`${index + 1}. ID: ${c.id}, Nombre: ${c.Nombre}`);
      console.log(`   Email: ${c.Email}, DNI: ${c.DNI || 'N/A'}, Móvil: ${c.Movil || 'N/A'}, Población: ${c.Poblacion || 'N/A'}`);
    });
    console.log('═══════════════════════════════════════════════════════════');

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

crearComercial();
