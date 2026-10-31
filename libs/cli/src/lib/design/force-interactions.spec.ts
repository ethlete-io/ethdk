// @vitest-environment jsdom
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { forceInteractions, forceInteractionsPlugin } from './force-interactions';

const HOVER = ':is(:hover, [data-et-force~="hover"])';
const FOCUS = ':is(:focus-visible, [data-et-force~="focus-visible"])';
const ACTIVE = ':is(:active, [data-et-force~="active"])';

describe('forceInteractions', () => {
  it('lets an attribute force each interaction pseudo-class', () => {
    expect(forceInteractions('.x:hover { color: red; }')).toBe(`.x${HOVER} { color: red; }`);
    expect(forceInteractions('.x:focus-visible{}')).toBe(`.x${FOCUS}{}`);
    expect(forceInteractions('.x:active{}')).toBe(`.x${ACTIVE}{}`);
    expect(forceInteractions('.x:HOVER{}')).toBe(`.x${HOVER}{}`);
  });

  it('rewrites the pseudo-class on an ancestor, before a pseudo-element and in every selector of a list', () => {
    expect(forceInteractions('.a:hover .b, .c:active::before {}')).toBe(`.a${HOVER} .b, .c${ACTIVE}::before {}`);
  });

  it('rewrites inside :not(), :is() and :where()', () => {
    expect(forceInteractions('.x:not(:hover), :is(.a:active), :where(.b:focus-visible) {}')).toBe(
      `.x:not(${HOVER}), :is(.a${ACTIVE}), :where(.b${FOCUS}) {}`,
    );
  });

  it('leaves look-alike pseudo-classes alone', () => {
    const css = '.x:focus {} .x:active-something {} .x:any-link {} a::hover {}';

    expect(forceInteractions(css)).toBe(css);
  });

  it('matches :focus-within on every ancestor of an element forced to focus-visible', () => {
    const css = forceInteractions('.field:focus-within { color: red; }');
    document.body.innerHTML = `<style>${css}</style><div class="field"><div><input data-et-force="focus-visible"></div></div><div class="field"><input></div>`;

    const [forced, rest] = document.querySelectorAll('.field');

    expect(getComputedStyle(forced!).color).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(rest!).color).not.toBe('rgb(255, 0, 0)');
  });

  it('leaves strings, comments, urls and declarations alone', () => {
    const css = [
      '/* .x:hover {} */',
      '[title=":hover"] { content: ":active"; background: url("a:hover.png"); }',
      '.y { --state: :hover; }',
    ].join('\n');

    expect(forceInteractions(css)).toBe(css);
  });

  it('rewrites nested rules and rules inside at-rules', () => {
    expect(forceInteractions('.x { &:hover { color: red; } } @media (hover: hover) { .y:active {} }')).toBe(
      `.x { &${HOVER} { color: red; } } @media (hover: hover) { .y${ACTIVE} {} }`,
    );
  });

  it('is safe to run again on its own output', () => {
    const once = forceInteractions('.a:hover .b:not(:focus-visible) {}');

    expect(forceInteractions(once)).toBe(once);
  });

  it('returns CSS it cannot parse unchanged', () => {
    expect(forceInteractions('.x:hover { color: red;')).toBe('.x:hover { color: red;');
    expect(forceInteractions('.x:hover }} {')).toBe('.x:hover }} {');
  });
});

describe('forceInteractionsPlugin in the Vite pipeline', () => {
  it('rewrites a plain CSS import, an ?inline import and an inline style of the frame page', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-force-'));

    writeFileSync(join(root, 'button.css'), '.b:hover { color: red; }');
    writeFileSync(join(root, 'frame.html'), '<html><head><style>.c:active { color: red; }</style></head></html>');

    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: false,
      root,
      logLevel: 'error',
      css: { postcss: { plugins: [forceInteractionsPlugin()] } },
      server: { middlewareMode: true, ws: false, watch: null },
      appType: 'custom',
    });

    try {
      const plain = await vite.transformRequest('/button.css');
      const inline = await vite.transformRequest('/button.css?inline');
      const html = await vite.transformIndexHtml('/frame.html', readFileSync(join(root, 'frame.html'), 'utf8'));

      const inJs = JSON.stringify(`.b${HOVER}`).slice(1, -1);

      expect(plain?.code).toContain(inJs);
      expect(inline?.code).toContain(inJs);
      expect(html).toContain(`.c${ACTIVE}`);
    } finally {
      await vite.close();
    }
  });
});
