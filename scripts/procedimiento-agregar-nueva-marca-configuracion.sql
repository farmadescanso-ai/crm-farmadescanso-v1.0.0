-- =====================================================
-- PROCEDIMIENTO PARA AGREGAR CONFIGURACIONES DE UNA NUEVA MARCA
-- =====================================================
-- Este procedimiento almacenado facilita agregar configuraciones
-- para una nueva marca sin necesidad de modificar scripts
-- =====================================================

USE farmadescanso;

-- Eliminar el procedimiento si existe
DROP PROCEDURE IF EXISTS sp_agregar_configuracion_nueva_marca;

DELIMITER $$

CREATE PROCEDURE sp_agregar_configuracion_nueva_marca(
  IN p_marca_nombre VARCHAR(255),
  IN p_año INT,
  IN p_transfer_comision DECIMAL(5,2),
  IN p_directo_comision DECIMAL(5,2),
  IN p_rappel_presupuesto DECIMAL(5,2),
  IN p_descuento_transporte DECIMAL(5,2)
)
BEGIN
  DECLARE v_marca_normalizada VARCHAR(255);
  
  -- Normalizar el nombre de la marca a mayúsculas
  SET v_marca_normalizada = UPPER(TRIM(p_marca_nombre));
  
  -- Verificar que la marca existe en la tabla Marcas
  IF NOT EXISTS (SELECT 1 FROM Marcas WHERE UPPER(Nombre) = v_marca_normalizada) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = CONCAT('La marca "', p_marca_nombre, '" no existe en la tabla Marcas. Por favor, créala primero.');
  END IF;
  
  -- 1. Insertar configuraciones de comisiones por tipo de pedido
  -- Transfer
  INSERT INTO config_comisiones_tipo_pedido (
    marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
  ) VALUES (
    v_marca_normalizada, 'Transfer', p_transfer_comision,
    CONCAT('Comisión para pedidos tipo Transfer - ', p_transfer_comision, '% - Marca ', v_marca_normalizada),
    1, p_año
  ) ON DUPLICATE KEY UPDATE
    porcentaje_comision = p_transfer_comision,
    descripcion = VALUES(descripcion),
    actualizado_en = CURRENT_TIMESTAMP;
  
  -- Directo
  INSERT INTO config_comisiones_tipo_pedido (
    marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
  ) VALUES (
    v_marca_normalizada, 'Directo', p_directo_comision,
    CONCAT('Comisión para pedidos tipo Directo - ', p_directo_comision, '% - Marca ', v_marca_normalizada),
    1, p_año
  ) ON DUPLICATE KEY UPDATE
    porcentaje_comision = p_directo_comision,
    descripcion = VALUES(descripcion),
    actualizado_en = CURRENT_TIMESTAMP;
  
  -- Normal
  INSERT INTO config_comisiones_tipo_pedido (
    marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
  ) VALUES (
    v_marca_normalizada, 'Normal', p_directo_comision,
    CONCAT('Comisión para pedidos tipo Normal - ', p_directo_comision, '% - Marca ', v_marca_normalizada),
    1, p_año
  ) ON DUPLICATE KEY UPDATE
    porcentaje_comision = p_directo_comision,
    descripcion = VALUES(descripcion),
    actualizado_en = CURRENT_TIMESTAMP;
  
  -- 2. Insertar configuración de rappel por presupuesto
  INSERT INTO config_rappel_presupuesto (
    marca, porcentaje_rappel, descripcion, activo, año_aplicable
  ) VALUES (
    v_marca_normalizada, p_rappel_presupuesto,
    CONCAT('Rappel de ', p_rappel_presupuesto, '% sobre ventas acumuladas - Marca ', v_marca_normalizada),
    1, p_año
  ) ON DUPLICATE KEY UPDATE
    porcentaje_rappel = p_rappel_presupuesto,
    descripcion = VALUES(descripcion),
    actualizado_en = CURRENT_TIMESTAMP;
  
  -- 3. Insertar configuración de descuento de transporte
  INSERT INTO config_descuento_transporte (
    marca, porcentaje_descuento, descripcion, activo, año_aplicable
  ) VALUES (
    v_marca_normalizada, p_descuento_transporte,
    CONCAT('Descuento del ', p_descuento_transporte, '% de transporte - Marca ', v_marca_normalizada),
    1, p_año
  ) ON DUPLICATE KEY UPDATE
    porcentaje_descuento = p_descuento_transporte,
    descripcion = VALUES(descripcion),
    actualizado_en = CURRENT_TIMESTAMP;
  
  SELECT CONCAT('✅ Configuraciones agregadas exitosamente para la marca: ', v_marca_normalizada) as resultado;
  
END$$

DELIMITER ;

-- =====================================================
-- EJEMPLO DE USO:
-- =====================================================
-- Para agregar una nueva marca "NUEVA_MARCA" con los valores por defecto:
-- CALL sp_agregar_configuracion_nueva_marca('NUEVA_MARCA', 2026, 5.00, 15.00, 1.00, 10.00);
--
-- O con valores personalizados:
-- CALL sp_agregar_configuracion_nueva_marca('NUEVA_MARCA', 2026, 7.00, 18.00, 1.50, 12.00);
-- =====================================================
