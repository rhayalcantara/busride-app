import { SetMetadata } from '@nestjs/common';

export const PERMITIR_PASSWORD_CADUCADA_KEY = 'permitirPasswordCaducada';

// Exime un endpoint del bloqueo de PasswordCaducadaGuard: lo mínimo que un
// usuario con credencial provisional necesita para regularizarse
// (cambiar-password) o salir (logout). Usar con criterio.
export const PermitirPasswordCaducada = () => SetMetadata(PERMITIR_PASSWORD_CADUCADA_KEY, true);
