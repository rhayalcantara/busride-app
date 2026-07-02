-- ============================================================
-- BusRide - Forzar cambio de la password del admin seed (auditoría, paso 4)
--
-- 1) Parche de schema para BDs existentes (las nuevas ya traen la columna
--    desde 02_schema.sql): usuarios.debe_cambiar_password.
-- 2) Marca al admin seed SOLO si su hash sigue siendo el publicado en el
--    repo (04_seed_admin.sql): esa credencial es pública y en producción el
--    backend bloquea el API hasta que se cambie (PasswordCaducadaGuard).
--    Si el admin ya cambió su password, el hash difiere y no se re-marca.
--
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ============================================================

USE busride_db;
GO

IF COL_LENGTH('usuarios', 'debe_cambiar_password') IS NULL
BEGIN
    ALTER TABLE usuarios ADD debe_cambiar_password BIT NOT NULL DEFAULT 0;
    PRINT 'Columna usuarios.debe_cambiar_password añadida.';
END
GO

UPDATE usuarios
SET debe_cambiar_password = 1
WHERE email = 'admin@busride.do'
  -- bcrypt publicado en 04_seed_admin.sql ('Admin123!cambiar')
  AND password_hash = '$2b$12$ycZLb3MS6Ou5NoDeZ33KXemULi4Mh1Y/I.3Z9FXLX1pa.Q6ep85Ey'
  AND debe_cambiar_password = 0;

IF @@ROWCOUNT > 0
    PRINT 'Admin seed marcado: debe cambiar su password (credencial publica).';
GO
