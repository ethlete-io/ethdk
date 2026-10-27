import { definePart, drawing } from '@design-system';
import { box, dot, heading, image } from '@design-system/kit';
import shellMain from '@system/elements/shell-main';

const label = (text: string) => heading(text, { size: 13 });
const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });
const stack = (children: string[], gap = 8) => box(children, { plain: true, padding: 0, gap });
const item = (text: string) => row([dot(), label(text)]);

const tree = () =>
  stack(
    [
      label('Foundations'),
      item('tokens'),
      item('logo'),
      label('Components'),
      item('button'),
      item('form-field'),
      item('select'),
      label('Pages'),
      item('system'),
    ],
    6,
  );

const frames = () =>
  box(
    ['primary', 'secondary', 'disabled'].map((state) => box([label(state), image({ ratio: '4/3' })], { grow: true })),
    { direction: 'row', plain: true, padding: 0, gap: 16, stackBelow: 520 },
  );

export default definePart({
  note: 'b',
  madeBy: ['claude-opus-5-5'],
  states: { part: {} },
  render: async () => {
    const shell = await shellMain.render({
      section: 'System',
      product: 'studio',
      side: tree(),
      content: frames(),
    });

    return drawing({ body: shell.body, styles: shell.styles });
  },
});
