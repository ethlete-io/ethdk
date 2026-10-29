import { drawing, html } from '@design-system';
import button from '@system/components/button';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import styles from './below.css?inline';

type TreeProps = Parameters<typeof partTree.render>[0];

type BelowVariant<K extends string> = { key: K; label: string; drawing?: boolean };

export type BelowData<K extends string, V extends BelowVariant<K>> = {
  VARIANTS: V[];
  NOTES: Record<K, string>;
  changedStates: (componentsOpen: TreeProps) => { name: string; props: TreeProps }[];
  typed: (variant: K, body: string) => string;
  contextCrop: (variant: K, page: string) => string;
  authorMark: (variant: V) => string;
  drawingLabel: (variant: V) => string;
};

export const BELOW_ZOOM = 1.5;
const CONTENT_LEFT = 280;
const FIRST_COLUMN_AT = 310;
const HEAD_MIN_WIDTH = 180;
const LABEL_MIN_WIDTH = 120;
const EDGE_INSET = 3;

const side = {
  layers: [
    { title: 'Components', open: true, parts: [{ name: 'button', leaf: true }] },
    { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true, selected: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'inbox', leaf: true, warns: true }] },
  ],
};

const pending = (label: string) =>
  `<figure class="sk-frame sk-pending" data-col aria-label="Variante ${label} wird gezeichnet"><span>Wird gezeichnet</span></figure>`;

export const belowRows = async <K extends string, V extends BelowVariant<K>>(data: BelowData<K, V>) => {
  const merge = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
  const tree = await partTree.render(partTree.states['components-open']);
  const frames = await canvasFrames.render(canvasFrames.states.default);
  const page = await shellMain.render({ section: 'System', product: 'studio', side: tree.body, content: frames.body });
  const states = await Promise.all(
    data.changedStates(partTree.states['components-open']).map(async (state) => ({
      name: state.name,
      drawn: await partTree.render(state.props),
    })),
  );

  const heads = data.VARIANTS.map((variant, index) => {
    const current = variant.key === 'current';
    const pick = current
      ? '<span class="sk-current-tag">Gemergt</span>'
      : variant.drawing
        ? data.drawingLabel(variant)
        : merge.body;
    return html`<div class="zc-attached zb-head" data-head="${index}" hidden>
      <div class="zc-inline">
        <span class="zc-name" ${current ? ' data-current' : ''}
          >${current ? variant.label : 'Variante ' + variant.label}</span
        >${data.authorMark(variant)}${pick}
      </div>
      <span class="zc-note">${data.NOTES[variant.key]}</span>
    </div>`;
  }).join('');

  const stateRows = states
    .map(({ name, drawn }) =>
      data.VARIANTS.map((variant) =>
        variant.drawing
          ? pending(variant.label)
          : html`<figure class="sk-frame sk-a-frame" data-col>
              <figcaption class="sk-frame-caption">${name}</figcaption>
              ${data.typed(variant.key, drawn.body)}
            </figure>`,
      ).join(''),
    )
    .join('');

  const contextFrames = data.VARIANTS.map((variant) =>
    variant.drawing
      ? pending(variant.label)
      : data
          .contextCrop(variant.key, page.body)
          .replace('<figure class="sk-frame sk-context-frame">', '<figure class="sk-frame sk-context-frame" data-col>')
          .replace(
            '<figcaption class="sk-frame-caption">',
            `<figcaption class="sk-frame-caption" data-anchor="ctx-${variant.key}">`,
          ),
  ).join('');

  return {
    heads,
    stateRows,
    contextFrames,
    styles: tree.styles + frames.styles + page.styles + (states[0]?.drawn.styles ?? '') + merge.styles,
  };
};

type Box = { x: number; y: number; w: number; h: number };

export const placeBelow = (root: HTMLElement) => {
  const viewport = root.querySelector<HTMLElement>('.zb-viewport');
  const world = root.querySelector<HTMLElement>('.zb-world');
  const camera = world?.querySelector<HTMLElement>('[data-camera]');
  if (!viewport || !world || !camera) return;

  const box = (el: HTMLElement): Box => {
    let x = 0;
    let y = 0;
    for (let node: HTMLElement | null = el; node && node !== world; node = node.offsetParent as HTMLElement | null) {
      x += node.offsetLeft;
      y += node.offsetTop;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  const cells = [...world.querySelectorAll<HTMLElement>('[data-col]')].map(box);
  const columns = [...new Set(cells.map((cell) => cell.x))].sort((a, b) => a - b);
  const columnWidth = cells[0]?.w ?? 0;
  const x = FIRST_COLUMN_AT - (columns[1] ?? 0) * BELOW_ZOOM;
  const y = Number(camera.dataset['camera']) - box(camera).y * BELOW_ZOOM;
  const right = viewport.clientWidth - EDGE_INSET;
  const edge = columns.map((column) => x + column * BELOW_ZOOM).find((left) => left >= CONTENT_LEFT) ?? CONTENT_LEFT;

  world.style.transform = `translate(${x}px, ${y}px) scale(${BELOW_ZOOM})`;

  root.querySelectorAll<HTMLElement>('[data-head]').forEach((head) => {
    const start = x + (columns[Number(head.dataset['head'])] ?? 0) * BELOW_ZOOM;
    const left = Math.max(CONTENT_LEFT, start);
    const width = Math.min(right, start + columnWidth * BELOW_ZOOM) - left;
    head.hidden = start < CONTENT_LEFT || width < HEAD_MIN_WIDTH;
    head.style.left = `${left}px`;
    head.style.width = `${width}px`;
  });

  root.querySelectorAll<HTMLElement>('[data-at]').forEach((label) => {
    const target = world.querySelector<HTMLElement>(`[data-anchor="${label.dataset['at']}"]`);
    if (!target) return;
    const area = box(target);
    const padding = parseFloat(getComputedStyle(target).paddingLeft) * BELOW_ZOOM;
    const start = x + area.x * BELOW_ZOOM;
    const left = (start < CONTENT_LEFT ? edge : start) + padding;
    const width = Math.min(right, start + area.w * BELOW_ZOOM - padding) - left;
    label.hidden = width < LABEL_MIN_WIDTH;
    label.style.left = `${left}px`;
    label.style.width = `${width}px`;
    label.style.top = `${y + area.y * BELOW_ZOOM + (area.h * BELOW_ZOOM - label.offsetHeight) / 2}px`;
  });
};

export const belowDrawing = async (parts: {
  round: string;
  heads: string;
  world: string;
  labels?: string;
  headTools?: string;
  status?: boolean;
  discardColor?: string;
  styles: string;
}) => {
  const tree = await partTree.render(side);
  const discard = await button.render({
    label: 'Verwerfen',
    variant: 'transparent',
    size: 'sm',
    color: parts.discardColor,
  });
  const fit = await button.render({ label: 'Fit', variant: 'transparent', size: 'sm' });
  const content = html`<div class="zc-page zb-page" data-et-skip="CLIPPED">
    <header class="zc-head">
      <span class="sk-head-title">elements/part-tree</span
      >${parts.status === false ? '' : html`<span class="sk-status">In Arbeit</span>`}${parts.headTools ?? ''}<span
        class="zc-gap"
      ></span
      >${discard.body}
    </header>
    ${parts.round ? html`<div class="zc-round zb-round">${parts.round}</div>` : ''} ${parts.heads}
    <div class="zb-viewport" aria-label="Design Canvas bei ${BELOW_ZOOM * 100} Prozent Zoom">
      <section class="sk-a-grid sk-world zb-world">${parts.world}</section>
      ${parts.labels ?? ''}
    </div>
    <div class="st-canvas-zoom">${fit.body}<span class="st-canvas-zoom-value">${BELOW_ZOOM * 100}%</span></div>
  </div>`;
  const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: tree.body, content });
  return drawing({
    body: shell.body,
    setup: (root) => {
      placeBelow(root);
      void document.fonts.ready.then(() => placeBelow(root));
    },
    styles: shell.styles + tree.styles + discard.styles + fit.styles + parts.styles + styles,
  });
};
