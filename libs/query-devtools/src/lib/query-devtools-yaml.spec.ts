import { toQueryDevtoolsYaml } from './query-devtools-yaml';

describe('toQueryDevtoolsYaml', () => {
  it('should write a nested mapping as an indented block', () => {
    expect(toQueryDevtoolsYaml({ info: { title: 'Designed mocks', version: 1 } })).toBe(
      ['info:', '  title: Designed mocks', '  version: 1', ''].join('\n'),
    );
  });

  it('should quote a key or value YAML would read back as something else', () => {
    const yaml = toQueryDevtoolsYaml({
      '200': 'ok',
      '/matches/{id}': 1,
      $ref: '#/components/schemas/X',
      date: '2026-01-01',
      flag: 'no',
      empty: '',
      colon: 'a: b',
    });

    expect(yaml).toBe(
      [
        '"200": ok',
        '"/matches/{id}": 1',
        '$ref: "#/components/schemas/X"',
        'date: "2026-01-01"',
        'flag: "no"',
        'empty: ""',
        'colon: "a: b"',
        '',
      ].join('\n'),
    );
  });

  it('should write a sequence of scalars', () => {
    expect(toQueryDevtoolsYaml({ tags: ['main', 'cms'] })).toBe(['tags:', '  - main', '  - cms', ''].join('\n'));
  });

  it('should continue a mapping inside a sequence on the dash line', () => {
    const yaml = toQueryDevtoolsYaml({ parameters: [{ name: 'id', in: 'path' }, { name: 'page' }] });

    expect(yaml).toBe(['parameters:', '  - name: id', '    in: path', '  - name: page', ''].join('\n'));
  });

  it('should write a nested sequence inside a sequence', () => {
    expect(toQueryDevtoolsYaml([[1, 2], [3]])).toBe(['- - 1', '  - 2', '- - 3', ''].join('\n'));
  });

  it('should write an empty container inline', () => {
    expect(toQueryDevtoolsYaml({ schema: {}, oneOf: [] })).toBe(['schema: {}', 'oneOf: []', ''].join('\n'));
  });

  it('should write a multi-line string as a block scalar', () => {
    expect(toQueryDevtoolsYaml({ description: 'first\n\nsecond' })).toBe(
      ['description: |-', '  first', '', '  second', ''].join('\n'),
    );
  });

  it('should indent a block scalar inside a sequence item against the dash', () => {
    expect(toQueryDevtoolsYaml({ notes: ['first\nsecond'] })).toBe(
      ['notes:', '  - |-', '    first', '    second', ''].join('\n'),
    );
  });

  it('should quote a multi-line string a block scalar would not round-trip', () => {
    expect(toQueryDevtoolsYaml({ description: ' leading\nspace' })).toBe('description: " leading\\nspace"\n');
  });

  it('should drop an undefined member the way JSON.stringify does', () => {
    expect(toQueryDevtoolsYaml({ kept: 1, gone: undefined })).toBe('kept: 1\n');
  });

  it('should write a non-finite number as null, so both exports agree', () => {
    expect(toQueryDevtoolsYaml({ count: Number.NaN, ratio: Number.POSITIVE_INFINITY })).toBe(
      ['count: null', 'ratio: null', ''].join('\n'),
    );
  });

  it('should write a bare scalar document', () => {
    expect(toQueryDevtoolsYaml('hello')).toBe('hello\n');
    expect(toQueryDevtoolsYaml(null)).toBe('null\n');
  });

  it('should stop rather than spin on a cyclic value', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(() => toQueryDevtoolsYaml(cyclic)).not.toThrow();
  });

  it('should not expand a cycle reachable through two keys', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['x'] = cyclic;
    cyclic['y'] = cyclic;

    const start = Date.now();

    expect(() => toQueryDevtoolsYaml(cyclic)).not.toThrow();
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('should write a Date the way the JSON export does', () => {
    expect(toQueryDevtoolsYaml({ at: new Date('2020-01-02T03:04:05.000Z') })).toBe('at: "2020-01-02T03:04:05.000Z"\n');
  });
});
