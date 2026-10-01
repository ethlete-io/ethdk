import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it, vi } from 'vitest';
import { migrateStackedAreaMix } from './line-chart-stacked-area-mix';
import migrateLineChartStackedAreaMix from './migration';

describe('migrate-line-chart-stacked-area-mix', () => {
  it('renames a declaration and maps its opacity to a percentage', () => {
    expect(
      migrateStackedAreaMix(
        [
          '.a { --et-line-chart-stacked-area-opacity: 0.32; }',
          '.b { --et-line-chart-stacked-area-opacity:.5 }',
          '.c { --et-line-chart-stacked-area-opacity : 1 ; }',
        ].join('\n'),
      ),
    ).toEqual({
      content: [
        '.a { --et-line-chart-stacked-area-mix: 32%; }',
        '.b { --et-line-chart-stacked-area-mix:50% }',
        '.c { --et-line-chart-stacked-area-mix : 100% ; }',
      ].join('\n'),
      unmapped: [],
    });
  });

  it('renames a read and maps a numeric fallback', () => {
    expect(
      migrateStackedAreaMix(
        'a { x: var(--et-line-chart-stacked-area-opacity, 0.4); y: var(--et-line-chart-stacked-area-opacity); }',
      ),
    ).toEqual({
      content: 'a { x: var(--et-line-chart-stacked-area-mix, 40%); y: var(--et-line-chart-stacked-area-mix); }',
      unmapped: [],
    });
  });

  it('renames a value it cannot parse and reports its line', () => {
    expect(
      migrateStackedAreaMix(
        [
          '.a {',
          '  --et-line-chart-stacked-area-opacity: var(--app-opacity);',
          '  --et-line-chart-stacked-area-opacity: calc(0.2 + 0.1);',
          '  fill: var(--et-line-chart-stacked-area-opacity, $fallback);',
          '}',
        ].join('\n'),
      ),
    ).toEqual({
      content: [
        '.a {',
        '  --et-line-chart-stacked-area-mix: var(--app-opacity);',
        '  --et-line-chart-stacked-area-mix: calc(0.2 + 0.1);',
        '  fill: var(--et-line-chart-stacked-area-mix, $fallback);',
        '}',
      ].join('\n'),
      unmapped: [2, 3, 4],
    });
  });

  it('renames an inline style and a style binding, reporting the binding', () => {
    expect(
      migrateStackedAreaMix(
        [
          '<et-line-chart style="--et-line-chart-stacked-area-opacity: 0.25" />',
          "host: { '[style.--et-line-chart-stacked-area-opacity]': 'opacity()' }",
        ].join('\n'),
      ),
    ).toEqual({
      content: [
        '<et-line-chart style="--et-line-chart-stacked-area-mix: 25%" />',
        "host: { '[style.--et-line-chart-stacked-area-mix]': 'opacity()' }",
      ].join('\n'),
      unmapped: [2],
    });
  });

  it('leaves a file without the token alone', () => {
    expect(migrateStackedAreaMix('.a { --et-line-chart-area-opacity: 0.2; }')).toBeNull();
  });

  it('rewrites css, scss, html and ts files, warns on an unparsed value, and changes nothing on a second run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/styles.css', '.chart { --et-line-chart-stacked-area-opacity: 0.32; }\n');
    tree.write(
      'apps/shop/src/app/chart.scss',
      '.chart {\n  --et-line-chart-stacked-area-opacity: var(--app-opacity);\n}\n',
    );
    tree.write('apps/shop/src/app/chart.html', '<et-line-chart style="--et-line-chart-stacked-area-opacity: .5" />\n');
    tree.write(
      'apps/shop/src/app/chart.ts',
      "@Component({ styles: '.c { opacity: var(--et-line-chart-stacked-area-opacity, 1); }' })\n",
    );

    await migrateLineChartStackedAreaMix(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/styles.css', 'utf-8')).toBe('.chart { --et-line-chart-stacked-area-mix: 32%; }\n');
    expect(tree.read('apps/shop/src/app/chart.scss', 'utf-8')).toBe(
      '.chart {\n  --et-line-chart-stacked-area-mix: var(--app-opacity);\n}\n',
    );
    expect(tree.read('apps/shop/src/app/chart.html', 'utf-8')).toBe(
      '<et-line-chart style="--et-line-chart-stacked-area-mix: 50%" />\n',
    );
    expect(tree.read('apps/shop/src/app/chart.ts', 'utf-8')).toBe(
      "@Component({ styles: '.c { opacity: var(--et-line-chart-stacked-area-mix, 100%); }' })\n",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('apps/shop/src/app/chart.scss:2');

    const snapshot = ['styles.css', 'app/chart.scss', 'app/chart.html', 'app/chart.ts'].map((file) =>
      tree.read(`apps/shop/src/${file}`, 'utf-8'),
    );
    warn.mockClear();

    await migrateLineChartStackedAreaMix(tree, { skipFormat: true });

    expect(
      ['styles.css', 'app/chart.scss', 'app/chart.html', 'app/chart.ts'].map((file) =>
        tree.read(`apps/shop/src/${file}`, 'utf-8'),
      ),
    ).toEqual(snapshot);
    expect(warn).not.toHaveBeenCalled();
  });
});
