import { describe, expect, it } from 'vitest';
import { inlineUiOf } from './inline-ui';

const kindsOf = (source: string) => inlineUiOf(source).map(({ anchor, kind }) => `${anchor} ${kind}`);

describe('inlineUiOf', () => {
  it('finds a raw button in a template', () => {
    expect(kindsOf('const save = () => html`<div><button type="button">Save</button></div>`;')).toEqual([
      'save <button>',
    ]);
  });

  it('finds bare markup made interactive with role, tabindex or an action', () => {
    expect(
      kindsOf(
        [
          'const target = html`<div class="x" role="button" tabindex="0" data-et-action="go"></div>`;',
          'const focus = html`<li tabindex="-1">${1}</li>`;',
          'const acting = \'<span data-et-action="emit:pick">x</span>\';',
        ].join('\n'),
      ),
    ).toEqual(['target role="button"', 'focus tabindex', 'acting data-et-action']);
  });

  it('finds raw SDK tags and SDK attributes', () => {
    expect(
      kindsOf(
        [
          'const controls = ng(`<et-switch [checked]="${on}" aria-label="x" />`, { imports: [\'SWITCH_IMPORTS\'] });',
          'const link = html`<a et-button href="/x">x</a>`;',
        ].join('\n'),
      ),
    ).toEqual(['controls <et-switch>', 'link [et-button]']);
  });

  it('finds a button written into embedded markup by a replace', () => {
    expect(kindsOf("export const act = (markup: string) => markup.replace(/<button\\b/, '<button data-x');")).toEqual([
      'act <button>',
    ]);
  });

  it('counts each tag once, across interpolations', () => {
    expect(kindsOf('const row = html`<div class="${a}" role="button" tabindex="0" data-et-action="${b}">`;')).toEqual([
      'row role="button"',
    ]);
  });

  it('leaves embedded part markup, plain markup and closing tags alone', () => {
    expect(
      kindsOf(
        [
          'const drawn = await button.render({ label: "x" });',
          'const page = html`<section class="p"><span>${drawn.body}</span></section>`;',
          'const embedded = html`<div data-et-part="components/x" data-et-action="go"></div>`;',
          "const kind = 'button';",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('names the nearest declaration, the module outside every one', () => {
    expect(kindsOf('export default html`<button></button>`;')).toEqual(['(module) <button>']);
  });

  it('reports the line and suggests the part to create', () => {
    expect(inlineUiOf('\nconst commentTarget = html`<div role="button"></div>`;')).toEqual([
      { anchor: 'commentTarget', kind: 'role="button"', line: 2, part: 'components/comment-target' },
    ]);
    expect(inlineUiOf('const c = ng(`<et-textarea />`);')[0]?.part).toBe('components/textarea');
    expect(inlineUiOf('const c = html`<button et-button>x</button>`;')[0]?.part).toBe('components/button');
  });
});
