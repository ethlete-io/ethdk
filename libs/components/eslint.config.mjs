import ethlete from '@ethlete/eslint-plugin';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/stories/**',
            '{projectRoot}/src/scenarios/**',
            '{projectRoot}/src/test-setup.{js,mjs,ts}',
            '{projectRoot}/vite.config.{js,cjs,mjs,ts,mts}',
          ],
          checkObsoleteDependencies: false,
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  // Ethlete styleguide rules — TypeScript files
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    // Generators are Node/nx tooling scripts, not Angular library code — the Angular/RxJS
    // styleguide (no function declarations, no async/await, etc.) does not apply to them.
    // `testing/` holds spec-only helpers (excluded from the lib build) that run inside the
    // test harness, so they share the spec exemption — async/await et al. are fine there.
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/test-helpers.ts', '**/testing/**', '**/generators/**'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      ...ethlete.configs.recommendedAngularTs.rules,
      // Angular selector conventions (project-specific)
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'et',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: ['element', 'attribute'],
          prefix: 'et',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/no-input-rename': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
    },
  },
  // `requirePureAnnotation` only pays off in publishable source, so it is off in the shipped config.
  {
    files: ['**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/test-helpers.ts',
      '**/testing/**',
      '**/generators/**',
      '**/stories/**',
    ],
    rules: {
      'ethlete/no-impure-top-level-provider': ['error', { requirePureAnnotation: true, forbidImpureReads: true }],
    },
  },
  // Ethlete styleguide rules — HTML templates
  ethlete.configs.recommendedTemplate,
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests).
  // `testing/` holds the spec-only drivers those specs call, so it needs the same exemption.
  {
    ...ethlete.configs.recommendedSpec,
    files: [...ethlete.configs.recommendedSpec.files, '**/testing/**/*.ts', '**/test-helpers.ts'],
  },
  // Storybook and the spec-only drivers never run under an application's CSP.
  {
    files: ['**/stories/**', '**/*.stories.ts', '**/testing/**'],
    rules: {
      'ethlete/no-csp-unsafe': 'off',
    },
  },
  {
    files: ['src/**/*.css'],
    ignores: [
      'src/lib/bracket/bracket-pick-card.component.css',
      'src/lib/breadcrumb/breadcrumb-overflow.component.css',
      'src/lib/calendar/calendar.component.css',
      'src/lib/carousel/carousel-autoplay-styles.component.css',
      'src/lib/carousel/carousel.component.css',
      'src/lib/chart/bar-chart.component.css',
      'src/lib/chart/line-chart.component.css',
      'src/lib/chart/sankey-chart.component.css',
      'src/lib/chip/chip.component.css',
      'src/lib/forms/dropzone/dropzone.component.css',
      'src/lib/forms/dropzone/dropzone-item.component.css',
      'src/lib/forms/form-field/form-field-control-suffix-styles.component.css',
      'src/lib/forms/form-field/form-field-text-shell-styles.component.css',
      'src/lib/forms/input/number-input.component.css',
      'src/lib/forms/input/password-input.component.css',
      'src/lib/forms/multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.css',
      'src/lib/forms/rating/rating.component.css',
      'src/lib/forms/rich-text-editor/rich-text-content-styles.component.css',
      'src/lib/forms/rich-text-editor/rich-text-editor-image-editor.component.css',
      'src/lib/forms/rich-text-editor/tools/rich-text-editor-image-styles.component.css',
      'src/lib/forms/rich-text-editor/tools/rich-text-editor-table-styles.component.css',
      'src/lib/forms/selection-list/checkbox-group/checkbox-group-select-all.component.css',
      'src/lib/forms/selection-list/checkbox-group/checkbox-option.component.css',
      'src/lib/forms/selection-list/radio-group/radio.component.css',
      'src/lib/forms/selection-list/segmented-button-group/segmented-button.component.css',
      'src/lib/forms/selection-list/segmented-button-group/segmented-button-group.component.css',
      'src/lib/forms/slider/range-slider.component.css',
      'src/lib/forms/slider/slider.component.css',
      'src/lib/forms/switch/switch.component.css',
      'src/lib/kbd/kbd.component.css',
      'src/lib/scheduler/scheduler-time-grid-view.component.css',
      'src/lib/scrollbar/scrollbar.component.css',
      'src/lib/skeleton/skeleton.component.css',
      'src/lib/stream/pip/pip-stage-styles.component.css',
      'src/lib/stream/pip/pip-window.component.css',
      'src/lib/time-picker/time-picker.component.css',
    ],
    plugins: { ethlete },
    language: 'ethlete/css',
    rules: {
      'ethlete/no-hand-mixed-state': 'error',
    },
  },
];
