import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import select from '@system/components/select';
import { commentPinMark } from '@system/components/comment-pin';
import partTree from '@system/elements/part-tree';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import { PAGE_PIN, PAGE_SKETCH, PAGE_VARIANTS, type PageVariant, pageAuthor, pageShot, pinProps } from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import below from './below.css?inline';
import { mountCanvasViewport, type Camera, type Rect } from 'ethlete-studio/canvas';

type Props = { camera: 'fit' | Camera; selected?: PageVariant['key'] };

const HEAD_INSET = 3;
const HEAD_MIN_WIDTH = 180;
const HEAD_GAP = 18;
const ZOOM_STEP = 1.5;

const systemPage = async (panel?: 'hidden') => {
  const tree = await partTree.render(partTree.states['components-open']);
  const frames = await canvasFrames.render(canvasFrames.states.default);
  const menu = await studioMenu({ open: false });
  const shell = await shellMain.render({
    studio: menu.body,
    section: 'System',
    product: 'studio',
    side: tree.body,
    content: frames.body,
    ...(panel ? { panel } : {}),
  });
  return { body: shell.body, styles: frames.styles + menu.styles };
};

const side = await partTree.render({
  layers: [
    { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
  ],
});
const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
const merge = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
const pagePin = commentPinMark(pinProps(PAGE_PIN));
const open = await systemPage();
const hidden = await systemPage('hidden');
const pages: Record<PageVariant['key'], string> = { current: open.body, a: hidden.body, b: open.body };

const picker = await select.render({
  label: '',
  size: 'sm',
  value: 'round-1',
  options: [{ value: 'round-1', label: 'Runde 1 · Mehr Platz für die Leinwand' }],
});
const roundPicker = picker.body;

const variantHead = (variant: PageVariant) =>
  html`<div class="absolute z-2 flex -translate-y-full flex-col gap-space-1 overflow-hidden" data-sk-col-head hidden>
    <div class="flex items-center gap-space-2 whitespace-nowrap [&>*]:flex-none [&_.et-button]:ms-space-2">
      ${
        variant.key === 'current'
          ? html`<span class="font-ui font-ui-medium text-ui-sm text-et-surface">${variant.label}</span>`
          : html`<span class="font-code text-ui-sm text-et-surface">Variante ${variant.label}</span>`
      }
      ${pageAuthor(variant)} ${variant.key === 'current' ? '' : merge.body}
    </div>
    <span class="text-et-surface-muted text-ui-xs whitespace-nowrap overflow-hidden text-ellipsis"
      >${variant.note}</span
    >
  </div>`;

const frame = (variant: PageVariant, selected: boolean) =>
  html`<figure
    class="sk-frame relative m-0 box-border flex rounded-control-md bg-et-surface-bg p-space-2"
    ${selected ? ' data-selected' : ''}
  >
    ${pageShot(variant.key, pages[variant.key], variant.key === 'a' ? html`<span class="absolute top-space-1 right-space-1 z-1 flex">${pagePin}</span>` : '')}
  </figure>`;

const placeHeads = (page: HTMLElement, viewport: HTMLElement, camera: Camera, frames: Rect[]) => {
  const heads = [...page.querySelectorAll<HTMLElement>('[data-sk-col-head]')];
  const bound = viewport.offsetLeft + HEAD_INSET;

  heads.forEach((head, index) => {
    const column = frames[index];
    if (!column) return;
    const start = viewport.offsetLeft + camera.x + column.x * camera.zoom;
    const left = Math.max(bound, start);
    const right = Math.min(page.clientWidth, start + column.width * camera.zoom);
    const top = viewport.offsetTop + camera.y + column.y * camera.zoom - HEAD_GAP;

    head.hidden = right - left < HEAD_MIN_WIDTH;
    head.style.left = `${left}px`;
    head.style.top = `${top}px`;
    head.style.width = `${Math.max(0, right - left)}px`;
  });
};

const setupFor = (camera: Props['camera']) => (root: HTMLElement) => {
  const page = root.querySelector<HTMLElement>('[data-sketches-page]');
  const viewport = root.querySelector<HTMLElement>('[data-sk-viewport]');
  const world = root.querySelector<HTMLElement>('[data-sk-world]');
  const chip = root.querySelector('[data-sketches-page] > [data-canvas-zoom]');
  const label = chip?.querySelector('[data-camera-reset] button') ?? null;
  const showZoom = (zoom: number) => {
    if (label) label.textContent = `${Math.round(zoom * 100)} %`;
  };

  if (!page || !viewport || !world) return;

  if (camera !== 'fit') {
    const frames = [...world.querySelectorAll<HTMLElement>('.sk-frame')].map((element) => ({
      x: element.offsetLeft,
      y: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    }));

    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    showZoom(camera.zoom);
    placeHeads(page, viewport, camera, frames);
    return;
  }

  const canvas = mountCanvasViewport({
    viewport,
    world,
    frameSelector: '.sk-frame',
    padding: HEAD_INSET,
    outline: 1,
    chip: {
      fit: chip?.querySelector('[data-camera-fit]') ?? null,
      reset: chip?.querySelector('[data-camera-reset]') ?? null,
      label: null,
    },
    onPaint: (next, frames) => {
      showZoom(next.zoom);
      placeHeads(page, viewport, next, frames);
    },
  });
  const zoomBy = (factor: number) => () => canvas.show({ kind: 'visible', zoom: canvas.camera().zoom * factor });
  chip?.querySelector('[data-camera-out]')?.addEventListener('click', zoomBy(1 / ZOOM_STEP));
  chip?.querySelector('[data-camera-in]')?.addEventListener('click', zoomBy(ZOOM_STEP));
};

export default definePart<Props>({
  note: 'One continuous canvas for pages, top-aligned after fit with no extra camera inset. Every state draws through one render: a state only sets the camera (fit or a fixed zoom and position) and the selected frame, so the header, the round picker, the variant heads and the zoom chip exist once. The canvas runs behind the navigation and the strip under the open side panel is dimmed. Each visible frame gets a screen-size head attached above it, kept within the visible part of its column and clipped at the canvas edge; a sliver under 180px hides its head. Plain Variante labels replace boxed letters. Merge keeps the action compact. Wheel pans, Ctrl/wheel zooms at the pointer, drag pans, double-click fits a frame. The zoom chip (components/zoom-chip, − | 100 % | + | Fit) zooms out, resets to 100 %, zooms in and fits.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts' },
  controls: { canvas: { kind: 'field', part: 'components/canvas-viewport' } },
  states: {
    'page-sketch': { camera: 'fit' },
    'zoomed-page': { camera: { zoom: 0.6, x: -853.2, y: 44 }, selected: 'a' },
  },
  render: async ({ camera, selected }) => {
    const content = html`<div
      class="relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:z-1 after:w-(--st-shell-inset-left) after:bg-[color-mix(in_srgb,var(--et-surface-background-solid)_60%,transparent)] after:content-['']"
      data-sketches-page
      ${camera === 'fit' ? '' : ' data-et-skip="CLIPPED"'}
    >
      <header
        class="absolute z-2 top-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] right-space-5 flex items-center gap-space-3"
      >
        <span class="text-ui-lg font-ui-strong">${PAGE_SKETCH.part}</span>
        <span class="flex-1"></span>
        ${discard.body}
      </header>
      <div class="zr-picker absolute z-2 top-11 left-[calc(var(--st-shell-inset-left)+var(--space-5))]">
        ${roundPicker}
      </div>
      ${canvasViewport({
        class: 'absolute top-36.5 right-space-5 bottom-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))]',
        attrs: 'data-sk-viewport',
        body: html`<section
          class="absolute top-0 left-0 w-max origin-top-left select-none grid gap-x-space-4 gap-y-space-3 grid-cols-[repeat(3,1456px)]"
          data-sk-world
        >
          ${PAGE_VARIANTS.map((variant) => frame(variant, variant.key === selected)).join('')}
        </section>`,
      })}
      ${PAGE_VARIANTS.map(variantHead).join('')} ${chip.body}
    </div>`;

    const menu = await studioMenu({ open: false });

    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Sketches',
      product: 'studio',
      side: side.body,
      content,
    });

    return drawing({
      body: shell.body,
      setup: [menu.setup, setupFor(camera)],
      styles:
        shell.styles +
        side.styles +
        open.styles +
        discard.styles +
        merge.styles +
        picker.styles +
        canvasViewportStyles +
        kit +
        styles +
        below,
    });
  },
});
