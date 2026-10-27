import { definePart, drawing } from '@design-system';
import { box, dot, heading, icon, image } from '@design-system/kit';
import shellMain from '@system/elements/shell-main';

const label = (text: string, size = 13) => heading(text, { size });
const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });
const stack = (children: string[], gap = 8) => box(children, { plain: true, padding: 0, gap });
const gutter = (width: number) => box([], { plain: true, padding: 0, width });
const inset = (content: string, left: number, right = left) =>
  box([gutter(left), box([content], { plain: true, padding: 0, gap: 0, grow: true }), gutter(right)], {
    direction: 'row',
    plain: true,
    padding: 0,
    gap: 0,
  });
const nudge = (content: string, top: number) =>
  box([box([], { plain: true, padding: 0, height: top }), content], { plain: true, padding: 0, gap: 0 });
const text = (value: string, size = 13) => nudge(label(value, size), 1);
const disclosure = (open: boolean) => icon({ size: 16, glyph: open ? 'chevron-down' : 'chevron-right' });
const indent = (depth: number, children: string[]) =>
  box([inset(row(children), 4 + depth * 18, 4)], { plain: true, padding: 4, gap: 0 });
const spacer = () => box([], { plain: true, padding: 0, grow: true });
const warning = () => icon({ size: 16, glyph: '!' });

const STATES = [
  { name: 'primary', inert: false },
  { name: 'secondary', inert: false },
  { name: 'disabled', inert: true },
];

type Part = { name: string; open?: boolean; warns?: boolean };
type Layer = { title: string; open: boolean; parts: Part[] };

const LAYERS: Layer[] = [
  { title: 'Foundations', open: false, parts: [] },
  { title: 'Elements', open: false, parts: [] },
  {
    title: 'Components',
    open: true,
    parts: [{ name: 'button', open: true }, { name: 'form-field' }, { name: 'select', warns: true }],
  },
  { title: 'Pages', open: false, parts: [] },
];

const stateRow = (name: string, inert: boolean, selected: boolean) => {
  const line = row([dot({ hollow: inert, size: 5 }), text(name, 12)], 8);

  return selected
    ? box([inset(line, 48, 5)], { padding: 3, gap: 0 })
    : box([inset(line, 48, 5)], { plain: true, padding: 4, gap: 0 });
};

const partRows = (part: Part) => [
  indent(1, [disclosure(part.open === true), text(part.name), ...(part.warns ? [spacer(), warning()] : [])]),
  ...(part.open ? STATES.map((state, index) => stateRow(state.name, state.inert, index === 0)) : []),
];

const layerRows = (layer: Layer) => [
  indent(0, [disclosure(layer.open), text(layer.title)]),
  ...layer.parts.flatMap(partRows),
];

const tree = () => stack(LAYERS.flatMap(layerRows), 2);

const frames = () =>
  box(
    ['primary', 'secondary', 'disabled'].map((state) => box([label(state), image({ ratio: '4/3' })], { grow: true })),
    { direction: 'row', plain: true, padding: 0, gap: 16, stackBelow: 520 },
  );

export default definePart({
  note: 'f',
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
