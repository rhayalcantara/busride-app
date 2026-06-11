// Desarrollo: el proxy de Angular (proxy.conf.json) redirige /api y /socket.io
// al backend local (http://localhost:3002), por eso las URLs son relativas.
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  // Cadena vacía = mismo origen; socket.io-client usará el proxy (ws: true)
  wsUrl: '',
};
