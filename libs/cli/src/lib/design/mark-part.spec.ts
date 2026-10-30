import { describe, expect, it } from 'vitest';
import { markBody, markPart, markSlot } from '../../../design/mark-part';

describe('markBody', () => {
  it('marks the first element', () => {
    expect(markBody('<article class="card"><h3>A</h3></article>', 'components/card')).toBe(
      '<article data-et-part="components/card" class="card"><h3>A</h3></article>',
    );
  });

  it('skips leading whitespace, comments, styles, scripts and links', () => {
    expect(
      markBody(
        '\n  <!-- a --><style>.a > b { color: red }</style><script>1 < 2</script><link rel="x"><et-button>Go</et-button>',
        'components/button',
      ),
    ).toBe(
      '\n  <!-- a --><style>.a > b { color: red }</style><script>1 < 2</script><link rel="x"><et-button data-et-part="components/button">Go</et-button>',
    );
  });

  it('adds a part to an element another part already marked', () => {
    expect(markBody('<section data-et-part="components/card" title="a > b">x</section>', 'elements/hero')).toBe(
      '<section data-et-part="components/card elements/hero" title="a > b">x</section>',
    );
  });

  it('leaves a body that starts with text or holds no element alone', () => {
    expect(markBody('Hello <b>you</b>', 'components/text')).toBe('Hello <b>you</b>');
    expect(markBody('<style>.a {}</style>', 'components/text')).toBe('<style>.a {}</style>');
  });
});

describe('markSlot', () => {
  it('marks every element, adds to an earlier slot, and skips comments and raw text', () => {
    expect(
      markSlot(
        'Hi <b title="a > b">x</b><!-- <i> --><style>a<b {}</style><i data-et-slot="x/y">y</i>',
        'elements/shell',
      ),
    ).toBe(
      'Hi <b data-et-slot="elements/shell" title="a > b">x</b><!-- <i> --><style data-et-slot="elements/shell">a<b {}</style><i data-et-slot="x/y elements/shell">y</i>',
    );
  });
});

describe('markPart', () => {
  const part = {
    note: 'n',
    states: { one: { label: 'a' } },
    widths: [320],
    render: ({ label }: { label: string }) => ({ body: `<b>${label}</b>`, styles: 's' }),
  };

  it('marks a drawing rendered at once or later, and keeps the rest of the part', async () => {
    const marked = markPart(part, 'components/label');
    const later = markPart({ ...part, render: async (props: { label: string }) => part.render(props) }, 'x/y');

    expect(marked).toMatchObject({ note: 'n', states: { one: { label: 'a' } }, widths: [320] });
    expect(marked.render({ label: 'a' })).toEqual({ body: '<b data-et-part="components/label">a</b>', styles: 's' });
    expect(await later.render({ label: 'a' })).toEqual({ body: '<b data-et-part="x/y">a</b>', styles: 's' });
  });

  it("marks the markup its props pass in as slotted, without touching the caller's props", () => {
    const props = { label: 'Plain', rows: [{ body: '<button>Go</button>' }] };
    const shell = markPart(
      {
        note: 'n',
        states: { one: props },
        render: ({ label, rows }: typeof props) => ({ body: `<div>${label}${rows[0]?.body}</div>`, styles: '' }),
      },
      'elements/shell',
    );

    expect((shell.render(props) as { body: string }).body).toBe(
      '<div data-et-part="elements/shell">Plain<button data-et-slot="elements/shell">Go</button></div>',
    );
    expect(props.rows[0]?.body).toBe('<button>Go</button>');
  });

  it('passes a default export without a render through', () => {
    const broken = { note: 'n' } as never;

    expect(markPart(broken, 'x/y')).toBe(broken);
  });
});
