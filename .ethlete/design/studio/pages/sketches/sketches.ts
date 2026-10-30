import { formField } from '@ethlete/components/design/form-field';
import { select, selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import { commentPinMark } from '@system/components/comment-pin';
import partTree from '@system/elements/part-tree';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { PAGE_PIN, PAGE_SKETCH, PAGE_VARIANTS, type PageVariant, pageAuthor, pageShot, pinProps } from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import below from './below.css?inline';
import { mountCanvasViewport, type Camera, type Rect } from 'ethlete-studio/canvas';

type Props = { camera: 'fit' | Camera; selected?: PageVariant['key'] };

const HEAD_INSET = 3;
const HEAD_MIN_WIDTH = 180;
const HEAD_GAP = 18;

const systemPage = async (panel?: 'hidden') => {
  const tree = await partTree.render(partTree.states['components-open']);
  const frames = await canvasFrames.render(canvasFrames.states.default);
  const shell = await shellMain.render({
    section: 'System',
    product: 'studio',
    side: tree.body,
    content: frames.body,
    ...(panel ? { panel } : {}),
  });
  return { body: shell.body, styles: frames.styles };
};

const side = await partTree.render({
  layers: [
    { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
  ],
});
const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
const merge = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
const fit = await button.render({ label: 'Fit', variant: 'transparent', size: 'sm' });
const reset = await button.render({ label: '100%', variant: 'transparent', size: 'sm' });
const pagePin = commentPinMark(pinProps(PAGE_PIN));
const open = await systemPage();
const hidden = await systemPage('hidden');
const pages: Record<PageVariant['key'], string> = { current: open.body, a: hidden.body, b: open.body };

const roundPicker = formField({
  id: 'zoomed-round-picker',
  size: 'sm',
  control: select({ options: [{ value: 'r1', label: 'Runde 1 · Mehr Platz für die Leinwand' }], value: 'r1' }),
});

const variantHead = (variant: PageVariant) =>
  html`<div class="absolute z-2 flex -translate-y-full flex-col gap-space-1 overflow-hidden" data-sk-col-head hidden>
    <div class="flex items-center gap-space-2 whitespace-nowrap [&>*]:flex-none [&_.et-button]:ms-space-2">
      ${
        variant.key === 'current'
          ? html`<span class="font-ui font-ui-medium text-ui-sm text-text">${variant.label}</span>`
          : html`<span class="font-code text-ui-sm text-text">Variante ${variant.label}</span>`
      }
      ${pageAuthor(variant)} ${variant.key === 'current' ? '' : merge.body}
    </div>
    <span class="text-text-muted text-ui-xs whitespace-nowrap overflow-hidden text-ellipsis">${variant.note}</span>
  </div>`;

const frame = (variant: PageVariant, selected: boolean) =>
  html`<figure
    class="sk-frame relative m-0 box-border flex rounded-control-md bg-surface p-space-2"
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
  const page = root.querySelector<HTMLElement>('.sk-page');
  const viewport = root.querySelector<HTMLElement>('[data-sk-viewport]');
  const world = root.querySelector<HTMLElement>('[data-sk-world]');
  const label = root.querySelector('[data-camera-reset] button');

  if (!page || !viewport || !world) return;

  if (camera !== 'fit') {
    const frames = [...world.querySelectorAll<HTMLElement>('.sk-frame')].map((element) => ({
      x: element.offsetLeft,
      y: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    }));

    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    if (label) label.textContent = `${Math.round(camera.zoom * 100)}%`;
    placeHeads(page, viewport, camera, frames);
    return;
  }

  mountCanvasViewport({
    viewport,
    world,
    frameSelector: '.sk-frame',
    padding: HEAD_INSET,
    outline: 1,
    chip: { fit: root.querySelector('[data-camera-fit]'), reset: root.querySelector('[data-camera-reset]'), label },
    onPaint: (next, frames) => placeHeads(page, viewport, next, frames),
  });
};

export default definePart<Props>({
  note: 'One continuous canvas for pages, top-aligned after fit with no extra camera inset. Every state draws through one render: a state only sets the camera (fit or a fixed zoom and position) and the selected frame, so the header, the round picker, the variant heads and the zoom chip exist once. The canvas runs behind the navigation and the strip under the open side panel is dimmed. Each visible frame gets a screen-size head attached above it, kept within the visible part of its column and clipped at the canvas edge; a sliver under 180px hides its head. Plain Variante labels replace boxed letters. Merge keeps the action compact. Wheel pans, Ctrl/wheel zooms at the pointer, drag pans, double-click fits a frame. Fit and 100% remain available.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5'],
  states: {
    'page-sketch': { camera: 'fit' },
    'zoomed-page': { camera: { zoom: 0.6, x: -853.2, y: 44 }, selected: 'a' },
  },
  render: async ({ camera, selected }) => {
    const content = html`<div
      class="sk-page relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:z-1 after:w-(--st-shell-inset-left) after:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] after:content-['']"
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
      <div
        class="absolute top-36.5 right-space-5 bottom-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] cursor-grab touch-none active:cursor-grabbing"
        data-sk-viewport
        tabindex="0"
        aria-label="Design Canvas"
      >
        <section
          class="absolute top-0 left-0 w-max origin-top-left select-none grid gap-x-space-4 gap-y-space-3 grid-cols-[repeat(3,1456px)]"
          data-sk-world
        >
          ${PAGE_VARIANTS.map((variant) => frame(variant, variant.key === selected)).join('')}
        </section>
      </div>
      ${PAGE_VARIANTS.map(variantHead).join('')}
      <div class="st-canvas-zoom z-3">
        <span data-camera-fit>${fit.body}</span>
        <span class="st-canvas-zoom-value" data-camera-reset>${reset.body}</span>
      </div>
    </div>`;

    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });

    return drawing({
      body: shell.body,
      setup: setupFor(camera),
      styles:
        shell.styles +
        side.styles +
        open.styles +
        discard.styles +
        merge.styles +
        fit.styles +
        selectStyles +
        kit +
        styles +
        below,
    });
  },
});
