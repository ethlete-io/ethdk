import { describe, expect, it } from 'vitest';
import { definePart, drawing, forceInteraction } from '../../../design/define-part';
import { markPart } from '../../../design/mark-part';

type Props = { label: string };

const source = {
  note: 'n',
  states: { filled: { label: 'Save' }, 'outline-wide': { label: 'Go' } },
  render: ({ label }: Props) => ({ body: `<button class="b">${label}</button>`, styles: 's' }),
};

const button = definePart(source);

describe('definePart', () => {
  it('keeps the state names in the type of states', () => {
    const outline: Props = button.states['outline-wide'];

    // @ts-expect-error a state the part does not have
    expect(button.states['pressed']).toBeUndefined();
    expect(outline).toEqual({ label: 'Go' });
  });

  it('types a grid against the state names and its own columns, and keeps it on the part', () => {
    const grid = { columns: ['rest', 'hover'], rows: { leaf: { rest: 'filled', hover: 'outline-wide' } } } as const;
    const gridded = definePart({ ...source, grid });

    definePart({
      ...source,
      // @ts-expect-error a state the part does not have
      grid: { columns: ['rest'], rows: { leaf: { rest: 'pressed' } } },
    });
    definePart({
      ...source,
      // @ts-expect-error a column the grid does not list
      grid: { columns: ['rest'], rows: { leaf: { hover: 'filled' } } },
    });

    expect(gridded.grid).toBe(grid);
    expect(button.grid).toBeUndefined();
  });

  it('types the surfaces of its controls against the state names, and keeps them on the part', () => {
    const controlled = definePart({
      ...source,
      controls: { more: { kind: 'disclosure', input: ['pointer'], surfaces: { body: 'filled' } } },
    });

    definePart({
      ...source,
      // @ts-expect-error a state the part does not have
      controls: { more: { kind: 'disclosure', input: ['pointer'], surfaces: { body: 'open' } } },
    });
    definePart({
      ...source,
      // @ts-expect-error a kind design complete does not know
      controls: { more: { kind: 'slider', input: ['pointer'], surfaces: { body: 'filled' } } },
    });

    definePart({
      ...source,
      controls: {
        // @ts-expect-error a control takes its interactions from a part or from its own states, not both
        more: { kind: 'disclosure', input: ['pointer'], part: 'components/toggle', surfaces: { body: 'filled' } },
      },
    });
    definePart({
      ...source,
      // @ts-expect-error a page draws no control for another part
      controls: { more: { kind: 'disclosure', part: 'pages/toggle', surfaces: { body: 'filled' } } },
    });
    definePart({
      ...source,
      controls: { more: { kind: 'disclosure', part: 'components/toggle', surfaces: { body: 'filled' } } },
    });

    definePart({
      ...source,
      controls: {
        go: { kind: 'button', input: ['pointer'], disabled: true },
        row: { kind: 'row', part: 'components/row' },
        tip: { kind: 'tooltip', part: 'components/tip', surfaces: { tooltip: 'filled' } },
        menu: { kind: 'menu', input: ['keyboard'], surfaces: { open: 'filled' } },
      },
    });
    definePart({
      ...source,
      // @ts-expect-error a select names the state that draws it open
      controls: { pick: { kind: 'select', input: ['pointer'], surfaces: { body: 'filled' } } },
    });

    expect(controlled.controls?.['more']?.surfaces).toEqual({ body: 'filled' });
  });

  it('forces an interaction on the root of the drawing, as a frame does', async () => {
    const later = definePart({ ...button, render: async (props: Props) => button.render(props) });

    expect(button.render({ label: 'a' })).toEqual({ body: '<button class="b">a</button>', styles: 's' });
    expect(button.render({ label: 'a' }, { interaction: 'hover' })).toEqual({
      body: '<button data-et-force="hover" class="b">a</button>',
      styles: 's',
    });
    expect(await later.render({ label: 'a' }, { interaction: 'disabled' })).toEqual({
      body: '<button disabled aria-disabled="true" class="b">a</button>',
      styles: 's',
    });
  });

  it('exposes its styles statically and draws them before the styles render returns', async () => {
    const styled = definePart({
      ...source,
      styles: '.b{}',
      render: ({ label }: Props) => ({ body: label, styles: '' }),
    });
    const later = definePart({ ...styled, render: async ({ label }: Props) => ({ body: label, styles: '.x{}' }) });

    expect(styled.styles).toBe('.b{}');
    expect(button.styles).toBeUndefined();
    expect(styled.render({ label: 'a' }, { interaction: 'hover' })).toEqual({ body: 'a', styles: '.b{}' });
    expect(await later.render({ label: 'a' })).toEqual({ body: 'a', styles: '.b{}\n.x{}' });
    expect(markPart(styled, 'components/b').styles).toBe('.b{}');
  });

  it('takes a drawing without styles and always draws a string of them', () => {
    const styled = definePart({ ...source, styles: '.b{}', render: ({ label }: Props) => drawing({ body: label }) });
    const bare = definePart({ ...source, render: ({ label }: Props) => drawing({ body: label }) });

    expect(styled.render({ label: 'a' })).toEqual({ body: 'a', styles: '.b{}' });
    expect(bare.render({ label: 'a' })).toEqual({ body: 'a', styles: '' });
  });

  it('forces an interaction on one element of the markup, below the root', () => {
    const row = (label: string, hovered: boolean) => {
      const markup = `<li class="row">${label}</li>`;

      return hovered ? forceInteraction(markup, 'hover') : markup;
    };

    expect(`<ul class="stack">${row('a', false)}${row('b', true)}</ul>`).toBe(
      '<ul class="stack"><li class="row">a</li><li data-et-force="hover" class="row">b</li></ul>',
    );
    expect(forceInteraction('<button>x</button>', 'disabled')).toBe('<button disabled aria-disabled="true">x</button>');
  });

  it('keeps the interaction through the part mark the design server adds', () => {
    expect(markPart(button, 'components/button').render({ label: 'a' }, { interaction: 'focus-visible' })).toEqual({
      body: '<button data-et-part="components/button" data-et-force="focus-visible" class="b">a</button>',
      styles: 's',
    });
  });

  it('types motions and rules against the state names, and keeps them on the part', () => {
    const moving = definePart({
      ...source,
      motions: { fold: { from: 'filled', to: 'outline-wide', at: [50], play: (ctx) => ctx.at(10, () => undefined) } },
      rules: [{ on: 'click .open', to: 'outline-wide', motion: 'fold' }],
    });

    definePart({
      ...source,
      // @ts-expect-error a state the part does not have
      motions: { fold: { from: 'filled', to: 'open' } },
    });
    definePart({
      ...source,
      // @ts-expect-error a state the part does not have
      rules: [{ on: 'click .open', to: 'open' }],
    });

    expect(Object.keys(moving.motions ?? {})).toEqual(['fold']);
    expect(button.motions).toBeUndefined();
  });
});
