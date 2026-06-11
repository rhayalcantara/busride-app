// Modelos del módulo wallet — espejo de wallet.controller/service del backend.

// Fila cruda de GET /wallet/paquetes (SELECT * de paquetes_viaje, snake_case)
export interface Paquete {
  id: number;
  nombre: string;
  cantidad_viajes: number;
  precio: number;
  viajes_bono: number;
  activo: boolean;
  fecha_creacion: string;
}

// Respuesta de GET /wallet/mi-saldo (entidad WalletPasajero)
export interface Saldo {
  id: string;
  pasajeroId: string;
  saldoViajes: number;
  saldoDinero: number;
  fechaActualizacion: string;
}

export interface ComprarPaqueteDto {
  paqueteId: number;
  referenciaExterna: string; // clave de idempotencia de la pasarela de pago
}

// POST /wallet/comprar: compra ya procesada con esa referenciaExterna
export interface CompraIdempotente {
  idempotente: true;
  mensaje: string;
  transaccionId: string;
  viajesAcreditados: number;
  precio: number;
  descripcion: string | null;
  fechaCreacion: string;
}

// POST /wallet/comprar: compra nueva acreditada
export interface CompraNueva {
  idempotente: false;
  transaccionId: string;
  paquete: string; // nombre del paquete
  precio: number;
  viajesAcreditados: number;
  saldoViajes: number; // saldo resultante
}

// Unión discriminada por el flag `idempotente`
export type CompraPaqueteRespuesta = CompraNueva | CompraIdempotente;

export type TipoTransaccion = 'RECARGA' | 'ABORDAJE' | 'DEVOLUCION';
export type EstadoTransaccion = 'PENDIENTE' | 'COMPLETADA';

// Fila cruda de GET /wallet/historial (SELECT * de transacciones, snake_case)
export interface Transaccion {
  id: string;
  pasajero_id: string;
  tipo: TipoTransaccion;
  monto: number | null;
  viajes_cantidad: number;
  referencia_externa: string | null;
  estado: EstadoTransaccion;
  descripcion: string | null;
  fecha_creacion: string;
}
