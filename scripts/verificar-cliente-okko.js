// Script para verificar el valor de OK_KO del cliente Hernandez Rodrigo, David Emilio
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarCliente() {
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

    // Buscar el cliente
    const [clientes] = await connection.query(
      `SELECT Id, Nombre_Razon_Social, OK_KO,
       CASE 
         WHEN OK_KO IS NULL THEN 'NULL'
         WHEN OK_KO = 0 THEN '0 (Inactivo)'
         WHEN OK_KO = 1 THEN '1 (Activo)'
         WHEN OK_KO = 'OK' THEN 'OK (Activo)'
         WHEN OK_KO = 'KO' THEN 'KO (Inactivo)'
         ELSE CONCAT('Otro: ', CAST(OK_KO AS CHAR))
       END as interpretacion
       FROM clientes 
       WHERE Nombre_Razon_Social LIKE '%Hernandez%Rodrigo%David%Emilio%' 
          OR Nombre_Razon_Social LIKE '%Hernandez Rodrigo%'
          OR Nombre_Razon_Social LIKE '%Rodrigo%David%'
       ORDER BY Id DESC
       LIMIT 5`
    );

    if (clientes.length === 0) {
      console.log('⚠️  No se encontró el cliente. Buscando variaciones...\n');
      
      // Buscar con diferentes variaciones
      const [todos] = await connection.query(
        `SELECT Id, Nombre_Razon_Social, OK_KO FROM clientes 
         WHERE Nombre_Razon_Social LIKE '%Hernandez%' 
            OR Nombre_Razon_Social LIKE '%Rodrigo%'
         ORDER BY Id DESC
         LIMIT 10`
      );
      
      console.log('Clientes encontrados con nombres similares:');
      todos.forEach(c => {
        console.log(`  ID: ${c.Id}, Nombre: ${c.Nombre_Razon_Social}, OK_KO: ${c.OK_KO} (tipo: ${typeof c.OK_KO})`);
      });
    } else {
      console.log('📋 Cliente encontrado:');
      console.log('═══════════════════════════════════════════════════════════');
      clientes.forEach(c => {
        console.log(`  ID: ${c.Id}`);
        console.log(`  Nombre: ${c.Nombre_Razon_Social}`);
        console.log(`  OK_KO: ${c.OK_KO} (tipo en JS: ${typeof c.OK_KO})`);
        console.log(`  Interpretación: ${c.interpretacion}`);
        
        // Probar la lógica de interpretación
        let estadoActivo = false;
        const okKo = c.OK_KO;
        
        if (okKo === null || okKo === undefined) {
          console.log(`  ⚠️  OK_KO es NULL/undefined - usando valor por defecto: Activo`);
          estadoActivo = true;
        } else if (typeof okKo === 'string') {
          estadoActivo = (okKo.toUpperCase().trim() === 'OK');
          console.log(`  ✅ Interpretado como string: ${estadoActivo ? 'Activo' : 'Inactivo'}`);
        } else if (typeof okKo === 'number') {
          estadoActivo = (okKo === 1);
          console.log(`  ✅ Interpretado como number: ${estadoActivo ? 'Activo' : 'Inactivo'}`);
        } else if (typeof okKo === 'boolean') {
          estadoActivo = okKo;
          console.log(`  ✅ Interpretado como boolean: ${estadoActivo ? 'Activo' : 'Inactivo'}`);
        } else {
          estadoActivo = true;
          console.log(`  ⚠️  Tipo desconocido - usando valor por defecto: Activo`);
        }
        
        console.log(`  Estado final: ${estadoActivo ? '✅ Activo' : '❌ Inactivo'}`);
        console.log('');
      });
      console.log('═══════════════════════════════════════════════════════════');
    }

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

verificarCliente();

