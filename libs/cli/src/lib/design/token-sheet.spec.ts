// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountDrawing } from '../../../design/define-call';
import { tokenSheet } from '../../../design/define-part';

const css = `
  :root {
    --space-1: 0.4rem;
    --accent: #3355ff;
  }
  [data-theme='dark'] {
    --accent: #6677ff;
  }
`;

describe('tokenSheet', () => {
  it('lists each token of the css once and labels it with the value the drawing resolves', () => {
    const root = document.createElement('div');
    const ran: string[] = [];
    const sheet = tokenSheet({
      title: 'Tokens',
      css,
      sample: '',
      sampleOf: (name) => `<i>${name}</i>`,
      only: (name) => name !== 'space-1',
      styles: '.extra {}',
      setup: () => ran.push('part'),
    });

    root.style.setProperty('--accent', '#6677ff');
    expect(mountDrawing(root, sheet)).toBeNull();

    const rows = [...root.querySelectorAll('.ts-row')].map((row) => row.textContent?.replace(/\s+/gu, ' ').trim());
    expect(rows).toEqual(['--accent#6677ffaccent']);
    expect(ran).toEqual(['part']);
    expect(sheet.styles).toContain('.extra {}');
  });
});
