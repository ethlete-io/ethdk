import { scrollable, scrollableStyles } from '@ethlete/components/design/scrollable';
import { definePart, drawing } from '@design-system';
import frame from './scrollable.css?inline';

type Position = 'start' | 'middle' | 'end';
type Interaction = 'hover' | 'active';

type Props = {
  direction?: 'horizontal' | 'vertical';
  position?: Position;
  items?: number;
  maskVariant?: 'gradient' | 'border';
  buttons?: 'inside' | 'footer' | 'none';
  navigation?: boolean;
  darken?: boolean;
  color?: string;
  endButton?: Interaction;
  focusItem?: number;
};

const ITEM = { horizontal: 200, vertical: 80 };
const VIEWPORT = { horizontal: 432, vertical: 258 };
const GAP = 12;

const extent = (count: number, size: number) => count * size + (count - 1) * GAP;

const offsetOf = (props: Required<Pick<Props, 'direction' | 'position' | 'items'>>) => {
  const size = ITEM[props.direction];
  const max = Math.max(0, extent(props.items, size) - VIEWPORT[props.direction]);

  if (props.position === 'start') return 0;
  if (props.position === 'end') return max;

  return Math.min(max, 3 * (size + GAP) - Math.round((VIEWPORT[props.direction] - size) / 2));
};

const visibleRange = (offset: number, size: number, viewport: number, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const start = index * (size + GAP) - offset;
    const end = start + size;
    const ratio = Math.max(0, Math.min(end, viewport) - Math.max(start, 0)) / size;

    return ratio;
  });

const render = (props: Props) => {
  const direction = props.direction ?? 'horizontal';
  const items = props.items ?? 8;
  const position = props.position ?? 'start';
  const size = ITEM[direction];
  const canScroll = extent(items, size) > VIEWPORT[direction];
  const offset = offsetOf({ direction, position, items });
  const ratios = visibleRange(offset, size, VIEWPORT[direction], items);
  const best = ratios.reduce((found, ratio, index) => (ratio > (ratios[found] ?? 0) ? index : found), 0);
  const active = position === 'end' ? items - 1 : position === 'start' ? 0 : best;
  const buttons = props.buttons ?? 'inside';

  const markup = scrollable({
    direction,
    canScroll,
    position,
    maskVariant: props.maskVariant,
    buttons: buttons === 'none' ? undefined : buttons,
    navigationActive: props.navigation ? active : undefined,
    darken: props.darken,
    color: props.color,
    endButtonAttributes: props.endButton ? `data-et-force="${props.endButton}"` : undefined,
    containerAttributes: `data-et-skip="CLIPPED" style="--scrollable-offset: -${offset}px"`,
    items: Array.from({ length: items }, (_, index) => ({
      tag: 'button',
      content: `Item ${index}`,
      notIntersecting: props.darken && (ratios[index] ?? 0) < 1,
      attributes: [
        'class="scrollable-item"',
        'type="button"',
        props.focusItem === index && 'data-et-force="focus-visible"',
      ]
        .filter(Boolean)
        .join(' '),
    })),
  });

  return markup.replace(
    'class="et-scrollable-progress-bar"',
    'data-et-skip="CLIPPED" class="et-scrollable-progress-bar"',
  );
};

export default definePart({
  note: "The SDK scrollable (et-scrollable), first drawing, drawn by its mock from @ethlete/components/design with its real markup and CSS: the scroll container with its observer elements, the edge masks (et-scrollable-masks), the etScrollableButtons buttons and the etScrollableNavigation dots. Framed as its story does (24px padding, surface fill, a 128px track with a 12px gap, 200x80 items with 12px corners; vertical 400px wide and 258px tall), with neutral items (14% surface ink) in place of the story's fixed hex colours. Native scrollbars are hidden (renderScrollbars off by default); scrolled positions are drawn by translating the content statically, so the containers carry data-et-skip=CLIPPED, and the 5-dot window of the progress bar clips its dots on purpose (data-et-skip=CLIPPED). What the lib draws: 25px gradient masks from the page colour at an edge that has more content (border variant: 32px plus a 1px surface-border line); inside buttons as transparent xs et-icon-buttons with a chevron in surface-interaction, shown only off the edge they point to; footer buttons left and right of the dots; dots 20px, the active one in the theme primary at full size, the others in surface-interaction, scaled and faded by distance; darken dims every item not fully in view to 75%. The buttons and dots are tabindex=-1 and aria-hidden, so no lib focus ring ever shows; the items are the consumer's own, drawn with the browser's default ring as in the story. States: horizontal-start / -middle / -end, vertical-start / -middle / -end, button-hover, button-active, border-mask, vertical-border-mask, navigation-start / -middle / -end, vertical-navigation, footer-buttons, footer-button-hover, danger-navigation (color danger), darken, item-focus-visible, short-content (2 items, no overflow: no masks, no buttons), short-content-navigation (no footer while it cannot scroll). Numbers (light / dark), from shot pixels: active dot vs page brand 1.33 / 13.50, danger 4.83 / 3.71; dot one away 2.30 / 3.31, two away 1.82 / 2.40; footer chevron vs page 4.74 / 6.94; inside chevron vs the mask behind it 5.12 / 7.77; button hover tint vs page 1.04 / 1.17, chevron on it 4.58 / 5.91; border-mask line vs page 1.26 / 1.73 (Q98, numbers only); item vs page 1.35 / 1.48. Decided rules that arise: Q99a only (the active dot is an accent mark, mint at 1.33:1 on light). No ink edge arises (the dot turns ink, no mint fill remains on light), so no Q102 and no c. No lib focus ring (Q88) and no filled button (Q101). Story artifact, not a lib bug: in vertical the story's padding-block 4px / margin-block -4px lets the items show 4px past the masks. Open for Tom, not a decided rule: the far dots (1.82 light) and the hover tint (1.04 light) are faint.",
  madeBy: ['claude-opus-5-5'],
  states: {
    'horizontal-start': {},
    'horizontal-middle': { position: 'middle' },
    'horizontal-end': { position: 'end' },
    'vertical-start': { direction: 'vertical' },
    'vertical-middle': { direction: 'vertical', position: 'middle' },
    'vertical-end': { direction: 'vertical', position: 'end' },
    'button-hover': { position: 'middle', endButton: 'hover' },
    'button-active': { position: 'middle', endButton: 'active' },
    'border-mask': { position: 'middle', maskVariant: 'border' },
    'vertical-border-mask': { direction: 'vertical', position: 'middle', maskVariant: 'border' },
    'navigation-start': { navigation: true },
    'navigation-middle': { position: 'middle', navigation: true },
    'navigation-end': { position: 'end', navigation: true },
    'vertical-navigation': { direction: 'vertical', position: 'middle', navigation: true },
    'footer-buttons': { position: 'middle', buttons: 'footer', navigation: true },
    'footer-button-hover': { position: 'middle', buttons: 'footer', navigation: true, endButton: 'hover' },
    'danger-navigation': { position: 'middle', navigation: true, color: 'danger' },
    darken: { position: 'middle', darken: true },
    'item-focus-visible': { focusItem: 1 },
    'short-content': { items: 2 },
    'short-content-navigation': { items: 2, navigation: true },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="scrollable-frame">${render(props)}</div>`,
      styles: [scrollableStyles, frame].join('\n'),
    }),
});
