import { describe, expect, it } from 'vitest';
import { classesOf, cssBlocksOf, declarationValueOf } from './css-source';

describe('cssBlocksOf', () => {
  it('tells selectors from declarations, through nesting and at-rules', () => {
    const blocks = cssBlocksOf(`
      @layer components {
        /* #fff in a comment */
        #main .card:hover { color: var(--c); &.is-on { padding: 0 } }
      }
    `);

    expect(blocks.selectors).toEqual(['#main .card:hover', '&.is-on']);
    expect(blocks.declarations).toEqual(['color: var(--c)', 'padding: 0']);
  });

  it('reads trailing text as a declaration', () => {
    expect(cssBlocksOf('color: red').declarations).toEqual(['color: red']);
  });
});

describe('declarationValueOf', () => {
  it('takes the text after the first colon', () => {
    expect(declarationValueOf('background: url(a:b)')).toBe(' url(a:b)');
    expect(declarationValueOf('no colon')).toBeNull();
  });
});

describe('classesOf', () => {
  it('names each class of a selector, not ids or numbers', () => {
    expect(classesOf('#main .card.card--on:hover > a[href] .x-1')).toEqual(['card', 'card--on', 'x-1']);
    expect(classesOf('1.5rem')).toEqual([]);
  });
});
