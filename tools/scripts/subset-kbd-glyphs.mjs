import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontverter from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fonts = join(root, '.ethlete/design/sdk/assets/fonts');

export const LABELS_FILE = join(root, 'libs/components/src/lib/kbd/kbd-labels.ts');
export const TEXT_FONTS = [
  join(fonts, 'source-sans-3-latin-wght-normal.woff2'),
  join(fonts, 'source-code-pro-latin-wght-normal.woff2'),
];
export const SUBSETS = [
  { source: join(fonts, 'noto-sans-math-latin-400-normal.woff2'), out: join(fonts, 'et-kbd-arrows-400-normal.woff2') },
  {
    source: join(fonts, 'noto-sans-symbols-2-symbols-400-normal.woff2'),
    out: join(fonts, 'et-kbd-keys-400-normal.woff2'),
  },
  {
    source: join(root, 'node_modules/@fontsource/noto-sans-symbols/files/noto-sans-symbols-symbols-400-normal.woff2'),
    out: join(fonts, 'et-kbd-control-400-normal.woff2'),
  },
];

export const labelCharacters = (source = readFileSync(LABELS_FILE, 'utf8')) =>
  new Set([...source.matchAll(/(?:label: |everywhere\()'([^']*)'/gu)].flatMap((match) => [...match[1]]));

export const cmapOf = async (file) => {
  const face = new Face(new Blob(await fontverter.convert(readFileSync(file), 'truetype')), 0);

  return new Set([...face.collectUnicodes()].map((code) => String.fromCodePoint(code)));
};

export const KBD_FACE_RANGE = { first: 0x2190, last: 0x23ff };

const inKbdFaceRange = (char) =>
  char.codePointAt(0) >= KBD_FACE_RANGE.first && char.codePointAt(0) <= KBD_FACE_RANGE.last;

export const kbdFaceGlyphs = async () => {
  const texts = [];

  for (const file of TEXT_FONTS) texts.push(await cmapOf(file));

  return [...labelCharacters()].filter((char) => inKbdFaceRange(char) || texts.some((text) => !text.has(char)));
};

const main = async () => {
  const wanted = await kbdFaceGlyphs();
  const left = new Set(wanted);

  for (const { source, out } of SUBSETS) {
    const cmap = await cmapOf(source);
    const glyphs = [...left].filter((char) => cmap.has(char));

    glyphs.forEach((char) => left.delete(char));
    writeFileSync(out, await subsetFont(readFileSync(source), glyphs.join(''), { targetFormat: 'woff2' }));
    console.log(`${relative(root, out)}: ${glyphs.join(' ')}`);
  }

  if (left.size) {
    console.error(`No source font has ${[...left].join(' ')}`);
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
