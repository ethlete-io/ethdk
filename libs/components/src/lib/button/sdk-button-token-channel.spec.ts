import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const buttonDir = dirname(fileURLToPath(import.meta.url));
const libDir = dirname(buttonDir);

const findCssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (full === buttonDir) return [];
    return entry.isDirectory() ? findCssFiles(full) : entry.name.endsWith('.css') ? [full] : [];
  });

const APP_CHANNEL_TOKENS =
  /(^|[^-\w])(--et-button-(padding|border-radius|font-size|gap|line-height)|--et-icon-button-(size|icon-size|border-radius))\s*:/g;

describe('SDK-rendered button geometry', () => {
  it.each(findCssFiles(libDir).map((file) => relative(libDir, file)))(
    'sets the private --_et-* button tokens, never the app-facing ones, in %s',
    (relativeFile) => {
      const css = readFileSync(join(libDir, relativeFile), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const writes = [...css.matchAll(APP_CHANNEL_TOKENS)].map((match) => match[2]);

      expect(
        writes,
        `${relativeFile} writes app-facing button tokens; an app's unlayered .et-button rule beats them. Set the --_et-* twin instead.`,
      ).toEqual([]);
    },
  );
});
