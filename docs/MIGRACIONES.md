# Evolución del esquema — migraciones TypeORM

**Creado:** 2026-07-02 (auditoría de producción, paso 6)

## Modelo de propiedad del esquema

- **BD desde cero**: la crean SIEMPRE los scripts de `database/init/` (01 BD → 02 esquema → 03 SPs → 04 seed admin → 05 usuario app → 06 parches), vía `sqlserver-init` en compose o `database/init.sh` manual. Contienen columnas `geography`, índices espaciales y stored procedures que las entidades TypeORM **no** describen (`synchronize: false` siempre).
- **BD existente (producción)**: los cambios de esquema posteriores al baseline se aplican con migraciones TypeORM (`src/database/migrations/`), registradas en la tabla `migrations`.
- **Regla de oro**: todo cambio va a los DOS sitios — una migración nueva (para BDs vivas) **y** el script de init correspondiente (`02_schema.sql` / `03_stored_procedures.sql`, para instalaciones frescas). Ambos deben dejar el mismo esquema final.

## El baseline

`1782994699481-Baseline.ts` es el punto de partida: no crea nada, solo verifica que el esquema de init exista (tablas núcleo) y deja su fila en `migrations`. En una BD nueva el orden es: init scripts primero, `migration:run` después. No es reversible (`down()` lanza error).

## Crear una migración nueva

```bash
cd busride-app/backend
npm run migration:create -- src/database/migrations/NombreDescriptivo
```

Escribir `up()`/`down()` con **SQL crudo** (`queryRunner.query(...)`), igual que el estilo de los init scripts. **NO usar `migration:generate`**: diffea entidades contra la BD y, como las entidades no mapean las columnas `geography` ni conocen los SPs, genera DROPs/ALTERs destructivos. El script queda disponible solo para inspección puntual, nunca para commitear su salida sin revisar.

## Ejecutar migraciones

```bash
npm run migration:run      # aplica pendientes
npm run migration:revert   # revierte la última
```

La conexión sale de `src/config/data-source.ts` (lee `backend/.env` vía dotenv). **`busride_app` no puede ejecutarlas**: es el usuario de runtime con mínimo privilegio (sin DDL; verificado: `CREATE TABLE permission denied`). Ejecutarlas con credenciales elevadas solo durante el despliegue:

```bash
DB_USER=sa DB_PASSWORD=<SA_PASSWORD> npm run migration:run
```

(En PowerShell: `$env:DB_USER='sa'; $env:DB_PASSWORD='...'; npm run migration:run`.) Si una migración crea tablas nuevas, recordar que `busride_app` obtiene permisos por rol de BD (`db_datareader`/`db_datawriter` + `GRANT EXECUTE` a nivel de BD), así que las tablas y SPs nuevos quedan cubiertos automáticamente.

## Cambios en stored procedures

Los SPs se versionan igual: migración con `CREATE OR ALTER PROCEDURE ...` en `up()` (y la versión anterior en `down()`), reflejando el cambio en `database/init/03_stored_procedures.sql`. Nota: `queryRunner.query()` no acepta `GO`; cada batch va en su propia llamada.

## Estado verificado (2026-07-02)

- Baseline aplicado en la BD de desarrollo con `sa`; segunda corrida: "No migrations are pending" (idempotente).
- `migration:run` con `busride_app` falla por diseño (sin DDL).
