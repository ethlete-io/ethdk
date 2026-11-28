import { designServerScopeArgs, enterDesignServerScope, OWN_SCOPE_ENV } from './own-scope';

const depsOf = (cgroups: string[], overrides: Partial<Parameters<typeof enterDesignServerScope>[0]> = {}) => {
  const calls: string[][] = [];
  const lines: string[] = [];
  let read = 0;

  return {
    calls,
    lines,
    deps: {
      env: {} as NodeJS.ProcessEnv,
      platform: 'linux' as NodeJS.Platform,
      pid: 42,
      busctl: (args: string[]) => void calls.push(args),
      readCgroup: () => `0::${cgroups[Math.min(read++, cgroups.length - 1)]}\n`,
      log: (line: string) => void lines.push(line),
      ...overrides,
    },
  };
};

describe('the design server scope', () => {
  it('moves the server into its own capped scope and marks it for its children', () => {
    const { deps, calls } = depsOf(['/app.slice/tmux-spawn-1.scope', '/app.slice/design-server-42.scope']);

    expect(enterDesignServerScope(deps)).toBe('design-server-42.scope');
    expect(calls).toEqual([designServerScopeArgs('design-server-42.scope', 42)]);
    expect(deps.env[OWN_SCOPE_ENV]).toBe('design-server-42.scope');
  });

  it('caps memory, forbids swap and kills the whole server', () => {
    const args = designServerScopeArgs('design-server-1.scope', 1);
    const valueOf = (name: string) => args[args.indexOf(name) + 2];

    expect(valueOf('MemoryMax')).toBe(String(12 * 1024 ** 3));
    expect(valueOf('MemoryHigh')).toBe(String(8 * 1024 ** 3));
    expect(valueOf('MemorySwapMax')).toBe('0');
    expect(valueOf('OOMPolicy')).toBe('kill');
  });

  it('stays in the scope of the e2e run that started it', () => {
    const { deps, calls } = depsOf(['/app.slice/studio-e2e-7.scope']);

    deps.env[OWN_SCOPE_ENV] = 'studio-e2e-7.scope';

    expect(enterDesignServerScope(deps)).toBe('studio-e2e-7.scope');
    expect(calls).toEqual([]);
  });

  it('runs where it was started without a systemd user manager', () => {
    const { deps, lines } = depsOf(['/'], {
      busctl: () => {
        throw Object.assign(new Error('failed'), { stderr: 'Failed to connect to bus: No medium found' });
      },
    });

    expect(enterDesignServerScope(deps)).toBeNull();
    expect(lines[0]).toContain('No medium found');
    expect(enterDesignServerScope({ ...deps, platform: 'darwin' })).toBeNull();
  });
});
