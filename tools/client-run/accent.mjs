import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCENT = /--color-et-accent:\s*rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)/;

/** The product accent a 46 B catalog page declares, as `#rrggbb`; throws when the page declares none. */
export const accentOf = (html) => {
  const match = ACCENT.exec(html);
  if (!match) throw new Error('the 46 B catalog declares no --color-et-accent');
  return `#${match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};

export const referenceAccentOf = (referenceDir) =>
  accentOf(readFileSync(join(referenceDir, 'katalog-46b-desktop.html'), 'utf8'));
