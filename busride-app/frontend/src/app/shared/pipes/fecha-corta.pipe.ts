import { Pipe, PipeTransform } from '@angular/core';

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const FORMATO_SOLO_FECHA = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'short',
});

/**
 * Fecha corta con locale es-DO (p. ej. "11/6/26, 2:30 p. m.").
 * Acepta Date, string ISO o timestamp. Con `conHora = false` omite la hora.
 */
@Pipe({ name: 'fechaCorta', standalone: true })
export class FechaCortaPipe implements PipeTransform {
  transform(valor: Date | string | number | null | undefined, conHora = true): string {
    if (valor === null || valor === undefined || valor === '') {
      return '';
    }
    const fecha = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }
    return (conHora ? FORMATO_FECHA_HORA : FORMATO_SOLO_FECHA).format(fecha);
  }
}
