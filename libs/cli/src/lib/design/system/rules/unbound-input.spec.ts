import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { inputsOf, selectorOf } from './implemented-components';
import { unboundInputsOf, unboundInputVerdictOf } from './unbound-input';

const component = `@Component({ selector: 'et-sketches', template: '' })
export class SketchesComponent {
  public hold = input<SketchHold>(SKETCH_HOLD);
  public reason = input(false);
  public rows = input<Row[]>(ROWS);
}`;

const appWith = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-unbound-'));

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }

  return dir;
};

const components = [
  { file: 'src/sketches.component.ts', selector: selectorOf(component), inputs: inputsOf(component) },
];

describe('unboundInputsOf', () => {
  it('flags the inputs no template binds on the tag', () => {
    const appDir = appWith({
      'a.html': '<et-sketches [rows]="rows()" (click)="x(a => a)" />',
      'b.ts': 'const t = \'<et-other [hold]="1" reason="2" />\';',
    });

    expect(
      unboundInputsOf({ components, appDir }).map(({ rule, file, message }) => [rule, file, message.split(':')[0]]),
    ).toEqual([
      ['UNBOUND-INPUT', 'src/sketches.component.ts', 'hold'],
      ['UNBOUND-INPUT', 'src/sketches.component.ts', 'reason'],
    ]);
  });

  it('counts a plain attribute and a two-way binding as bound', () => {
    const appDir = appWith({ 'a.html': '<et-sketches reason="x" [(hold)]="h" [rows]="r"></et-sketches>' });

    expect(unboundInputsOf({ components, appDir })).toEqual([]);
  });
});

describe('unboundInputVerdictOf', () => {
  const appDir = appWith({ 'a.html': '<et-sketches [rows]="r" />' });

  it('fails an unlisted hit and a listed input that is bound again, and warns for a listed hit', () => {
    const verdict = unboundInputVerdictOf({
      components,
      appDir,
      known: [
        { file: 'src/sketches.component.ts', input: 'hold' },
        { file: 'src/sketches.component.ts', input: 'rows' },
      ],
    });

    expect(verdict.errors.map(({ message }) => message.split(':')[0])).toEqual(['reason', 'rows']);
    expect(verdict.warnings.map(({ message }) => message.split(':')[0])).toEqual(['hold']);
  });
});
