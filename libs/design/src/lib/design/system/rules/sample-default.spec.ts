import { describe, expect, it } from 'vitest';
import { inputsOf } from './implemented-components';
import { sampleDefaultsOf, sampleFallbacksOf, sampleDefaultVerdictOf } from './sample-default';

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

describe('sampleFallbacksOf', () => {
  const messagesOf = (text: string) =>
    sampleFallbacksOf([{ file: 'src/a.component.ts', text }]).map(({ message }) => message);

  it('flags a ?? fallback to a literal constant of the file (the inbox draftText)', () => {
    expect(
      messagesOf(`
  public readonly DRAFT_TEXT = 'Tonal wirkt neben filled zu blass.';
  protected shownDraftText = computed(() => this.draftText() ?? this.DRAFT_TEXT);
`),
    ).toEqual([expect.stringContaining('line 3: falls back to the sample constant this.DRAFT_TEXT')]);
  });

  it('stays quiet for a module-level template-literal constant', () => {
    expect(messagesOf('const PIN_REST = `a b`;\nconst x = this.on() ? PIN_REST : null;')).toEqual([]);
  });

  it('flags a ?? fallback to a _SAMPLE identifier', () => {
    expect(messagesOf('const x = this.rows() ?? INBOX_SAMPLE;')).toHaveLength(1);
  });

  it('flags a || fallback to a _ROWS identifier', () => {
    expect(messagesOf('const x = this.rows() || SKETCH_ROWS;')).toHaveLength(1);
  });

  it('flags a ternary that picks a sample constant in either branch', () => {
    expect(messagesOf('const x = this.on() ? FLOWS_SAMPLE : [];')).toHaveLength(1);
    expect(messagesOf('const x = this.on() ? [] : FLOWS_SAMPLE;')).toHaveLength(1);
  });

  it('stays quiet for a non-sample fallback', () => {
    expect(
      messagesOf(`
  public readonly MAX = 5;
  const a = this.name() ?? '';
  const b = this.rows() || [];
  const c = this.on() ? this.label() : 'none';
  const d = this.count() ?? this.MAX;
  const e = this.maybe?.value;
  // a ?? FLOWS_SAMPLE
`),
    ).toEqual([]);
  });
});
