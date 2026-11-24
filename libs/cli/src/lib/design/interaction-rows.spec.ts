import { describe, expect, it } from 'vitest';
import { definePart, interactionRows } from '../../../design/define-part';

type Props = { label: string; interaction?: string };

describe('interactionRows', () => {
  const built = interactionRows(
    { plain: { label: 'a' }, count: { label: 'b' } },
    { interactions: ['hover', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  );

  it('draws each row at rest and in each interaction, and lays them out as a grid', () => {
    expect(built.states).toEqual({
      plain: { label: 'a' },
      'plain-hover': { label: 'a', interaction: 'hover' },
      'plain-focus-visible': { label: 'a', interaction: 'focus-visible' },
      count: { label: 'b' },
      'count-hover': { label: 'b', interaction: 'hover' },
      'count-focus-visible': { label: 'b', interaction: 'focus-visible' },
    });
    expect(built.grid).toEqual({
      columns: ['rest', 'hover', 'focus-visible'],
      rows: {
        plain: { rest: 'plain', hover: 'plain-hover', 'focus-visible': 'plain-focus-visible' },
        count: { rest: 'count', hover: 'count-hover', 'focus-visible': 'count-focus-visible' },
      },
    });
  });

  it('draws a disabled row only at rest', () => {
    const rows = interactionRows(
      { save: { label: 'a' }, off: { label: 'b', disabled: true } },
      { interactions: ['hover', 'active'], force: (props, interaction) => ({ ...props, interaction }) },
    );

    expect(Object.keys(rows.states)).toEqual(['save', 'save-hover', 'save-active', 'off']);
    expect(rows.grid.rows.off).toEqual({ rest: 'off' });
  });

  it('draws a row named in restOnly only at rest, and leaves its interactions out of the type', () => {
    const rows = interactionRows(
      { film: { label: 'a' }, series: { label: 'b' } },
      { interactions: ['hover'], force: (props, interaction) => ({ ...props, interaction }), restOnly: ['series'] },
    );

    expect(Object.keys(rows.states)).toEqual(['film', 'film-hover', 'series']);
    expect(rows.grid.rows.series).toEqual({ rest: 'series' });

    // @ts-expect-error a rest-only row has no interaction state
    expect(rows.states['series-hover']).toBeUndefined();
  });

  it('keeps the built state names in the type of a part', () => {
    const describe = Object.fromEntries(Object.keys(built.states).map((state) => [state, `the ${state} row`]));
    const part = definePart({
      note: 'n',
      ...built,
      describe: describe as Record<keyof typeof built.states, string>,
      render: ({ label }: Props) => ({ body: label, styles: '' }),
    });
    const hovered: Props = part.states['count-hover'];

    // @ts-expect-error a state the rows do not build
    expect(part.states['count-active']).toBeUndefined();
    expect(hovered.interaction).toBe('hover');
  });
});
