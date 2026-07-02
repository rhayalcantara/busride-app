// Modelos del módulo liquidaciones — espejo de liquidacion.controller/service del backend.

export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADA' | 'EN_PROCESO';

// Fila cruda de GET /liquidaciones/mias (SELECT l.* + datos del viaje/ruta, snake_case)
export interface LiquidacionConductor {
  id: string;
  conductor_id: string;
  viaje_id: string | null;
  periodo_inicio: string;
  periodo_fin: string;
  total_abordajes: number;
  ingreso_bruto: number;
  comision_plataforma: number;
  comision_asociacion: number;
  monto_neto: number;
  estado: EstadoLiquidacion;
  referencia_pago: string | null;
  fecha_pago: string | null;
  fecha_creacion: string;
  // Campos extra del JOIN con viajes/rutas
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ruta_nombre: string | null;
}

// Fila cruda de GET /liquidaciones (listado admin, F-09a): columnas de
// `liquidaciones` + nombre del conductor y datos del viaje/ruta (nullables),
// orden fecha_creacion DESC. Filtrable con ?estado=.
export interface LiquidacionAdmin extends LiquidacionConductor {
  conductor_nombre: string;
}

// GET /liquidaciones/mias/resumen devuelve UNA fila agregada (el backend la
// retorna dentro de un arreglo, resultado crudo de dataSource.query).
export interface ResumenLiquidaciones {
  total_viajes: number;
  total_pasajeros: number | null;
  ingreso_bruto: number | null;
  total_comision_plataforma: number | null;
  total_comision_asociacion: number | null;
  total_neto: number | null;
}

export interface ResumenLiquidacionesParams {
  inicio?: string; // YYYY-MM-DD
  fin?: string; // YYYY-MM-DD
}

export interface PagarLiquidacionDto {
  referenciaPago: string;
}

// Respuesta de PATCH /liquidaciones/:id/pagar
export interface LiquidacionPagadaRespuesta {
  mensaje: string;
  liquidacionId: string;
  estado: EstadoLiquidacion; // siempre 'PAGADA'
  referenciaPago: string;
}
