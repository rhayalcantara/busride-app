// @ts-check
// Configuración ESLint (flat config) para BusRide backend (NestJS 10 + TypeScript).
// Coherente con el tsconfig laxo del proyecto (strictNullChecks/noImplicitAny desactivados).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      // El proyecto usa tipado laxo: `any` es habitual en mapeos de SPs y payloads.
      '@typescript-eslint/no-explicit-any': 'off',
      // Los services exponen métodos sin tipo de retorno explícito por convención.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Permitir interfaces/funciones vacías (DTOs y stubs de módulos).
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // Variables sin usar: aviso (no error) e ignorar las prefijadas con _.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // requires puntuales (p. ej. en configs) no deben romper el lint.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
