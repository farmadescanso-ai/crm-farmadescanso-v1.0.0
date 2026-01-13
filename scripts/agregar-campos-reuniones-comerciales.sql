-- Script para agregar campos de credenciales de reuniones a la tabla comerciales
-- Estos campos almacenarán tokens/credenciales para generar reuniones automáticamente

ALTER TABLE `comerciales` 
ADD COLUMN IF NOT EXISTS `teams_access_token` TEXT NULL COMMENT 'Token de acceso de Microsoft Teams (OAuth2)',
ADD COLUMN IF NOT EXISTS `teams_refresh_token` TEXT NULL COMMENT 'Token de refresco de Microsoft Teams',
ADD COLUMN IF NOT EXISTS `teams_email` VARCHAR(255) NULL COMMENT 'Email de la cuenta de Microsoft Teams',
ADD COLUMN IF NOT EXISTS `teams_token_expires_at` DATETIME NULL COMMENT 'Fecha de expiración del token de Teams',
ADD COLUMN IF NOT EXISTS `meet_access_token` TEXT NULL COMMENT 'Token de acceso de Google Meet (OAuth2)',
ADD COLUMN IF NOT EXISTS `meet_refresh_token` TEXT NULL COMMENT 'Token de refresco de Google Meet',
ADD COLUMN IF NOT EXISTS `meet_email` VARCHAR(255) NULL COMMENT 'Email de la cuenta de Google Meet',
ADD COLUMN IF NOT EXISTS `meet_token_expires_at` DATETIME NULL COMMENT 'Fecha de expiración del token de Meet',
ADD COLUMN IF NOT EXISTS `plataforma_reunion_preferida` VARCHAR(50) NULL DEFAULT 'meet' COMMENT 'Plataforma preferida: teams o meet';

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS `idx_comerciales_teams_email` ON `comerciales`(`teams_email`);
CREATE INDEX IF NOT EXISTS `idx_comerciales_meet_email` ON `comerciales`(`meet_email`);

