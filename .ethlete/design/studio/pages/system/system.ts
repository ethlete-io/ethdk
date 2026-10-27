import { definePart, drawing } from '@design-system';
import { box, button, heading, icon, image, input, textLines } from '@design-system/kit';
import shellMain from '@system/elements/shell-main';

type View = 'part' | 'comment open' | 'no product' | 'new product open' | 'empty product';

type Props = { view: View };

const label = (text: string) => heading(text, { size: 13 });
const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });
const stack = (children: string[], gap = 8) => box(children, { plain: true, padding: 0, gap });
const item = (text: string) => row([icon({ size: 16 }), label(text)]);

const hasParts = (view: View) => view === 'part' || view === 'comment open';

const tree = (view: View) => {
  if (view === 'no product' || view === 'new product open') return stack([textLines({ lines: 2, width: 160 })]);
  if (view === 'empty product') return stack(['Foundations', 'Components', 'Elements', 'Pages'].map(label), 12);

  return stack(
    [
      label('Foundations'),
      item('tokens'),
      item('logo'),
      label('Components'),
      item('button · overridden'),
      item('form-field · from base'),
      item('select · from base'),
      label('Pages'),
      item('Wireframes 4 · kit 38'),
      label('Sketches'),
      item('pages/system · ready'),
    ],
    6,
  );
};

const frames = (view: View) =>
  box(
    ['primary', 'secondary', 'disabled'].map((state, index) =>
      box(
        [
          row([label(state), view === 'comment open' && index === 0 ? icon({ size: 20 }) : '']),
          image({ ratio: '4/3' }),
        ],
        { grow: true },
      ),
    ),
    { direction: 'row', plain: true, padding: 0, gap: 16, stackBelow: 520 },
  );

const canvas = (view: View) => {
  if (view === 'no product' || view === 'new product open')
    return stack(
      [
        heading('No product yet', { size: 20 }),
        textLines({ lines: 2, width: 280 }),
        button('New product', { primary: true }),
      ],
      16,
    );
  if (view === 'empty product')
    return stack([heading('This product has no parts yet.', { size: 18 }), textLines({ lines: 2, width: 320 })], 12);

  return stack(
    [
      row([
        button('Phone'),
        button('Desktop', { primary: true }),
        button('Theme: dark'),
        button('Hover'),
        button('Comment'),
      ]),
      frames(view),
    ],
    16,
  );
};

const thread = () =>
  stack(
    [
      heading('Comment on button · primary', { size: 16 }),
      box([label('Tom'), textLines({ lines: 2 })]),
      box([label('claude-opus-5-5'), textLines({ lines: 2 })]),
      input({ label: 'Reply', placeholder: 'Write a reply' }),
      row([button('Resolve'), button('Send', { primary: true })]),
    ],
    12,
  );

const dialog = () =>
  box(
    [
      heading('New product', { size: 18 }),
      input({ label: 'Name', placeholder: 'studio' }),
      input({ label: 'Base', placeholder: '@ethlete/components' }),
      input({ label: 'Folder', placeholder: '.ethlete/design/studio' }),
      row([button('Cancel'), button('Create', { primary: true })]),
    ],
    { width: 360, gap: 16, padding: 20 },
  );

const noProduct = (view: View) => view === 'no product' || view === 'new product open';

const partHeader = () =>
  box(
    [
      row([heading('button', { size: 18 }), label('Overridden from base'), label('3 states'), label('Comments 1')], 16),
      textLines({ lines: 2, width: '70%' }),
    ],
    { gap: 10 },
  );

export default definePart<Props>({
  note: 'b',
  madeBy: ['claude-opus-5-5'],
  states: {
    part: { view: 'part' },
    'comment open': { view: 'comment open' },
    'no product': { view: 'no product' },
    'new product open': { view: 'new product open' },
    'empty product': { view: 'empty product' },
  },
  render: async ({ view }) => {
    const shell = await shellMain.render({
      section: 'System',
      product: noProduct(view) ? null : 'studio',
      side: tree(view),
      content: (hasParts(view) ? partHeader() : '') + canvas(view),
      ...(view === 'comment open' ? { panel: thread() } : {}),
      ...(view === 'new product open' ? { overlay: dialog() } : {}),
    });

    return drawing({ body: shell.body, styles: shell.styles });
  },
});
