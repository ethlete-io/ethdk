import { definePart, drawing, html } from '@design-system';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './part-tree.css?inline';

type TreeState = { name: string; inert?: boolean; selected?: boolean };
type TreePart = { name: string; warns?: boolean; leaf?: boolean; selected?: boolean; states?: TreeState[] };
type TreeLayer = { title: string; open: boolean; parts: TreePart[] };

type Props = { layers: TreeLayer[] };

const small = (paths: string, cls: string) =>
  `<svg class="${cls}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const chevron = (open: boolean) =>
  small(open ? '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>' : '<path d="m6.5 4.5 3.5 3.5-3.5 3.5"/>', 'st-tree-chevron');

const warning = small('<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3"/><path d="M8 11.5v.01"/>', 'st-tree-warn');

const row = (depth: number, lead: string, label: string, extra = '', selected = false) =>
  `<div class="st-tree-row" data-depth="${depth}"${selected ? ' data-selected' : ''}><span class="st-tree-lead">${lead}</span><span class="st-tree-label">${label}</span>${extra}</div>`;

const dot = (inert: boolean) => `<span class="st-tree-dot"${inert ? ' data-inert' : ''}></span>`;

const partRows = (part: TreePart) => [
  row(
    1,
    part.leaf === true ? dot(false) : chevron(part.states !== undefined),
    part.name,
    part.warns ? warning : '',
    part.selected === true,
  ),
  ...(part.states ?? []).map((state) => row(2, dot(state.inert === true), state.name, '', state.selected === true)),
];

const layerRows = (layer: TreeLayer) => [row(0, chevron(layer.open), layer.title), ...layer.parts.flatMap(partRows)];

const componentsOpen: Props = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    { title: 'Elements', open: false, parts: [] },
    {
      title: 'Components',
      open: true,
      parts: [{ name: 'button', leaf: true, selected: true }, { name: 'form-field' }, { name: 'select', warns: true }],
    },
    { title: 'Pages', open: false, parts: [] },
  ],
};

export default definePart({
  note: 'A dense, quiet tree of the product parts: layers, then parts, then the frames of an open part (a part drawn in one frame is a leaf), with a warning mark on a part that needs a look and no counts anywhere.',
  madeBy: ['claude-opus-5-5'],
  widths: [232],
  states: { 'components-open': componentsOpen },
  render: ({ layers }: Props) =>
    drawing({
      body: html`<div class="st-tree">${layers.flatMap(layerRows).join('')}</div>`,
      styles: tokens + styles,
    }),
});
