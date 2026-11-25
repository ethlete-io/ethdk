import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const filesUnder = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

const stagedSdk = () => {
  const out = mkdtempSync(join(tmpdir(), 'stage-design-base-'));

  execFileSync('node', ['tools/scripts/stage-design-base.mjs', 'sdk', relative(root, out)], { cwd: root });

  return out;
};

test('every stylesheet import and asset url of the shipped sdk design base resolves inside it', () => {
  const out = stagedSdk();

  try {
    const sdk = join(out, 'sdk');
    const outside = filesUnder(sdk)
      .filter((file) => file.endsWith('.css'))
      .flatMap((file) => {
        const css = readFileSync(file, 'utf8');
        const imports = [...css.matchAll(/@import\s+['"](\.[^'"]+)['"]/gu)].map((match) =>
          resolve(dirname(file), match[1]),
        );
        const assets = [...css.matchAll(/url\(\s*['"]?@assets\/([^'")?#]+)/gu)].map((match) =>
          join(sdk, 'assets', match[1]),
        );

        return [...imports, ...assets]
          .filter((target) => !target.startsWith(`${sdk}${sep}`) || !existsSync(target))
          .map((target) => `${relative(out, file)} -> ${relative(out, target)}`);
      });

    assert.deepEqual(outside, []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// tomflix needs 0 glyphs from the Noto fallbacks, so the package does not ship 650 KB for nothing.
test('the shipped sdk design base carries no Noto fallback font', () => {
  const out = stagedSdk();

  try {
    const noto = filesUnder(join(out, 'sdk')).filter(
      (file) => /noto/iu.test(file) || (file.endsWith('.css') && /noto-sans/iu.test(readFileSync(file, 'utf8'))),
    );

    assert.deepEqual(
      noto.map((file) => relative(out, file)),
      [],
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
