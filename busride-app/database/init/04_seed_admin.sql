-- ============================================================
-- BusRide - Seed del administrador inicial (B1, Ola 6)
--
-- El registro público (POST /auth/registrar) solo crea pasajeros;
-- los demás roles se crean vía POST /auth/usuarios con token admin.
-- Este seed garantiza que exista un PRIMER admin para arrancar.
--
-- Credenciales iniciales:
--   email:    admin@busride.do
--   password: Admin123!cambiar   <<< CAMBIAR EN PRODUCCIÓN >>>
--
-- Idempotente: no hace nada si el email ya existe.
-- ============================================================

USE busride_db;
GO

IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@busride.do')
BEGIN
    INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, activo, verificado)
    SELECT 'admin@busride.do',
           -- bcrypt cost 12 de 'Admin123!cambiar'
           '$2b$12$ycZLb3MS6Ou5NoDeZ33KXemULi4Mh1Y/I.3Z9FXLX1pa.Q6ep85Ey',
           'Admin', 'BusRide', r.id, 1, 1
    FROM roles r WHERE r.nombre = 'admin';
    PRINT 'Admin inicial creado (admin@busride.do). CAMBIAR LA PASSWORD EN PRODUCCION.';
END
ELSE
    PRINT 'Admin inicial ya existe: seed omitido.';
GO
