import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { fixupPluginRules } from '@eslint/compat';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import js from '@eslint/js';

// استيراد الإضافات (Plugins) بشكل مباشر
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// تعريف الإضافات بعد إصلاحها لتعمل مع ESLint 9
// fixupPluginRules يغلف الإضافة ويمنع أخطاء المراجع الدائرية
const patchedReactPlugin = fixupPluginRules(reactPlugin);
const patchedHooksPlugin = fixupPluginRules(hooksPlugin);
const patchedNextPlugin = fixupPluginRules(nextPlugin);

export default [
  // 1. إعدادات التجاهل العامة
  { ignores: ['.next/**', 'dist/**', 'node_modules/**'] },

  // 2. إعدادات JavaScript الأساسية
  js.configs.recommended,

  // 3. إعدادات TypeScript (Strict + Stylistic)
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // 4. إعدادات Next.js و React (بناء يدوي كامل - Manual Composition)
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      react: patchedReactPlugin,
      'react-hooks': patchedHooksPlugin,
      '@next/next': patchedNextPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    // دمج القواعد يدويًا لتجنب استيراد "Configs" المعطوبة
    rules: {
      // قواعد React Recommended
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // قواعد React Hooks
      ...hooksPlugin.configs.recommended.rules,

      // قواعد Next.js Core Web Vitals
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // تخصيصات المشروع
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // إيقاف القواعد المتعارضة أو غير الضرورية
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // 5. Prettier (يجب أن يكون الأخير)
  eslintPluginPrettier,
];
