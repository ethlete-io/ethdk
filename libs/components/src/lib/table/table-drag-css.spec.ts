import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const readCss = (file: string) =>
  readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('table drag CSS', () => {
  it.each(['table-reorder-overlay.component.css', 'table-drag-scroll-styles.component.css'])(
    'pairs every user-select: none with the -webkit- prefix Safari needs in %s',
    (file) => {
      const blocks = readCss(file).match(/\{[^{}]*\}/g) ?? [];
      const selecting = blocks.filter((block) => /(^|[^-])user-select:\s*none/.test(block));

      expect(selecting.length).toBeGreaterThan(0);
      for (const block of selecting) {
        expect(block).toMatch(/-webkit-user-select:\s*none/);
      }
    },
  );
});
