// Producción: ajustar a la URL pública del backend al desplegar
// (si el frontend se sirve detrás del mismo dominio/nginx, las relativas valen).
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  wsUrl: '',
};
