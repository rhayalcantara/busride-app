/**
 * Genera una `referenciaExterna` única para transacciones del wallet:
 * `<PREFIJO>-<timestamp base36>-<aleatorio>`, p. ej. "BR-MBX1K2A4-7F3K9Q".
 * La combinación timestamp + aleatorio criptográfico evita colisiones
 * incluso con llamadas en el mismo milisegundo.
 */
export function generarReferenciaExterna(prefijo = 'BR'): string {
  const tiempo = Date.now().toString(36).toUpperCase();
  const aleatorio = crypto
    .getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(-6);
  return `${prefijo}-${tiempo}-${aleatorio}`;
}
