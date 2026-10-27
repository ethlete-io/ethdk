/**
 * The wireframe kit: grey stand-ins a page draws before its parts exist. Each function answers
 * with markup that carries its own inline style, so a page puts it into its `drawing` body as is.
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

export type BoxOptions = {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  width?: Size;
  height?: Size;
  grow?: boolean;
  /** Draws no border, for a box that only lays out its children. */
  plain?: boolean;
};

/** A grey-bordered area that lays out `children` in a column, or in a row. */
export const box = (children: string | string[] = [], options: BoxOptions = {}) => {
  const { direction = 'column', gap = 12, padding = 16, width, height, grow, plain } = options;
  const style = styleOf({
    display: 'flex',
    'flex-direction': direction,
    gap: sizeOf(gap),
    padding: sizeOf(padding),
    width: width === undefined ? null : sizeOf(width),
    height: height === undefined ? null : sizeOf(height),
    flex: grow ? '1 1 0' : null,
    'min-width': '0',
    'box-sizing': 'border-box',
    border: plain ? null : `1px solid ${LINE}`,
    'border-radius': plain ? null : '6px',
    background: plain ? null : PAPER,
  });

  return `<div data-wireframe="box" style="${style}">${[children].flat().join('')}</div>`;
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

/** A grey rectangle crossed corner to corner, standing for a picture. */
export const image = (options: { width?: Size; height?: Size } = {}) => {
  const { width = '100%', height = 160 } = options;
  const cross = `linear-gradient(to top right, transparent calc(50% - 1px), ${LINE} 50%, transparent calc(50% + 1px)), linear-gradient(to bottom right, transparent calc(50% - 1px), ${LINE} 50%, transparent calc(50% + 1px))`;

  return `<div data-wireframe="image" style="${styleOf({
    width: sizeOf(width),
    height: sizeOf(height),
    'flex-shrink': '0',
    'box-sizing': 'border-box',
    border: `1px solid ${LINE}`,
    background: `${cross}, ${FILL}`,
  })}"></div>`;
};

/** A button with a label; `primary` fills it dark. */
export const button = (label: string, options: { primary?: boolean } = {}) =>
  `<div data-wireframe="button" style="${styleOf({
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'align-self': 'flex-start',
    height: '36px',
    padding: '0 16px',
    'box-sizing': 'border-box',
    border: `1px solid ${INK}`,
    'border-radius': '6px',
    background: options.primary ? INK : PAPER,
    color: options.primary ? PAPER : INK,
    font: '500 14px/1 sans-serif',
    'white-space': 'nowrap',
  })}">${escaped(label)}</div>`;

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
  })}">${escaped(placeholder)}</div></div>`;
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
