import { scrollable, scrollableStyles } from '@ethlete/components/design/scrollable';
import { definePart, drawing } from '@design-system';
import frame from './scrollable.css?inline';

type Position = 'start' | 'middle' | 'end';
type Interaction = 'hover' | 'active';

const ITEM_SIZES = ['same', 'full', 'half', 'third', 'quarter'] as const;
type ItemSize = (typeof ITEM_SIZES)[number];

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
  itemSize?: ItemSize;
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
    itemSize: props.itemSize,
    itemGap: props.itemSize ? GAP : undefined,
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
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
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
    ...(Object.fromEntries(
      ITEM_SIZES.map((itemSize) => [
        `item-size-${itemSize}`,
        itemSize === 'same' ? { itemSize, items: 2 } : { itemSize },
      ]),
    ) as Record<`item-size-${ItemSize}`, Props>),
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="scrollable-frame ${props.itemSize ? 'scrollable-frame--sized' : ''}">${render(props)}</div>`,
      styles: [scrollableStyles, frame].join('\n'),
    }),
});
