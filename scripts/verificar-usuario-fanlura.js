// Script para verificar y actualizar las credenciales del usuario fanlura@gmail.com
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarUsuario() {
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

    const email = 'fanlura@gmail.com';
    const dni = '25976934D';

    // Buscar el usuario
    const [usuarios] = await connection.query(
      'SELECT * FROM comerciales WHERE Email = ? OR email = ?',
      [email, email]
    );

    if (usuarios.length === 0) {
      console.log(`❌ No se encontró ningún usuario con el email: ${email}`);
      console.log('\n📝 Creando nuevo usuario...');
      
      const [result] = await connection.query(
        `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll) 
         VALUES (?, ?, ?, ?, ?)`,
        ['Luque Ramos, F. Antonio', email, dni, dni, '["Comercial"]']
      );
      
      console.log(`✅ Usuario creado con ID: ${result.insertId}`);
      console.log(`   Email: ${email}`);
      console.log(`   DNI: ${dni}`);
      console.log(`   Password: ${dni}`);
    } else {
      const usuario = usuarios[0];
      console.log(`✅ Usuario encontrado:`);
      console.log(`   ID: ${usuario.Id || usuario.id}`);
      console.log(`   Nombre: ${usuario.Nombre || usuario.nombre}`);
      console.log(`   Email: ${usuario.Email || usuario.email}`);
      console.log(`   DNI actual: ${usuario.DNI || usuario.dni || 'NO CONFIGURADO'}`);
      console.log(`   Password actual: ${usuario.Password || usuario.password || 'NO CONFIGURADO'}`);
      console.log(`   Roll: ${usuario.Roll || usuario.roll || 'NO CONFIGURADO'}\n`);

      // Verificar si necesita actualización
      const necesitaActualizacion = 
        (usuario.DNI !== dni && usuario.dni !== dni) ||
        (usuario.Password !== dni && usuario.password !== dni);

      if (necesitaActualizacion) {
        console.log('📝 Actualizando credenciales...');
        await connection.query(
          `UPDATE comerciales SET 
           DNI = ?, Password = ?
           WHERE ${usuario.Id ? 'Id' : 'id'} = ?`,
          [dni, dni, usuario.Id || usuario.id]
        );
        console.log(`✅ Credenciales actualizadas:`);
        console.log(`   DNI: ${dni}`);
        console.log(`   Password: ${dni}`);
      } else {
        console.log('✅ Las credenciales ya están correctas.');
      }
    }

    // Verificar el login
    console.log('\n🔍 Verificando credenciales...');
    const [verificacion] = await connection.query(
      'SELECT Id, Nombre, Email, DNI, Password FROM comerciales WHERE (Email = ? OR email = ?) AND (Password = ? OR DNI = ?)',
      [email, email, dni, dni]
    );

    if (verificacion.length > 0) {
      console.log('✅ Las credenciales son correctas. El usuario puede iniciar sesión con:');
      console.log(`   Email: ${email}`);
      console.log(`   Contraseña: ${dni}`);
    } else {
      console.log('❌ Error: Las credenciales no coinciden después de la actualización.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

verificarUsuario();
