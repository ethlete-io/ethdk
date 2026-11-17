import { describe, expect, it } from 'vitest';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { innerOnlyPartOf, innerOnlyStatesOf, pageStateInnerOf } from './page-state-inner';

const OWN = 'pages/home';

const trigger = (open: boolean, reason = '<span data-et-slot="components/hold">Wartet</span>') =>
  `<span data-et-part="components/hold"><button aria-expanded="${open}">Pausiert</button><span ${open ? '' : 'hidden'}>${reason}</span></span>`;

const page = (inner: string, extra = '') =>
  `<main data-et-part="${OWN}"><h1>Sketch</h1>${extra}${inner}<input value="a"><img src="x.png"/></main>`;

describe('innerOnlyPartOf', () => {
  it('names the one inner part that holds every difference', () => {
    expect(innerOnlyPartOf({ own: OWN, base: page(trigger(false)), state: page(trigger(true)) })).toBe(
      'components/hold',
    );
  });

  it('allows a state that also changes the page itself', () => {
    expect(
      innerOnlyPartOf({ own: OWN, base: page(trigger(false)), state: page(trigger(true), '<p>Fehler</p>') }),
    ).toBeNull();
  });

  it('counts markup the page passes into a part as the page own', () => {
    expect(
      innerOnlyPartOf({
        own: OWN,
        base: page(trigger(true)),
        state: page(trigger(true, '<span data-et-slot="components/hold">Wartet auf B</span>')),
      }),
    ).toBeNull();
  });

  it('allows a state that changes two inner parts', () => {
    const badge = (label: string) => `<span data-et-part="components/badge">${label}</span>`;

    expect(
      innerOnlyPartOf({
        own: OWN,
        base: page(trigger(false) + badge('neu')),
        state: page(trigger(true) + badge('alt')),
      }),
    ).toBeNull();
  });

  it('names the innermost part of nested parts that holds the change', () => {
    const card = (busy: boolean) =>
      `<div data-et-part="components/flow"><form data-et-part="components/draft"><button ${busy ? 'aria-busy="true"' : ''}>Senden</button></form></div>`;

    expect(innerOnlyPartOf({ own: OWN, base: page(card(false)), state: page(card(true)) })).toBe('components/draft');
  });

  it('reads a style element as text, not markup', () => {
    const styled = (open: boolean) => `<style>.a > b { color: red }</style>${trigger(open)}`;

    expect(innerOnlyPartOf({ own: OWN, base: page(styled(false)), state: page(styled(true)) })).toBe('components/hold');
  });
});

describe('innerOnlyStatesOf', () => {
  const definition = {
    states: {
      rest: {},
      paused: { status: 'paused' },
      'paused-open': { status: 'paused', open: true },
      error: { status: 'paused', open: true, error: true },
    },
    render: ({ status, open = false, error = false }: { status?: string; open?: boolean; error?: boolean }) => ({
      body: page(trigger(open), `${status ? `<em>${status}</em>` : ''}${error ? '<p>Fehler</p>' : ''}`),
      styles: '',
    }),
  };

  it('compares a state with the default and with each state whose props it repeats', async () => {
    expect(await innerOnlyStatesOf({ own: OWN, definition })).toEqual([
      { state: 'paused-open', base: 'paused', part: 'components/hold' },
    ]);
  });

  it('places each hit at its state', async () => {
    const problems = await pageStateInnerOf({
      load: async () => ({ default: definition }),
      product: { name: 'app-a' } as ResolvedProduct,
      parts: [{ file: '/p/home.ts', layer: 'pages', name: 'home', origin: 'product' } as ResolvedPart],
    });

    expect(problems.map(({ at, states }) => ({ at, states }))).toEqual([
      { at: 'paused-open', states: ['paused-open'] },
    ]);
  });
});
