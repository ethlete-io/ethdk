import { definePart, iconSheet, svgAsset } from '@design-system';
import chevronRight from '@assets/icons/chevron-right.svg?raw';
import chevronDown from '@assets/icons/chevron-down.svg?raw';
import arrowLeft from '@assets/icons/arrow-left.svg?raw';
import check from '@assets/icons/check.svg?raw';
import error from '@assets/icons/error.svg?raw';
import warning from '@assets/icons/warning.svg?raw';
import comment from '@assets/icons/comment.svg?raw';
import pencil from '@assets/icons/pencil.svg?raw';
import reply from '@assets/icons/reply.svg?raw';
import grid from '@assets/icons/grid.svg?raw';
import flow from '@assets/icons/flow.svg?raw';
import inbox from '@assets/icons/inbox.svg?raw';
import more from '@assets/icons/more.svg?raw';
import upDown from '@assets/icons/up-down.svg?raw';
import panel from '@assets/icons/panel.svg?raw';

export type IconName =
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'check'
  | 'error'
  | 'warning'
  | 'comment'
  | 'pencil'
  | 'reply'
  | 'grid'
  | 'flow'
  | 'inbox'
  | 'more'
  | 'up-down'
  | 'panel';

const icons: Record<IconName, string> = {
  'chevron-right': chevronRight,
  'chevron-down': chevronDown,
  'arrow-left': arrowLeft,
  check,
  error,
  warning,
  comment,
  pencil,
  reply,
  grid,
  flow,
  inbox,
  more,
  'up-down': upDown,
  panel,
};

export const iconNames = Object.keys(icons) as IconName[];

/** An icon of the 16 px set as inline SVG in `currentColor`, 16 px by default; `cls` lets a host size or place it in its own CSS. */
export const icon = (name: IconName, { size = 16, cls = '' }: { size?: number; cls?: string } = {}) =>
  svgAsset(icons[name], { size, class: cls, attrs: { 'aria-hidden': 'true' } });

const sheetIcons = iconNames.map((name) => ({ name, svg: icons[name] }));

const titles = {
  catalogue: 'Icons: a 16 px grid with a 1.5 stroke, at each size the parts draw',
  construction: 'Icons on the 16 px grid: pixel lines, centre lines, and the 2 px padding',
};

type View = 'catalogue' | 'construction';

export default definePart<{ view: View }>({
  note: 'The icon set as one SVG asset per icon with one icon() export',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: { catalogue: { view: 'catalogue' }, construction: { view: 'construction' } },
  render: ({ view }) => iconSheet({ view, title: titles[view], icons: sheetIcons, sizes: [12, 14, 16, 20] }),
});
