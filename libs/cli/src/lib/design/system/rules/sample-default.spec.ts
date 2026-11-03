import { describe, expect, it } from 'vitest';
import { inputsOf } from './implemented-components';
import { sampleDefaultsOf, sampleDefaultVerdictOf } from './sample-default';

const components = [
  {
    file: 'src/a.component.ts',
    selector: 'et-a',
    inputs: inputsOf(`
  public shell = input<ShellState>(SHELL_SAMPLE);
  public rows = input<Row[]>(SKETCH_ROWS);
  public first = input(FLOWS_SAMPLE[0]);
  public idle = input(false);
  public picked = model(PICKED_SAMPLE);
  public tab = model.required<string>();
  public name = input<string>(options.SAMPLE_NAME);
`),
  },
];

describe('sampleDefaultsOf', () => {
  it('flags the inputs that default to a _SAMPLE or _ROWS identifier', () => {
    expect(sampleDefaultsOf(components).map(({ rule, message }) => `${rule} ${message}`)).toEqual([
      'SAMPLE-DEFAULT shell: defaults to the sample data SHELL_SAMPLE',
      'SAMPLE-DEFAULT rows: defaults to the sample data SKETCH_ROWS',
      'SAMPLE-DEFAULT first: defaults to the sample data FLOWS_SAMPLE',
      'SAMPLE-DEFAULT picked: defaults to the sample data PICKED_SAMPLE',
    ]);
  });
});

describe('sampleDefaultVerdictOf', () => {
  it('fails an unlisted hit and a listed input that has none, and warns for a listed hit', () => {
    const verdict = sampleDefaultVerdictOf({
      components,
      known: [
        { file: 'src/a.component.ts', input: 'shell' },
        { file: 'src/a.component.ts', input: 'rows' },
        { file: 'src/a.component.ts', input: 'idle' },
      ],
    });

    expect(verdict.errors.map(({ message }) => message.split(':')[0])).toEqual(['first', 'picked', 'idle']);
    expect(verdict.warnings.map(({ message }) => message.split(':')[0])).toEqual(['shell', 'rows']);
  });
});
