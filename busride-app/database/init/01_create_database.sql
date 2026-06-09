-- ============================================================
-- BusRide - Creación de base de datos
-- SQL Server 2022
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'busride_db')
BEGIN
    CREATE DATABASE busride_db;
END
GO

USE busride_db;
GO
