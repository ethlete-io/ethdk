import ethlete from '@ethlete/eslint-plugin';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { CANVAS_CAMERA_KNOWN } from './eslint-rules/canvas-camera-known.mjs';
import { canvasCameraOwn } from './eslint-rules/canvas-camera-own.mjs';

export default [
  { ignores: ['src-tauri/target', 'src/styles/*.d.ts'] },
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      ...ethlete.configs.recommendedAngularTs.rules,
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ethlete',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: ['element', 'attribute'],
          prefix: 'ethlete',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
      'ethlete/no-silent-catch-error': ['error', { tryCatch: true }],
    },
  },
  {
    files: [
      'src/app/components/design-canvas/canvas-viewport.ts',
      'src/app/components/design-canvas/frame-zoom-viewport.ts',
      'src/app/components/design-canvas/pointer-focus.ts',
    ],
    rules: {
      'ethlete/no-dom-query': 'off',
      'ethlete/no-direct-dom-manipulation': 'off',
      'ethlete/prefer-rxjs-timer': 'off',
      'ethlete/no-native-observers': 'off',
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['src/app/design-parts/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: { studio: { rules: { 'canvas-camera-own': canvasCameraOwn } } },
    rules: { 'studio/canvas-camera-own': ['error', { known: CANVAS_CAMERA_KNOWN }] },
  },
  ethlete.configs.recommendedTemplate,
  ethlete.configs.recommendedSpec,
];
