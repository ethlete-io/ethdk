import { describe, expect, it } from 'vitest';
import { definePart } from '../../../design/define-part';
import { markPart } from '../../../design/mark-part';

type Props = { label: string };

const button = definePart({
  note: 'n',
  states: { filled: { label: 'Save' }, 'outline-wide': { label: 'Go' } },
  render: ({ label }: Props) => ({ body: `<button class="b">${label}</button>`, styles: 's' }),
});

describe('definePart', () => {
  it('keeps the state names in the type of states', () => {
    const outline: Props = button.states['outline-wide'];

    // @ts-expect-error a state the part does not have
    expect(button.states['pressed']).toBeUndefined();
    expect(outline).toEqual({ label: 'Go' });
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

  it('keeps the interaction through the part mark the design server adds', () => {
    expect(markPart(button, 'components/button').render({ label: 'a' }, { interaction: 'focus-visible' })).toEqual({
      body: '<button data-et-part="components/button" data-et-force="focus-visible" class="b">a</button>',
      styles: 's',
    });
  });
});
