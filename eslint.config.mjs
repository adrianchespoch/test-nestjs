// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import boundariesPlugin from 'eslint-plugin-boundaries';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', '**/*.js', '**/*.mjs', 'prisma/migrations'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
      boundaries: boundariesPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'config', pattern: 'src/config/**' },
        { type: 'main', pattern: 'src/{main,otel,app.module}.ts' },
        { type: 'domain', pattern: 'src/modules/*/domain/**' },
        { type: 'application', pattern: 'src/modules/*/application/**' },
        { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**' },
        { type: 'presentation', pattern: 'src/modules/*/presentation/**' },
        { type: 'module-root', pattern: 'src/modules/*/*.module.ts' },
      ],
    },
    rules: {
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'shared', allow: ['shared'] },
            { from: 'config', allow: ['config', 'shared'] },
            { from: 'main', allow: ['shared', 'config', 'module-root'] },
            { from: 'domain', allow: ['domain', 'shared'] },
            { from: 'application', allow: ['domain', 'application', 'shared'] },
            {
              from: 'infrastructure',
              allow: ['domain', 'application', 'infrastructure', 'shared'],
            },
            {
              from: 'presentation',
              allow: ['domain', 'application', 'presentation', 'shared'],
            },
            {
              from: 'module-root',
              allow: [
                'domain',
                'application',
                'infrastructure',
                'presentation',
                'shared',
                'config',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      'boundaries/element-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
