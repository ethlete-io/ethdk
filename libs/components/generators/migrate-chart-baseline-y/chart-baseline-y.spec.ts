import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { renameBaselineY } from './chart-baseline-y';
import migrateChartBaselineY from './migration';

describe('migrate-chart-baseline-y', () => {
  it('renames the property in source and inline templates', () => {
    expect(
      renameBaselineY(
        [
          '@Component({ template: `<line [attr.y1]="chart.baselineY()" />` })',
          'export class C { y = this.chart.baselineY(); }',
        ].join('\n'),
      ),
    ).toBe(
      [
        '@Component({ template: `<line [attr.y1]="chart.baseline()" />` })',
        'export class C { y = this.chart.baseline(); }',
      ].join('\n'),
    );
  });

  it('leaves other identifiers alone', () => {
    expect(renameBaselineY('const baselineY = 1; other.baselineYOffset();')).toBeNull();
  });

  it('rewrites the component and its templateUrl file, only where @ethlete/components is imported', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'apps/shop/src/app/chart.component.ts',
      [
        "import { BarChartDirective } from '@ethlete/components/chart';",
        "@Component({ templateUrl: './chart.component.html' })",
        'export class ChartComponent { y = this.chart.baselineY(); }',
        '',
      ].join('\n'),
    );
    tree.write('apps/shop/src/app/chart.component.html', '<line [attr.y1]="chart.baselineY()" />\n');
    tree.write('apps/shop/src/app/other.ts', 'export const y = chart.baselineY();\n');

    await migrateChartBaselineY(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/chart.component.ts', 'utf-8')).toContain('this.chart.baseline()');
    expect(tree.read('apps/shop/src/app/chart.component.html', 'utf-8')).toBe(
      '<line [attr.y1]="chart.baseline()" />\n',
    );
    expect(tree.read('apps/shop/src/app/other.ts', 'utf-8')).toBe('export const y = chart.baselineY();\n');
  });
});
