import { describe, expect, it } from 'vitest';
import { classifyImgClass, createEmptyReport, renderReport, scanTemplate } from './report';

describe('migrate-from-cdk -> classifyImgClass', () => {
  it('treats a definite box in both axes as the fit mode', () => {
    expect(classifyImgClass('h-10 w-10 object-cover')).toBe('fit');
    expect(classifyImgClass('size-full object-contain')).toBe('fit');
    expect(classifyImgClass('w-[120px] h-1/2')).toBe('fit');
  });

  it('treats one definite axis plus an aspect ratio as the fit mode', () => {
    expect(classifyImgClass('w-full aspect-video object-cover')).toBe('fit');
    expect(classifyImgClass('h-full aspect-[4/3]')).toBe('fit');
  });

  it('treats constraints and auto axes as the element-class mode', () => {
    expect(classifyImgClass('max-h-41 w-auto')).toBe('element-classes');
    expect(classifyImgClass('h-92.5 w-auto max-w-full')).toBe('element-classes');
    expect(classifyImgClass('w-full')).toBe('element-classes');
    expect(classifyImgClass('w-full aspect-auto')).toBe('element-classes');
  });

  it('leaves values it cannot read unclassified', () => {
    expect(classifyImgClass(null)).toBe('unclassified');
    expect(classifyImgClass('rounded-full object-cover')).toBe('unclassified');
    expect(classifyImgClass('md:h-10 md:w-10')).toBe('unclassified');
  });
});

describe('migrate-from-cdk -> reactive form controls', () => {
  const scan = (template: string) => {
    const report = createEmptyReport();

    scanTemplate(report, template, { file: 'a.html', startLine: 1 });

    return report;
  };

  it('groups cdk controls bound through reactive forms by component', () => {
    const report = scan(
      [
        '<et-text-input formControlName="name" />',
        '<et-select [formControl]="ctrl"></et-select>',
        '<et-text-input [formControl]="other" />',
        '<et-checkbox-group [formGroup]="group"></et-checkbox-group>',
      ].join('\n'),
    );

    expect(report.reactiveFormControls.get('et-text-input')).toEqual([
      { file: 'a.html', line: 1, detail: '`formControlName`' },
      { file: 'a.html', line: 3, detail: '`formControl`' },
    ]);
    expect(report.reactiveFormControls.get('et-select')).toEqual([
      { file: 'a.html', line: 2, detail: '`formControl`' },
    ]);
    expect(report.reactiveFormControls.get('et-checkbox-group')).toHaveLength(1);

    const rendered = renderReport(report, { installedVersions: {}, rewrittenFiles: 0 });

    expect(rendered).toContain('## Form controls that need signal forms first');
    expect(rendered).toContain('### `<et-text-input>`');
    expect(rendered).toContain('- `a.html:2` - `formControl`');
  });

  it('ignores controls without a reactive forms binding and non-control tags', () => {
    const report = scan(
      '<et-text-input [formField]="f.name" /><et-select-field [formGroup]="g"></et-select-field><et-selectx formControl></et-selectx>',
    );

    expect(report.reactiveFormControls.size).toBe(0);
  });
});
