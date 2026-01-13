-- Trigger después de INSERT en Clientes
CREATE TRIGGER trg_clientes_insert_numclientes
AFTER INSERT ON Clientes
FOR EACH ROW
BEGIN
    -- Actualizar si el cliente está activo
    -- OK_KO puede ser 1, 'OK', 'Activo', o NULL para clientes activos
    IF (CAST(NEW.OK_KO AS CHAR) = '1' 
        OR CAST(NEW.OK_KO AS CHAR) = 'OK'
        OR UPPER(TRIM(CAST(NEW.OK_KO AS CHAR))) = 'OK'
        OR UPPER(TRIM(CAST(NEW.OK_KO AS CHAR))) = 'ACTIVO'
        OR NEW.OK_KO IS NULL) THEN
        -- Actualizar por Id_CodigoPostal
        IF NEW.Id_CodigoPostal IS NOT NULL THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.Id_CodigoPostal = NEW.Id_CodigoPostal
                  AND (
                    CAST(c.OK_KO AS CHAR) = '1'
                    OR CAST(c.OK_KO AS CHAR) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
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
                    CAST(c.OK_KO AS CHAR) = '1'
                    OR CAST(c.OK_KO AS CHAR) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
                    OR c.OK_KO IS NULL
                  )
            )
            WHERE CodigoPostal = NEW.CodigoPostal;
        END IF;
    END IF;
END
