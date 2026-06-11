import { Pipe, PipeTransform } from '@angular/core';

// Intl con locale es-DO: produce "RD$1,250.00" sin necesidad de registrar
// datos de locale de Angular (no tocamos app.config.ts).
const FORMATO_DOP = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea montos en pesos dominicanos (RD$) con el locale es-DO.
 * Acepta number o string numérico; valores nulos/no numéricos → ''.
 */
@Pipe({ name: 'monedaDop', standalone: true })
export class MonedaDopPipe implements PipeTransform {
  transform(valor: number | string | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') {
      return '';
    }
    const numero = typeof valor === 'string' ? Number(valor) : valor;
    if (Number.isNaN(numero)) {
      return '';
    }
    return FORMATO_DOP.format(numero);
  }
}
