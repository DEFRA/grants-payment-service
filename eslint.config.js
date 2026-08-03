import { defineConfig } from 'eslint/config'
import neostandard from 'neostandard'
import jsdoc from 'eslint-plugin-jsdoc'
import tseslint from 'typescript-eslint'

export default defineConfig(
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),

  {
    name: 'typescript-eslint/js',
    files: ['**/*.{cjs,js}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      jsdoc.configs['flat/recommended-typescript-flavor']
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Turn off strict type checking rules
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // `void` marks intentionally-ignored promises (e.g. `setImmediate`, event
      // listeners) which no-misused-promises otherwise flags
      'no-void': 'off',

      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'error'
    }
  },

  {
    name: 'typescript-eslint/tests',
    files: ['**/*.test.js'],
    rules: {
      // Assertions like `expect(GrantPaymentsModel.aggregate).toHaveBeenCalled()` dereference
      // mongoose model methods, which the unbound-method rule flags on test files
      '@typescript-eslint/unbound-method': 'off'
    }
  }
)
