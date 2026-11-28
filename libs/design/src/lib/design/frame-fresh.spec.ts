import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from './design-config';
import { createDesignServer } from './serve';
import { reachableBaseOf } from './system/served-cache';
import { fsUrl } from './vite-paths';

const dirs: string[] = [];
const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const checkout = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'design-frame-fresh-')));

  dirs.push(target);
  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'kit'));

  return target;
};

const writeSource = (file: string, word: string, at: number) => {
  writeFileSync(file, `export default '${word}';\n`);
  utimesSync(file, at / 1000, at / 1000);
};

describe('an unwatched design server asked for a frame', () => {
  it('serves the modules of the frame from the source as it is now, not as it was first drawn', async () => {
    const target = checkout();
    const source = join(target, 'kit', 'word.ts');

    writeSource(source, 'drawn-first', Date.now() - 60_000);

    const server = await createDesignServer({ target, config: readConfig(target) ?? {}, listen: true, port: 0 });

    try {
      await server.listen();

      const address = server.httpServer?.address();

      if (!address || typeof address === 'string') throw new Error('the design server has no address');

      const base = reachableBaseOf(address);
      const moduleText = () => fetch(new URL(fsUrl(source), base)).then((response) => response.text());

      expect(await moduleText()).toContain('drawn-first');

      writeSource(source, 'edited-later', Date.now() + 60_000);

      expect(await moduleText()).toContain('drawn-first');

      await fetch(new URL('/frame.html', base)).then((response) => response.text());

      expect(await moduleText()).toContain('edited-later');
    } finally {
      await server.close();
    }
  }, 60_000);
});
