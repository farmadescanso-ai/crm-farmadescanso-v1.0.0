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
END
