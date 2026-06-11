/**
 * Compara dos UUIDs sin distinguir mayúsculas/minúsculas (SQL Server suele
 * devolver GUIDs en mayúsculas y el frontend los maneja en minúsculas).
 * Devuelve false si alguno es nulo o vacío.
 */
export function sonUuidsIguales(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) {
    return false;
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
