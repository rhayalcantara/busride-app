-- ============================================================
-- BusRide - Usuario de aplicación con privilegios mínimos (auditoría, paso 4)
--
-- El backend NO debe conectarse como sa. Este script crea (o rota la password
-- de) el login busride_app y le concede solo lo que la app usa:
--   - db_datareader / db_datawriter  (CRUD vía TypeORM y SQL crudo)
--   - EXECUTE                        (stored procedures sp_*)
-- Sin permisos DDL: el schema lo gestionan estos scripts de init con sa.
--
-- La password llega como variable de sqlcmd:
--   sqlcmd -v APP_DB_PASSWORD="..." -i 05_app_user.sql
-- Idempotente: re-ejecutar sincroniza la password con el valor del entorno.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'busride_app')
    CREATE LOGIN busride_app WITH PASSWORD = '$(APP_DB_PASSWORD)', CHECK_POLICY = ON;
ELSE
    ALTER LOGIN busride_app WITH PASSWORD = '$(APP_DB_PASSWORD)';
GO

USE busride_db;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'busride_app')
    CREATE USER busride_app FOR LOGIN busride_app;
GO

ALTER ROLE db_datareader ADD MEMBER busride_app;
ALTER ROLE db_datawriter ADD MEMBER busride_app;
GRANT EXECUTE TO busride_app;
GO

PRINT 'Usuario de aplicación busride_app listo (datareader + datawriter + execute).';
GO
