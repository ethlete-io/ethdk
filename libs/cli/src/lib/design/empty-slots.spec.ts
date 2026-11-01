// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { emptySlotsScriptOf } from './shot';

const PAGE =
  '<div data-et-part="elements/shell-main pages/flows">' +
  '<main data-et-projected="canvas">' +
  '<section data-et-slot="elements/shell-main">' +
  '<div data-et-part="components/canvas-viewport" data-et-slot="elements/shell-main" data-et-projected="content"><b data-et-slot="components/canvas-viewport">card</b></div>' +
  '</section>' +
  '</main>' +
  '<aside data-et-part="components/panel" data-et-slot="elements/shell-main">' +
  '<p data-et-slot="components/panel elements/shell-main" data-et-projected="pane">pane</p>' +
  '</aside>' +
  '</div>';

const emptyFor = (part: string) => new Function(`return ${emptySlotsScriptOf(part)}`)();
const textOf = (selector: string) => document.querySelector(selector)?.textContent;

describe('emptySlotsScriptOf', () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
  });

  it('keeps the slots of embedded parts when it empties a page', () => {
    emptyFor('pages/flows');

    expect(textOf('[data-et-projected="canvas"]')).toBe('card');
    expect(textOf('[data-et-projected="content"]')).toBe('card');
  });

  it('empties a slot the page passes into an embedded part as its own', () => {
    emptyFor('pages/flows');

    expect(textOf('[data-et-projected="pane"]')).toBe('');
  });

  it('empties the own slot of the compared part', () => {
    emptyFor('components/canvas-viewport');

    expect(textOf('[data-et-projected="content"]')).toBe('');
    expect(textOf('[data-et-projected="pane"]')).toBe('pane');
  });

  it('empties a slot outside any marked part', () => {
    document.body.innerHTML = '<div data-et-projected="content"><b>x</b></div>';

    emptyFor('components/canvas-viewport');

    expect(textOf('[data-et-projected="content"]')).toBe('');
  });
});
