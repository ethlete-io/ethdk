import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';

const serveDesign = vi.hoisted(() => vi.fn(async () => 0));

vi.mock('./serve', () => ({ serveDesign }));

describe('a design server Studio starts', () => {
  const root = mkdtempSync(join(tmpdir(), 'started-by-studio-'));

  afterEach(() => {
    vi.unstubAllEnvs();
    serveDesign.mockClear();
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('never reloads itself on a rebuild of the cli', async () => {
    vi.stubEnv('ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE', '1');

    await designCommand({ root, argv: [], invocation: 'et design' });

    expect(serveDesign).toHaveBeenCalledWith(expect.objectContaining({ reloadOnRebuild: false }));
  });

  it('reloads on a rebuild when it runs from a terminal', async () => {
    vi.stubEnv('ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE', '');

    await designCommand({ root, argv: [], invocation: 'et design' });

    expect(serveDesign).toHaveBeenCalledWith(expect.objectContaining({ reloadOnRebuild: true }));
  });
});
