// Script para crear datos de prueba del sistema de comisiones
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
require('dotenv').config();

async function crearDatosPrueba() {
    try {
        await crm.connect();
        console.log('🔌 Conectado a la base de datos\n');

        // 1. Obtener comerciales
        const comerciales = await crm.getComerciales();
        if (comerciales.length === 0) {
            console.log('⚠️ No hay comerciales en la base de datos. Crea algunos comerciales primero.');
            return;
        }
        console.log(`📋 Comerciales encontrados: ${comerciales.length}`);

        // 2. Obtener artículos
        const articulos = await crm.getArticulos();
        if (articulos.length === 0) {
            console.log('⚠️ No hay artículos en la base de datos. Crea algunos artículos primero.');
            return;
        }
        console.log(`📋 Artículos encontrados: ${articulos.length}`);

        // 3. Obtener marcas únicas
        const marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];
        console.log(`📋 Marcas encontradas: ${marcas.join(', ')}\n`);

        const añoActual = new Date().getFullYear();

        // 4. Crear presupuestos de ejemplo
        console.log('📝 Creando presupuestos de ejemplo...');
        const comercial1 = comerciales[0];
        const articulo1 = articulos[0];
        const articulo2 = articulos[1] || articulos[0];

        try {
            const presupuesto1 = await comisionesCRM.createPresupuesto({
                comercial_id: comercial1.id || comercial1.Id,
                articulo_id: articulo1.id || articulo1.Id,
                año: añoActual,
                cantidad_presupuestada: 100,
                importe_presupuestado: 5000.00,
                porcentaje_comision: 3.00,
                activo: 1,
                observaciones: 'Presupuesto de prueba',
                creado_por: comercial1.id || comercial1.Id
            });
            console.log(`✅ Presupuesto creado: ID ${presupuesto1.id}`);

            if (comerciales.length > 1 && articulos.length > 1) {
                const presupuesto2 = await comisionesCRM.createPresupuesto({
                    comercial_id: comerciales[1].id || comerciales[1].Id,
                    articulo_id: articulo2.id || articulo2.Id,
                    año: añoActual,
                    cantidad_presupuestada: 150,
                    importe_presupuestado: 7500.00,
                    porcentaje_comision: 3.00,
                    activo: 1,
                    observaciones: 'Presupuesto de prueba 2',
                    creado_por: comerciales[1].id || comerciales[1].Id
                });
                console.log(`✅ Presupuesto creado: ID ${presupuesto2.id}`);
            }
        } catch (error) {
            if (error.message.includes('Duplicate entry')) {
                console.log('⚠️ Los presupuestos de prueba ya existen');
            } else {
                throw error;
            }
        }

        // 5. Crear objetivos por marca (solo si hay marcas)
        if (marcas.length > 0 && comerciales.length > 0) {
            console.log('\n📝 Creando objetivos por marca...');
            const marca1 = marcas[0];
            const trimestre1 = Math.ceil(new Date().getMonth() / 3) + 1; // Trimestre actual

            try {
                const objetivo1 = await comisionesCRM.saveObjetivoMarca({
                    comercial_id: comercial1.id || comercial1.Id,
                    marca: marca1,
                    trimestre: trimestre1,
                    año: añoActual,
                    objetivo: 10000.00,
                    activo: 1,
                    observaciones: 'Objetivo de prueba'
                });
                console.log(`✅ Objetivo por marca creado: ID ${objetivo1.id}`);
            } catch (error) {
                if (error.message.includes('Duplicate entry')) {
                    console.log('⚠️ El objetivo de prueba ya existe');
                } else {
                    throw error;
                }
            }
        }

        // 6. Crear configuración de rapeles
        if (marcas.length > 0) {
            console.log('\n📝 Creando configuración de rapeles...');
            const marca1 = marcas[0];

            try {
                const config1 = await comisionesCRM.createRapelConfiguracion({
                    marca: marca1,
                    porcentaje_cumplimiento_min: 80.00,
                    porcentaje_cumplimiento_max: 100.00,
                    porcentaje_rapel: 2.00,
                    activo: 1,
                    observaciones: 'Rapel 80-100%'
                });
                console.log(`✅ Configuración de rapel creada: ID ${config1.id}`);

                const config2 = await comisionesCRM.createRapelConfiguracion({
                    marca: marca1,
                    porcentaje_cumplimiento_min: 100.00,
                    porcentaje_cumplimiento_max: 120.00,
                    porcentaje_rapel: 3.00,
                    activo: 1,
                    observaciones: 'Rapel 100-120%'
                });
                console.log(`✅ Configuración de rapel creada: ID ${config2.id}`);

                const config3 = await comisionesCRM.createRapelConfiguracion({
                    marca: marca1,
                    porcentaje_cumplimiento_min: 120.00,
                    porcentaje_cumplimiento_max: 999.00,
                    porcentaje_rapel: 5.00,
                    activo: 1,
                    observaciones: 'Rapel +120%'
                });
                console.log(`✅ Configuración de rapel creada: ID ${config3.id}`);
            } catch (error) {
                if (error.message.includes('Duplicate entry')) {
                    console.log('⚠️ Las configuraciones de rapel ya existen');
                } else {
                    throw error;
                }
            }
        }

        // 7. Actualizar fijo mensual de algunos comerciales
        console.log('\n📝 Actualizando fijo mensual de comerciales...');
        for (let i = 0; i < Math.min(2, comerciales.length); i++) {
            const comercial = comerciales[i];
            try {
                await crm.query(
                    'UPDATE comerciales SET fijo_mensual = ? WHERE id = ?',
                    [1500.00, comercial.id || comercial.Id]
                );
                console.log(`✅ Fijo mensual actualizado para: ${comercial.Nombre || comercial.nombre}`);
            } catch (error) {
                console.error(`❌ Error actualizando fijo mensual para ${comercial.Nombre}:`, error.message);
            }
        }

        console.log('\n✅ Datos de prueba creados exitosamente');
        console.log('\n📋 Resumen:');
        console.log(`   - Presupuestos: 1-2 creados`);
        console.log(`   - Objetivos por marca: 1 creado`);
        console.log(`   - Configuraciones de rapel: 3 creadas`);
        console.log(`   - Fijo mensual: actualizado para ${Math.min(2, comerciales.length)} comerciales`);

    } catch (error) {
        console.error('❌ Error creando datos de prueba:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await crm.disconnect();
        console.log('\n🔌 Conexión cerrada');
    }
}

crearDatosPrueba();

