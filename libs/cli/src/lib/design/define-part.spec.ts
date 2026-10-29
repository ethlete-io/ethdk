import { describe, expect, it } from 'vitest';
import { definePart } from '../../../design/define-part';
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

  it('keeps the interaction through the part mark the design server adds', () => {
    expect(markPart(button, 'components/button').render({ label: 'a' }, { interaction: 'focus-visible' })).toEqual({
      body: '<button data-et-part="components/button" data-et-force="focus-visible" class="b">a</button>',
      styles: 's',
    });
  });
});
