/**
 * The wireframe kit: grey stand-ins a page draws before its parts exist. Each function answers
 * with markup that carries its own styles, so a page puts it into its `drawing` body as is.
 * The look is fixed and neutral, whatever the product's foundations say. Only pages may import it.
 */

type Size = number | string;

const INK = '#6b6b6b';
const LINE = '#b4b4b4';
const FILL = '#e4e4e4';
const PAPER = '#f6f6f6';

const sizeOf = (size: Size) => (typeof size === 'number' ? `${size}px` : size);

const styleOf = (rules: Record<string, Size | null | undefined>) =>
  Object.entries(rules)
    .flatMap(([property, value]) => (value === null || value === undefined ? [] : [`${property}:${value}`]))
    .join(';');

const escaped = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ellipsed = (text: string) =>
  `<span style="${styleOf({
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
    'min-width': '0',
  })}">${escaped(text)}</span>`;

export type BoxOptions = {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  width?: Size;
  height?: Size;
  grow?: boolean;
  /** Draws no border, for a box that only lays out its children. */
  plain?: boolean;
  /** For a row: below this width in px the box stacks its children in a column. */
  stackBelow?: number;
};

/** A grey-bordered area that lays out `children` in a column, or in a row. */
export const box = (children: string | string[] = [], options: BoxOptions = {}) => {
  const { direction = 'column', gap = 12, padding = 16, width, height, grow, plain, stackBelow } = options;
  const stacks = direction === 'row' && stackBelow !== undefined;
  const frame = {
    width: width === undefined ? null : sizeOf(width),
    height: height === undefined ? null : sizeOf(height),
    flex: grow ? '1 1 0' : null,
    'min-width': '0',
    padding: sizeOf(padding),
    'box-sizing': 'border-box',
    border: plain ? null : `1px solid ${LINE}`,
    'border-radius': plain ? null : '6px',
    background: plain ? null : PAPER,
    color: INK,
  };
  const content = [children].flat().join('');

  if (!stacks)
    return `<div data-wireframe="box" style="${styleOf({
      ...frame,
      display: 'flex',
      'flex-direction': direction,
      gap: sizeOf(gap),
    })}">${content}</div>`;

  // `container-type: inline-size` drops the box's intrinsic width, so a frame sized to its content
  // would shrink it to its padding; `contain-intrinsic-inline-size` gives it `stackBelow` instead.
  const container = styleOf({
    ...frame,
    display: 'flex',
    'flex-direction': 'column',
    'container-type': 'inline-size',
    'contain-intrinsic-inline-size': sizeOf(stackBelow),
  });
  const stackRule = `@container (width < ${stackBelow}px){[data-wireframe-stack-below="${stackBelow}"]{flex-direction:column!important}[data-wireframe-stack-below="${stackBelow}"]>*{flex:0 0 auto!important}}`;
  const row = styleOf({
    display: 'flex',
    'flex-direction': 'row',
    gap: sizeOf(gap),
    flex: '1 1 auto',
    'min-width': '0',
  });

  return `<div data-wireframe="box" style="${container}"><style>${stackRule}</style><div data-wireframe-stack-below="${stackBelow}" style="${row}">${content}</div></div>`;
};

/** A title in the kit's grey. */
export const heading = (text: string, options: { size?: number } = {}) => {
  const { size = 24 } = options;

  return `<h2 data-wireframe="heading" style="${styleOf({
    margin: '0',
    font: `600 ${sizeOf(size)}/1.25 sans-serif`,
    color: INK,
    'overflow-wrap': 'anywhere',
  })}">${escaped(text)}</h2>`;
};

/** Grey bars that stand for running text; the last line is shorter. */
export const textLines = (options: { lines?: number; width?: Size; size?: number } = {}) => {
  const { lines = 3, width = '100%', size = 10 } = options;
  const bar = (index: number) =>
    `<div style="${styleOf({
      height: sizeOf(size),
      width: index === lines - 1 && lines > 1 ? '60%' : '100%',
      background: FILL,
      'border-radius': sizeOf(size / 2),
    })}"></div>`;

  return `<div data-wireframe="text-lines" style="${styleOf({
    display: 'flex',
    'flex-direction': 'column',
    gap: sizeOf(Math.round(size * 0.8)),
    width: sizeOf(width),
  })}">${Array.from({ length: lines }, (_, index) => bar(index)).join('')}</div>`;
};

/**
 * A grey rectangle crossed corner to corner, standing for a picture. With `ratio` (`'2/3'`) its
 * height follows its width, which fills the space unless `width` caps it.
 */
export const image = (options: { width?: Size; height?: Size; ratio?: string } = {}) => {
  const { width = '100%', ratio, height = ratio === undefined ? 160 : undefined } = options;
  const cross = `linear-gradient(to top right, transparent calc(50% - 1px), ${LINE} 50%, transparent calc(50% + 1px)), linear-gradient(to bottom right, transparent calc(50% - 1px), ${LINE} 50%, transparent calc(50% + 1px))`;

  return `<div data-wireframe="image" style="${styleOf({
    width: sizeOf(width),
    'max-width': '100%',
    height: height === undefined ? null : sizeOf(height),
    'aspect-ratio': ratio,
    'flex-shrink': '0',
    'box-sizing': 'border-box',
    border: `1px solid ${LINE}`,
    background: `${cross}, ${FILL}`,
  })}"></div>`;
};

/** A button with a label; `primary` fills it dark. It is at most as wide as its space and cuts its label with "…". */
export const button = (label: string, options: { primary?: boolean } = {}) =>
  `<div data-wireframe="button" style="${styleOf({
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'align-self': 'flex-start',
    height: '36px',
    'max-width': '100%',
    'min-width': '0',
    padding: '0 16px',
    'box-sizing': 'border-box',
    border: `1px solid ${INK}`,
    'border-radius': '6px',
    background: options.primary ? INK : PAPER,
    color: options.primary ? PAPER : INK,
    font: '500 14px/1 sans-serif',
  })}">${ellipsed(label)}</div>`;

/** A text field with an optional label above it and a placeholder inside. */
export const input = (options: { label?: string; placeholder?: string; width?: Size } = {}) => {
  const { label, placeholder = '', width = '100%' } = options;
  const caption = label
    ? `<div style="${styleOf({ font: '500 12px/1.2 sans-serif', color: INK })}">${escaped(label)}</div>`
    : '';

  return `<div data-wireframe="input" style="${styleOf({
    display: 'flex',
    'flex-direction': 'column',
    gap: '6px',
    width: sizeOf(width),
    'max-width': '100%',
    'min-width': '0',
  })}">${caption}<div style="${styleOf({
    height: '36px',
    padding: '0 12px',
    display: 'flex',
    'align-items': 'center',
    'box-sizing': 'border-box',
    border: `1px solid ${LINE}`,
    'border-radius': '6px',
    background: '#ffffff',
    color: LINE,
    font: '14px/1 sans-serif',
  })}">${ellipsed(placeholder)}</div></div>`;
};

/** A grey circle that holds the place of an icon. */
export const icon = (options: { size?: number } = {}) => {
  const { size = 24 } = options;

  return `<div data-wireframe="icon" style="${styleOf({
    width: sizeOf(size),
    height: sizeOf(size),
    'flex-shrink': '0',
    'border-radius': '50%',
    background: FILL,
    border: `1px solid ${LINE}`,
    'box-sizing': 'border-box',
  })}"></div>`;
};
