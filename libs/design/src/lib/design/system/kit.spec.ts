import { describe, expect, it } from 'vitest';
import { importsKit, kitUsesOf } from './kit';

describe('kitUsesOf', () => {
  it('counts each call of a named kit import', () => {
    const source = `import { definePart, drawing } from '@design-system';
import { box, button, textLines } from '@design-system/kit';
export default definePart({ note: '', states: {}, render: () => drawing({ body: box([textLines(), textLines({ lines: 2 }), button('Go')]), styles: '' }) });
`;

    expect(kitUsesOf(source)).toBe(4);
  });

  it('counts calls through a namespace import and an alias', () => {
    const source = `import * as kit from '@design-system/kit';
import { image as picture } from '@design-system/kit';
const body = kit.box([picture(), kit.icon()]);
`;

    expect(kitUsesOf(source)).toBe(3);
  });

  it('counts nothing in a page that does not import the kit', () => {
    const source = `const box = (body: string) => body;
box('x');
`;

    expect(kitUsesOf(source)).toBe(0);
    expect(importsKit(source)).toBe(false);
  });
});
