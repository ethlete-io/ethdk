// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { tokenSheet } from '../../../design/token-sheet';

describe('tokenSheet', () => {
  const styles = tokenSheet({ title: 't', css: '', sample: '', sampleOf: () => '' }).styles ?? '';

  it('gives every custom property in its own styles a fallback, so products without Studio tokens still draw', () => {
    const bare = [...styles.matchAll(/var\(--[a-z0-9-]+\)/g)].map((match) => match[0]);

    expect(bare).toEqual([]);
    expect(styles).toContain('var(--space-4, 1.6rem)');
  });

  const draw = (options: { scope?: string; note?: string }) => {
    const sheet = tokenSheet({ title: 't', css: '--tone: x;', sample: '', sampleOf: () => '', ...options });
    const root = document.createElement('div');
    root.innerHTML = `<style>.theme-a { --tone: red; }</style>${sheet.body}`;
    document.body.replaceChildren(root);
    for (const setup of [sheet.setup ?? []].flat()) setup(root);

    return root;
  };

  it('reads a value scoped to a theme class when the sheet carries the class as its scope', () => {
    expect(draw({}).querySelector('[data-token="tone"]')?.textContent).toBe('');
    expect(draw({ scope: 'theme-a' }).querySelector('[data-token="tone"]')?.textContent).toBe('red');
  });

  it('draws the note under the title, and nothing without one', () => {
    expect(draw({}).querySelector('.ts-note')).toBeNull();
    expect(draw({ note: 'Demo <b>theme</b>' }).querySelector('.ts-title + .ts-note')?.innerHTML).toBe(
      'Demo <b>theme</b>',
    );
  });
});
