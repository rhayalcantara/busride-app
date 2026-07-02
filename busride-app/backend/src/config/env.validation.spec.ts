import { validarEntorno } from './env.validation';

describe('validarEntorno', () => {
  const base = {
    NODE_ENV: 'development',
    DB_PASSWORD: 'una-password',
    JWT_SECRET: 'a'.repeat(64),
  };

  it('acepta una configuración mínima válida', () => {
    expect(validarEntorno({ ...base })).toEqual(base);
  });

  it('rechaza DB_PASSWORD ausente', () => {
    expect(() => validarEntorno({ ...base, DB_PASSWORD: undefined })).toThrow(/DB_PASSWORD/);
  });

  it('rechaza JWT_SECRET ausente o corto', () => {
    expect(() => validarEntorno({ ...base, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => validarEntorno({ ...base, JWT_SECRET: 'corto' })).toThrow(/32 caracteres/);
  });

  it('rechaza en producción un JWT_SECRET de desarrollo conocido', () => {
    const config = {
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.busride.do',
      JWT_SECRET: 'cambia-esto-usa-un-secreto-de-al-menos-32-caracteres',
    };
    expect(() => validarEntorno(config)).toThrow(/secreto de desarrollo conocido/);
    // El mismo secreto es tolerado fuera de producción
    expect(() => validarEntorno({ ...config, NODE_ENV: 'development' })).not.toThrow();
  });

  it('exige CORS_ORIGIN concreto en producción', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => validarEntorno(prod)).toThrow(/CORS_ORIGIN/);
    expect(() => validarEntorno({ ...prod, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
    expect(() => validarEntorno({ ...prod, CORS_ORIGIN: 'https://app.busride.do' })).not.toThrow();
  });

  it('rechaza variables numéricas no numéricas y acepta las válidas', () => {
    expect(() => validarEntorno({ ...base, PORT: 'abc' })).toThrow(/PORT debe ser numérica/);
    expect(() => validarEntorno({ ...base, DB_PORT: '1433', THROTTLE_LIMIT: '100' })).not.toThrow();
  });

  it('acumula todos los errores en un solo mensaje', () => {
    try {
      validarEntorno({ NODE_ENV: 'production', PORT: 'abc' });
      fail('debió lanzar');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/DB_PASSWORD/);
      expect(msg).toMatch(/JWT_SECRET/);
      expect(msg).toMatch(/CORS_ORIGIN/);
      expect(msg).toMatch(/PORT/);
    }
  });
});
