import { describe, expect, it } from 'vitest';
import { calledNamesOf, importsOf, textsOf } from './ts-source';

describe('importsOf', () => {
  it('lists static, type and dynamic imports, and ignores comments and strings', () => {
    const source = `
      import { definePart } from '@design-system';
      import type { Film } from '@system/fixtures';
      // import nope from 'commented';
      const text = "import x from 'in-a-string'";
      const lazy = () => import('./lazy');
    `;

    expect(importsOf(source)).toEqual(['@design-system', '@system/fixtures', './lazy']);
  });
});

describe('textsOf', () => {
  it('collects string literals and template chunks', () => {
    expect(textsOf('const a = "x"; const b = `<p class="${a}">y</p>`;')).toEqual(['x', '<p class="', '">y</p>']);
  });
});

describe('calledNamesOf', () => {
  it('names direct and member calls', () => {
    expect(calledNamesOf('window.requestAnimationFrame(f); setInterval(g, 1); const s = "setInterval(";')).toEqual([
      'requestAnimationFrame',
      'setInterval',
    ]);
  });
});
