// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  badge,
  box,
  button,
  checkbox,
  dot,
  heading,
  image,
  input,
  segmented,
  select,
  tabs,
} from '../../../design/wireframe-kit';

const render = (markup: string) => {
  const host = document.createElement('div');

  host.innerHTML = markup;

  return host;
};

const styleOf = (element: Element | null | undefined) => element?.getAttribute('style') ?? '';

describe('wireframe kit', () => {
  it('stacks a row below `stackBelow` through a container query on the box itself', () => {
    const host = render(box(['<i></i>', '<b></b>'], { direction: 'row', stackBelow: 600 }));
    const container = host.querySelector('[data-wireframe="box"]');
    const row = container?.querySelector(':scope > [data-wireframe-stack-below="600"]');

    expect(styleOf(container)).toContain('container-type:inline-size');
    expect(styleOf(container)).toContain('contain-intrinsic-inline-size:600px');
    expect(styleOf(row)).toContain('flex-direction:row');
    expect(row?.children).toHaveLength(2);
    expect(container?.querySelector(':scope > style')?.textContent).toContain(
      '@container (width < 600px){[data-wireframe-stack-below="600"]{flex-direction:column!important}',
    );
  });

  it('renders no container for a row without `stackBelow`', () => {
    const markup = box(['<i></i>'], { direction: 'row' });

    expect(markup).not.toContain('container-type');
    expect(markup).not.toContain('<style>');
  });

  it('gives every box the kit text colour', () => {
    expect(styleOf(render(box([], { plain: true })).firstElementChild)).toContain('color:#6b6b6b');
    expect(styleOf(render(box([], { direction: 'row', stackBelow: 400 })).firstElementChild)).toContain(
      'color:#6b6b6b',
    );
  });

  it('draws a heading in the kit grey and escapes its text', () => {
    const element = render(heading('Dune <2021>')).querySelector('[data-wireframe="heading"]');

    expect(element?.textContent).toBe('Dune <2021>');
    expect(styleOf(element)).toContain('color:#6b6b6b');
  });

  it('sizes an image with `ratio` by its width', () => {
    const markup = image({ ratio: '2/3' });

    expect(markup).toContain('aspect-ratio:2/3');
    expect(markup).toContain('width:100%');
    expect(markup).toContain('max-width:100%');
    expect(markup).not.toContain('height:');
    expect(image()).toContain('height:160px');
  });

  it('keeps a button within its space and cuts the label with an ellipsis', () => {
    const element = render(button('Add to watchlist')).firstElementChild;
    const label = element?.querySelector('span');

    expect(styleOf(element)).toContain('max-width:100%');
    expect(styleOf(element)).toContain('min-width:0');
    expect(styleOf(label)).toContain('text-overflow:ellipsis');
    expect(styleOf(label)).toContain('overflow:hidden');
    expect(label?.textContent).toBe('Add to watchlist');
  });

  it('cuts an input placeholder with an ellipsis instead of wrapping it', () => {
    const placeholder = render(input({ placeholder: 'What did you think?' })).querySelector('span');

    expect(styleOf(placeholder)).toContain('white-space:nowrap');
    expect(styleOf(placeholder)).toContain('text-overflow:ellipsis');
  });

  it('draws a select with its value in ink and a chevron, unlike an input placeholder', () => {
    const element = render(select({ label: 'Product', value: 'studio' })).querySelector('[data-wireframe="select"]');
    const field = element?.lastElementChild;

    expect(element?.textContent).toBe('Productstudio');
    expect(styleOf(field)).toContain('color:#6b6b6b');
    expect(styleOf(field?.lastElementChild)).toContain('transform:rotate(45deg)');
  });

  it('marks only the active tab and draws tabs over a line', () => {
    const element = render(tabs(['System', 'Inbox'], { active: 'Inbox' })).querySelector('[data-wireframe="tabs"]');
    const active = element?.querySelectorAll('[data-active]');

    expect(styleOf(element)).toContain('border-bottom:1px solid #b4b4b4');
    expect(active).toHaveLength(1);
    expect(active?.[0]?.textContent).toBe('Inbox');
    expect(styleOf(active?.[0])).toContain('border-bottom:2px solid #6b6b6b');
  });

  it('joins segmented options in one strip and fills the active one', () => {
    const element = render(segmented(['Phone', 'Desktop'], { active: 'Desktop' })).querySelector(
      '[data-wireframe="segmented"]',
    );
    const [first, second] = Array.from(element?.children ?? []);

    expect(styleOf(element)).toContain('overflow:hidden');
    expect(styleOf(first)).not.toContain('border-left');
    expect(styleOf(second)).toContain('border-left:1px solid #b4b4b4');
    expect(styleOf(second)).toContain('background:#6b6b6b');
    expect(styleOf(first)).toContain('background:#f6f6f6');
  });

  it('draws a tick only in a checked checkbox', () => {
    const box = (checked: boolean) => render(checkbox('Hide resolved', { checked })).querySelector('span');

    expect(box(true)?.children).toHaveLength(1);
    expect(styleOf(box(true))).toContain('background:#6b6b6b');
    expect(box(false)?.children).toHaveLength(0);
  });

  it('draws a badge as a dark pill with its text', () => {
    const element = render(badge(3)).querySelector('[data-wireframe="badge"]');

    expect(element?.textContent).toBe('3');
    expect(styleOf(element)).toContain('border-radius:9px');
  });

  it('draws a dot filled or hollow', () => {
    expect(styleOf(render(dot()).firstElementChild)).toContain('background:#6b6b6b');
    expect(styleOf(render(dot({ hollow: true })).firstElementChild)).toContain('background:transparent');
  });

  it('makes a `fill` box at least as tall as the frame', () => {
    expect(styleOf(render(box([], { fill: true })).firstElementChild)).toContain('min-height:100vh');
    expect(styleOf(render(box([], { direction: 'row', stackBelow: 400, fill: true })).firstElementChild)).toContain(
      'min-height:100vh',
    );
    expect(box()).not.toContain('min-height');
  });
});
