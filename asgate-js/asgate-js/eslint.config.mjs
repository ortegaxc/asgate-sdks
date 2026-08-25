import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // Smoke de resolución del paquete compilado (ESM/CJS con require/console).
      'test/module-resolution.test.cjs',
      'test/module-resolution.test.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
)
