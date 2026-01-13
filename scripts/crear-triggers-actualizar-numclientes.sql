-- ============================================
-- Script para crear triggers que actualicen automáticamente
-- el número de clientes en Codigos_Postales
-- ============================================

-- Eliminar triggers si existen
DROP TRIGGER IF EXISTS trg_clientes_insert_numclientes;
DROP TRIGGER IF EXISTS trg_clientes_update_numclientes;
DROP TRIGGER IF EXISTS trg_clientes_delete_numclientes;

-- Función para actualizar NumClientes de un código postal
DELIMITER $$

-- Trigger después de INSERT en Clientes
CREATE TRIGGER trg_clientes_insert_numclientes
AFTER INSERT ON Clientes
FOR EACH ROW
BEGIN
    -- Actualizar si el cliente está activo
    -- OK_KO puede ser 1, 'OK', 'Activo', o NULL para clientes activos
    IF (NEW.OK_KO = 1 OR NEW.OK_KO = '1' 
        OR UPPER(TRIM(NEW.OK_KO)) = 'OK' 
        OR UPPER(TRIM(NEW.OK_KO)) = 'ACTIVO'
        OR NEW.OK_KO IS NULL) THEN
        -- Actualizar por Id_CodigoPostal
        IF NEW.Id_CodigoPostal IS NOT NULL THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.Id_CodigoPostal = NEW.Id_CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE id = NEW.Id_CodigoPostal;
        END IF;
        
        -- Actualizar por CodigoPostal (texto)
        IF NEW.CodigoPostal IS NOT NULL AND NEW.CodigoPostal != '' THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.CodigoPostal = NEW.CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE CodigoPostal = NEW.CodigoPostal;
        END IF;
    END IF;
END$$

-- Trigger después de UPDATE en Clientes
CREATE TRIGGER trg_clientes_update_numclientes
AFTER UPDATE ON Clientes
FOR EACH ROW
BEGIN
    -- Si cambió el código postal o el estado activo, actualizar ambos códigos postales
    IF (OLD.Id_CodigoPostal != NEW.Id_CodigoPostal) 
       OR (OLD.CodigoPostal != NEW.CodigoPostal)
       OR (OLD.OK_KO != NEW.OK_KO) THEN
        
        -- Actualizar el código postal antiguo (si existe)
        IF OLD.Id_CodigoPostal IS NOT NULL THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.Id_CodigoPostal = OLD.Id_CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE id = OLD.Id_CodigoPostal;
        END IF;
        
        IF OLD.CodigoPostal IS NOT NULL AND OLD.CodigoPostal != '' THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.CodigoPostal = OLD.CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE CodigoPostal = OLD.CodigoPostal;
        END IF;
        
        -- Actualizar el código postal nuevo (si existe)
        IF NEW.Id_CodigoPostal IS NOT NULL THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.Id_CodigoPostal = NEW.Id_CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE id = NEW.Id_CodigoPostal;
        END IF;
        
        IF NEW.CodigoPostal IS NOT NULL AND NEW.CodigoPostal != '' THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.CodigoPostal = NEW.CodigoPostal
                  AND (
                    c.OK_KO = 1 OR c.OK_KO = '1'
                    OR UPPER(TRIM(c.OK_KO)) = 'OK'
                    OR UPPER(TRIM(c.OK_KO)) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE CodigoPostal = NEW.CodigoPostal;
        END IF;
    END IF;
END$$

-- Trigger después de DELETE en Clientes
CREATE TRIGGER trg_clientes_delete_numclientes
AFTER DELETE ON Clientes
FOR EACH ROW
BEGIN
    -- Actualizar el código postal del cliente eliminado
    IF OLD.Id_CodigoPostal IS NOT NULL THEN
        UPDATE Codigos_Postales 
        SET NumClientes = (
            SELECT COUNT(*) 
            FROM Clientes c
            WHERE c.Id_CodigoPostal = OLD.Id_CodigoPostal
              AND (c.OK_KO = 1 OR c.OK_KO IS NULL)
        )
        WHERE id = OLD.Id_CodigoPostal;
    END IF;
    
    IF OLD.CodigoPostal IS NOT NULL AND OLD.CodigoPostal != '' THEN
        UPDATE Codigos_Postales 
        SET NumClientes = (
            SELECT COUNT(*) 
            FROM Clientes c
            WHERE c.CodigoPostal = OLD.CodigoPostal
              AND (c.OK_KO = 1 OR c.OK_KO IS NULL)
        )
        WHERE CodigoPostal = OLD.CodigoPostal;
    END IF;
END$$

DELIMITER ;

-- Verificar que los triggers se crearon correctamente
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME LIKE 'trg_clientes_%_numclientes'
ORDER BY TRIGGER_NAME;
