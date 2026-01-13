-- Script para agregar campo de emails de invitados a la tabla visitas
ALTER TABLE `visitas` 
ADD COLUMN IF NOT EXISTS `emails_invitados` TEXT NULL COMMENT 'Emails de los invitados a la reunión, separados por comas';

