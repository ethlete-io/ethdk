import { argsOf } from './cli-args';

describe('argsOf', () => {
  it('refuses a flag the command does not know and lists the flags it does', () => {
    expect(argsOf(['part', '--prodct', 'studio'], ['--product'], ['--json'])).toBe(
      'unknown flag --prodct (flags: --product, --json)',
    );
  });

  it('takes the known switches and value flags', () => {
    const args = argsOf(['part', '--json', '--product', 'studio'], ['--product'], ['--json']);

    expect(typeof args === 'string' ? args : [args.positional, args.values, [...args.flags]]).toEqual([
      ['part'],
      { '--product': 'studio' },
      ['--json'],
    ]);
  });

  it('names no flags for a command that takes none', () => {
    expect(argsOf(['--x'], [], [])).toBe('unknown flag --x (flags: none)');
  });
});
