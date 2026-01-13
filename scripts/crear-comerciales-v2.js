// Script para crear/actualizar los dos comerciales
const mysql = require('mysql2/promise');
require('dotenv').config();

async function crearComerciales() {
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

    // Comercial 1: Rico Pérez, Cristina
    const comercial1 = {
      Nombre: 'Rico Pérez, Cristina',
      Email: 'cristina.rico@gmail.com',
      DNI: '34803665L',
      Password: '34803665L',
      Roll: '["Comercial"]',
      Movil: '636401019',
      Direccion: 'Calle Gregorio Ordoñez, 4, P05 A',
      CodigoPostal: '30010',
      Poblacion: 'Murcia'
    };

    // Comercial 2: Alberto Torralba Pizarro
    // Ajustar DNI: "48489860-H" tiene 10 caracteres, pero la columna es varchar(9)
    // Opción: quitar el guion o usar solo los primeros 9 caracteres
    const comercial2 = {
      Nombre: 'Alberto Torralba Pizarro',
      Email: 'ALBERTO.ATFARMA@GMAIL.COM',
      DNI: '48489860H', // Quitar el guion para que quepa en varchar(9)
      Password: '48489860H',
      Roll: '["Comercial"]',
      Movil: '646001185',
      Direccion: 'Carril Ruiperez, 29, 1 D',
      CodigoPostal: '30007',
      Poblacion: 'Murcia'
    };

    console.log('📝 Procesando comerciales...\n');

    // Verificar y actualizar/crear comercial 1
    const [existentes1] = await connection.query(
      'SELECT id, Nombre, Email FROM comerciales WHERE Email = ?',
      [comercial1.Email]
    );

    if (existentes1.length > 0) {
      console.log(`📝 Actualizando comercial existente: ${comercial1.Nombre} (ID: ${existentes1[0].id})...`);
      await connection.query(
        `UPDATE comerciales SET 
         Nombre = ?, DNI = ?, Movil = ?, Direccion = ?, CodigoPostal = ?, Poblacion = ?
         WHERE id = ?`,
        [
          comercial1.Nombre,
          comercial1.DNI,
          comercial1.Movil,
          comercial1.Direccion,
          comercial1.CodigoPostal,
          comercial1.Poblacion,
          existentes1[0].id
        ]
      );
      console.log(`✅ Comercial actualizado: ${comercial1.Nombre}`);
      console.log(`   Email: ${comercial1.Email}`);
      console.log(`   DNI: ${comercial1.DNI}`);
      console.log(`   Dirección: ${comercial1.Direccion}\n`);
    } else {
      console.log(`📝 Creando nuevo comercial: ${comercial1.Nombre}...`);
      await connection.query(
        `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll, Movil, Direccion, CodigoPostal, Poblacion) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comercial1.Nombre,
          comercial1.Email,
          comercial1.DNI,
          comercial1.Password,
          comercial1.Roll,
          comercial1.Movil,
          comercial1.Direccion,
          comercial1.CodigoPostal,
          comercial1.Poblacion
        ]
      );
      console.log(`✅ Comercial creado: ${comercial1.Nombre}`);
      console.log(`   Email: ${comercial1.Email}`);
      console.log(`   DNI: ${comercial1.DNI}`);
      console.log(`   Contraseña inicial: ${comercial1.Password}\n`);
    }

    // Verificar y crear comercial 2
    const [existentes2] = await connection.query(
      'SELECT id, Nombre, Email FROM comerciales WHERE Email = ?',
      [comercial2.Email]
    );

    if (existentes2.length > 0) {
      console.log(`📝 Actualizando comercial existente: ${comercial2.Nombre} (ID: ${existentes2[0].id})...`);
      await connection.query(
        `UPDATE comerciales SET 
         Nombre = ?, DNI = ?, Movil = ?, Direccion = ?, CodigoPostal = ?, Poblacion = ?
         WHERE id = ?`,
        [
          comercial2.Nombre,
          comercial2.DNI,
          comercial2.Movil,
          comercial2.Direccion,
          comercial2.CodigoPostal,
          comercial2.Poblacion,
          existentes2[0].id
        ]
      );
      console.log(`✅ Comercial actualizado: ${comercial2.Nombre}`);
      console.log(`   Email: ${comercial2.Email}`);
      console.log(`   DNI: ${comercial2.DNI} (original: 48489860-H, ajustado para varchar(9))`);
      console.log(`   Dirección: ${comercial2.Direccion}\n`);
    } else {
      console.log(`📝 Creando nuevo comercial: ${comercial2.Nombre}...`);
      await connection.query(
        `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll, Movil, Direccion, CodigoPostal, Poblacion) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comercial2.Nombre,
          comercial2.Email,
          comercial2.DNI,
          comercial2.Password,
          comercial2.Roll,
          comercial2.Movil,
          comercial2.Direccion,
          comercial2.CodigoPostal,
          comercial2.Poblacion
        ]
      );
      console.log(`✅ Comercial creado: ${comercial2.Nombre}`);
      console.log(`   Email: ${comercial2.Email}`);
      console.log(`   DNI: ${comercial2.DNI} (original: 48489860-H, ajustado para varchar(9))`);
      console.log(`   Contraseña inicial: ${comercial2.Password}\n`);
    }

    // Listar todos los comerciales
    console.log('📋 Listado de comerciales:');
    console.log('═══════════════════════════════════════════════════════════');
    const [todosComerciales] = await connection.query(
      'SELECT id, Nombre, Email, DNI, Movil, Poblacion FROM comerciales ORDER BY id DESC'
    );
    todosComerciales.forEach((c, index) => {
      console.log(`${index + 1}. ID: ${c.id}, Nombre: ${c.Nombre}`);
      console.log(`   Email: ${c.Email}, DNI: ${c.DNI}, Móvil: ${c.Movil}, Población: ${c.Poblacion}`);
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

crearComerciales();

