import { removeSurfaceInteractiveInFile } from './remove-surface-interactive';

describe('removeSurfaceInteractiveInFile', () => {
  it('removes the directive from the import and the imports array of a component', () => {
    const result = removeSurfaceInteractiveInFile(
      'row.component.ts',
      `import { Component } from '@angular/core';
import { AutoSurfaceDirective, SurfaceInteractiveDirective } from '@ethlete/core';

@Component({
  selector: 'app-row',
  template: \`<button etSurfaceInteractive type="button">Row</button>\`,
  imports: [AutoSurfaceDirective, SurfaceInteractiveDirective],
})
export class RowComponent {}
`,
    );

    expect(result.changed).toBe(true);
    expect(result.content).toContain("import { AutoSurfaceDirective } from '@ethlete/core';");
    expect(result.content).toContain('imports: [AutoSurfaceDirective],');
    expect(result.content).toContain('<button type="button">Row</button>');
    expect(result.content).not.toContain('SurfaceInteractive');
    expect(result.findings).toEqual([]);
  });

  it('drops an import that only held the directive and empties hostDirectives', () => {
    const result = removeSurfaceInteractiveInFile(
      'row.directive.ts',
      `import { Directive } from '@angular/core';
import { SurfaceInteractiveDirective } from '@ethlete/core';

@Directive({ selector: '[appRow]', hostDirectives: [{ directive: SurfaceInteractiveDirective }] })
export class RowDirective {}
`,
    );

    expect(result.content).not.toContain("from '@ethlete/core'");
    expect(result.content).toContain('hostDirectives: []');
    expect(result.findings).toEqual([]);
  });

  it('removes the attribute and the marker class from a template file', () => {
    const result = removeSurfaceInteractiveInFile(
      'row.component.html',
      `<a etSurfaceInteractive="" class="row et-surface-interactive" href="/">A</a>\n<li\n  etSurfaceInteractive\n  class="item"\n>B</li>\n`,
    );

    expect(result.content).toBe(`<a class="row" href="/">A</a>\n<li\n  class="item"\n>B</li>\n`);
    expect(result.findings).toEqual([]);
  });

  it('reports a stylesheet selector and any other use for a hand fix', () => {
    const css = removeSurfaceInteractiveInFile('row.css', `.row.et-surface-interactive:hover {\n  color: red;\n}\n`);
    const ts = removeSurfaceInteractiveInFile(
      'factory.ts',
      `import { SurfaceInteractiveDirective } from '@ethlete/core';\nexport const directive = SurfaceInteractiveDirective;\n`,
    );

    expect(css.changed).toBe(false);
    expect(css.findings).toEqual([expect.objectContaining({ line: 1, text: '.row.et-surface-interactive:hover {' })]);
    expect(ts.findings).toEqual([expect.objectContaining({ line: 1, reason: expect.stringContaining('by hand') })]);
  });

  it('leaves a file without the directive untouched', () => {
    const content = `import { SurfaceThemeDirective } from '@ethlete/core';\n<div etSurfaceInteractiveLike></div>\n`;

    expect(removeSurfaceInteractiveInFile('other.ts', content)).toEqual({ changed: false, content, findings: [] });
  });
});
