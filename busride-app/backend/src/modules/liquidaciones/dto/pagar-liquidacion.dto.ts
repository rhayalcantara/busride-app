import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PagarLiquidacionDto {
  @ApiProperty({ description: 'Referencia del pago realizado al conductor (transferencia, cheque, etc.)' })
  @IsString()
  @IsNotEmpty({ message: 'La referenciaPago es obligatoria' })
  referenciaPago: string;
}
