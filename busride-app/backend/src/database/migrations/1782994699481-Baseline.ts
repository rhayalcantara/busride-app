import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline (auditoría, paso 6).
 *
 * El esquema NO lo crea esta migración: lo poseen los scripts de
 * `database/init/` (01 BD → 02 esquema → 03 SPs → 04 seed → 05 usuario app →
 * 06 parches), que siguen siendo la única forma de crear una BD desde cero
 * (tienen geography, SPs e índices espaciales que las entidades no describen).
 *
 * Esta migración solo verifica que ese esquema base exista y deja registrado
 * el punto de partida en la tabla `migrations`. Todo cambio de esquema
 * posterior a este baseline se hace con una migración nueva (SQL crudo) y se
 * refleja también en `database/init/` para instalaciones frescas.
 * Proceso completo: docs/MIGRACIONES.md.
 */
export class Baseline1782994699481 implements MigrationInterface {
  name = 'Baseline1782994699481';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tablas: { total: number }[] = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME IN ('usuarios', 'rutas', 'viajes', 'reservas')`,
    );
    if (Number(tablas[0]?.total) !== 4) {
      throw new Error(
        'Esquema base no encontrado: esta BD no fue inicializada con database/init. ' +
          'Ejecuta primero los scripts de init (docker compose up sqlserver-init o database/init.sh) ' +
          'y vuelve a correr las migraciones. Ver docs/MIGRACIONES.md.',
      );
    }
    // Nada que crear: el baseline solo registra el punto de partida.
  }

  public async down(): Promise<void> {
    throw new Error(
      'El baseline no se puede revertir: representa el esquema creado por database/init.',
    );
  }
}
