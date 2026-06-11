import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

// Expira reservas vencidas cada minuto invocando sp_expirar_reservas (F7).
// NOTA: requiere ScheduleModule.forRoot() en AppModule (lo registra T-12);
// hasta entonces el cron no se dispara en runtime — comportamiento esperado.
@Injectable()
export class ReservasCronService {
  private readonly logger = new Logger(ReservasCronService.name);

  constructor(private dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirarReservas() {
    try {
      const resultado = await this.dataSource.query(`EXEC sp_expirar_reservas`);
      const expiradas = resultado?.[0]?.reservas_expiradas ?? 0;

      if (expiradas > 0) {
        this.logger.log(`Reservas expiradas: ${expiradas}`);
      } else {
        this.logger.debug('Sin reservas para expirar');
      }
    } catch (error) {
      this.logger.error('Error al ejecutar sp_expirar_reservas', error instanceof Error ? error.stack : String(error));
    }
  }
}
