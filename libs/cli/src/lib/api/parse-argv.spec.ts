import { describe, expect, it } from 'vitest';
import { parseApiArgv } from './parse-argv';

describe('parseApiArgv', () => {
  it('reads positionals and keeps flags in the head', () => {
    const parsed = parseApiArgv(['up', 'hub', '--host']);

    expect(parsed.positionals).toEqual(['up', 'hub']);
    expect(parsed.head).toEqual(['up', 'hub', '--host']);
    expect(parsed.rest).toBeUndefined();
  });

  it('hands everything after the first -- over unchanged', () => {
    const parsed = parseApiArgv(['exec', 'hub', 'app', '--', 'ls', '-la', '--help', '--', 'x']);

    expect(parsed.positionals).toEqual(['exec', 'hub', 'app']);
    expect(parsed.head).toEqual(['exec', 'hub', 'app']);
    expect(parsed.rest).toEqual(['ls', '-la', '--help', '--', 'x']);
  });

  it('reports an empty command after --', () => {
    expect(parseApiArgv(['exec', 'hub', 'app', '--']).rest).toEqual([]);
  });

  it('lets --profile and --wait consume their value', () => {
    const parsed = parseApiArgv(['ready', 'hub', '--profile', 'e2e', '--wait', '30', 'app']);

    expect(parsed.positionals).toEqual(['ready', 'hub', 'app']);
    expect(parsed.profile).toBe('e2e');
    expect(parsed.wait).toBe('30');
  });

  it('reads the --flag=value form', () => {
    const parsed = parseApiArgv(['ready', 'hub', '--profile=e2e']);

    expect(parsed.positionals).toEqual(['ready', 'hub']);
    expect(parsed.profile).toBe('e2e');
  });

  it('leaves a value flag without a value undefined', () => {
    expect(parseApiArgv(['ready', 'hub', '--profile']).profile).toBeUndefined();
  });

  it('keeps a comma list as one positional', () => {
    expect(parseApiArgv(['up', 'hub,fut']).positionals).toEqual(['up', 'hub,fut']);
  });
});
