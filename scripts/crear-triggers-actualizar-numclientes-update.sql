-- Trigger después de UPDATE en Clientes
CREATE TRIGGER trg_clientes_update_numclientes
AFTER UPDATE ON Clientes
FOR EACH ROW
BEGIN
    -- Si cambió el código postal o el estado activo, actualizar ambos códigos postales
    IF (OLD.Id_CodigoPostal != NEW.Id_CodigoPostal) 
       OR (OLD.CodigoPostal != NEW.CodigoPostal)
       OR (CAST(OLD.OK_KO AS CHAR) != CAST(NEW.OK_KO AS CHAR)) THEN
        
        -- Actualizar el código postal antiguo (si existe)
        IF OLD.Id_CodigoPostal IS NOT NULL THEN
            UPDATE Codigos_Postales 
            SET NumClientes = (
                SELECT COUNT(*) 
                FROM Clientes c
                WHERE c.Id_CodigoPostal = OLD.Id_CodigoPostal
                  AND (
                    CAST(c.OK_KO AS CHAR) = '1'
                    OR CAST(c.OK_KO AS CHAR) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
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
                    CAST(c.OK_KO AS CHAR) = '1'
                    OR CAST(c.OK_KO AS CHAR) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
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
                    CAST(c.OK_KO AS CHAR) = '1'
                    OR CAST(c.OK_KO AS CHAR) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
                    OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
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
