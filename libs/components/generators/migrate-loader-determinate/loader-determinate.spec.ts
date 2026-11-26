import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it, vi } from 'vitest';
import { migrateLoaderDeterminate } from './loader-determinate';
import migrateLoaderDeterminateInputs from './migration';

describe('migrate-loader-determinate', () => {
  describe('et-spinner', () => {
    it('removes a constant determinate and keeps the value', () => {
      expect(
        migrateLoaderDeterminate(
          [
            '<et-spinner determinate [value]="65" />',
            '<et-spinner [determinate]="true" value="40" track />',
            '<et-spinner\n  bind-determinate="true"\n  [value]="progress()"\n/>',
          ].join('\n'),
        ),
      ).toEqual({
        content: [
          '<et-spinner [value]="65" />',
          '<et-spinner value="40" track />',
          '<et-spinner\n  [value]="progress()"\n/>',
        ].join('\n'),
        findings: [],
      });
    });

    it('reports a value that a spinner without determinate ignored, and leaves it in place', () => {
      expect(migrateLoaderDeterminate('<et-spinner [value]="uploaded()" />')).toEqual({
        content: null,
        findings: [{ line: 1, message: expect.stringContaining('binds value without determinate') }],
      });
    });

    it('drops the value a constant false determinate hid', () => {
      expect(migrateLoaderDeterminate('<et-spinner [determinate]="false" [value]="x" />').content).toBe(
        '<et-spinner />',
      );
    });

    it('folds a dynamic determinate into the value binding', () => {
      expect(
        migrateLoaderDeterminate(
          [
            '<et-spinner [determinate]="hasProgress()" [value]="progress() ?? 0" />',
            '<et-spinner [determinate]="!preparing()" value="40" />',
            '<et-spinner [determinate]="a && b" [value]="ready ? done : 0" />',
          ].join('\n'),
        ).content,
      ).toBe(
        [
          '<et-spinner [value]="hasProgress() ? (progress() ?? 0) : undefined" />',
          '<et-spinner [value]="!preparing() ? 40 : undefined" />',
          '<et-spinner [value]="(a && b) ? (ready ? done : 0) : undefined" />',
        ].join('\n'),
      );
    });

    it('reports a determinate spinner without a value, with its line', () => {
      const result = migrateLoaderDeterminate(
        '<div>\n  <et-spinner determinate />\n  <et-spinner [determinate]="busy" />\n</div>',
      );

      expect(result.content).toBe('<div>\n  <et-spinner />\n  <et-spinner />\n</div>');
      expect(result.findings.map((finding) => finding.line)).toEqual([2, 3]);
      expect(result.findings[1]?.message).toContain('[determinate]="busy"');
    });

    it('leaves a cdk spinner with a mode input alone', () => {
      expect(migrateLoaderDeterminate('<et-spinner mode="determinate" [value]="40" />').content).toBeNull();
      expect(migrateLoaderDeterminate('<et-spinner [value]="40" />', { skipSpinner: true }).content).toBeNull();
    });
  });

  describe('et-progress-bar', () => {
    it('leaves a bound value without indeterminate alone', () => {
      expect(migrateLoaderDeterminate('<et-progress-bar [value]="42" class="w-full" />')).toEqual({
        content: null,
        findings: [],
      });
    });

    it('drops a constant indeterminate together with the value it hid', () => {
      expect(
        migrateLoaderDeterminate(
          [
            '<et-progress-bar [indeterminate]="true" class="w-full" />',
            '<et-progress-bar indeterminate value="3" />',
          ].join('\n'),
        ).content,
      ).toBe(['<et-progress-bar class="w-full" />', '<et-progress-bar />'].join('\n'));
    });

    it('removes a false indeterminate and keeps the value', () => {
      expect(migrateLoaderDeterminate('<et-progress-bar [indeterminate]="false" [value]="v" />').content).toBe(
        '<et-progress-bar [value]="v" />',
      );
    });

    it('folds a dynamic indeterminate into the value binding', () => {
      expect(
        migrateLoaderDeterminate(
          '<et-progress-bar [value]="entry.progress() ?? 0" [indeterminate]="entry.progress() === null" />',
        ).content,
      ).toBe('<et-progress-bar [value]="(entry.progress() === null) ? undefined : (entry.progress() ?? 0)" />');
    });

    it('reports a bar that had neither value nor a dynamic indeterminate it could fold', () => {
      const result = migrateLoaderDeterminate('<et-progress-bar />\n<et-progress-bar [indeterminate]="loading" />');

      expect(result.content).toBe('<et-progress-bar />\n<et-progress-bar />');
      expect(result.findings.map((finding) => finding.line)).toEqual([1, 2]);
    });
  });

  it('leaves other elements alone', () => {
    expect(migrateLoaderDeterminate('<et-checkbox [indeterminate]="x" /><et-progress-spinner [value]="3" />')).toEqual({
      content: null,
      findings: [],
    });
  });

  it('rewrites the component and its templateUrl file, only where @ethlete/components is imported', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    tree.write(
      'apps/shop/src/app/upload.component.ts',
      [
        "import { LOADER_IMPORTS } from '@ethlete/components';",
        "@Component({ templateUrl: './upload.component.html' })",
        'export class UploadComponent {}',
        '',
      ].join('\n'),
    );
    tree.write(
      'apps/shop/src/app/upload.component.html',
      '<et-progress-bar [value]="p" [indeterminate]="!p" />\n<et-spinner determinate />\n',
    );
    tree.write(
      'apps/shop/src/app/inline.component.ts',
      [
        "import { SpinnerComponent } from '@ethlete/components';",
        '@Component({ template: `<et-spinner [determinate]="true" [value]="40" />` })',
        'export class InlineComponent {}',
        '',
      ].join('\n'),
    );
    tree.write('apps/shop/src/app/other.ts', 'const t = `<et-spinner determinate />`;\n');

    await migrateLoaderDeterminateInputs(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/upload.component.html', 'utf-8')).toBe(
      '<et-progress-bar [value]="!p ? undefined : p" />\n<et-spinner />\n',
    );
    expect(tree.read('apps/shop/src/app/inline.component.ts', 'utf-8')).toContain('<et-spinner [value]="40" />');
    expect(tree.read('apps/shop/src/app/other.ts', 'utf-8')).toBe('const t = `<et-spinner determinate />`;\n');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('apps/shop/src/app/upload.component.html:2'));

    warn.mockRestore();
  });
});
