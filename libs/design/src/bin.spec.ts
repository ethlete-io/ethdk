import { describe, expect, it, vi } from 'vitest';
import { runDesignEntry } from './bin';

describe('runDesignEntry', () => {
  it('runs `design --help` like `et design --help`', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await runDesignEntry(['design', '--help'], __dirname)).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toContain('design check');
    log.mockRestore();
  });

  it('refuses arguments that do not start with `design`', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await runDesignEntry(['mcp'], __dirname)).toBe(1);
    error.mockRestore();
  });
});
