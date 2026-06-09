import { Module } from '@nestjs/common';
import { LiquidacionController } from './liquidacion.controller';
import { LiquidacionService } from './liquidacion.service';

@Module({
  providers: [LiquidacionService],
  controllers: [LiquidacionController],
})
export class LiquidacionModule {}
