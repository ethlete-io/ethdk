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

  it('keeps the built state names in the type of a part', () => {
    const part = definePart({ note: 'n', ...built, render: ({ label }: Props) => ({ body: label, styles: '' }) });
    const hovered: Props = part.states['count-hover'];

    // @ts-expect-error a state the rows do not build
    expect(part.states['count-active']).toBeUndefined();
    expect(hovered.interaction).toBe('hover');
  });
});
