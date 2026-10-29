import { formField } from '@ethlete/components/design/form-field';
import { select, selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import partTree from '@system/elements/part-tree';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { PAGE_PIN, PAGE_SKETCH, PAGE_VARIANTS, pageAuthor, pageShot, pinMark } from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import below from './below.css?inline';
import { mountCanvasViewport } from 'ethlete-studio/canvas';
import { agentLogo } from './agent-logos';

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

const openPageSketch = {
  layers: [
    { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
  ],
};

const renderPageSketch = async () => {
  const side = await partTree.render(openPageSketch);
  const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
  const pick = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
  const open = await systemPage();
  const hidden = await systemPage('hidden');
  const pages = { current: open.body, a: hidden.body, b: open.body };

  const heads = PAGE_VARIANTS.map(
    (variant) =>
      html`<div class="sk-a-col-head pe-(--space-6)">
        <div class="sk-variant-head">
          <span class="sk-letter" ${variant.key === 'current' ? ' data-current' : ''}
            >${variant.key === 'current' ? variant.label : 'Variante ' + variant.label}</span
          >
          ${pageAuthor(variant)} ${variant.key === 'current' ? '' : pick.body}
        </div>
        <span class="sk-variant-note">${variant.note}</span>
      </div>`,
  ).join('');

  const shots = PAGE_VARIANTS.map(
    (variant) =>
      html`<figure class="sk-frame sk-a-frame">
        <figcaption class="sk-frame-caption">${PAGE_SKETCH.state}</figcaption>
        ${pageShot(variant.key, pages[variant.key], variant.key === 'a' ? pinMark(PAGE_PIN) : '')}
      </figure>`,
  ).join('');

  const content = html`<div class="sk-page">
    <header class="sk-head">
      <span class="sk-head-title">${PAGE_SKETCH.part}</span>
      <span class="sk-head-gap"></span>
      ${discard.body}
    </header>
    <div class="zr-picker self-start mt-[-11px]">${zoomedRoundPicker()}</div>
    <div class="sk-fixed-heads">${heads}</div>
    ${canvasTools}
    <div class="sk-viewport" tabindex="0" aria-label="Design Canvas">
      <section class="sk-a-grid sk-world" data-page-sketch>${shots}</section>
    </div>
  </div>`;

  const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });

  return drawing({
    body: shell.body,
    setup: canvasSetup,
    styles:
      shell.styles + side.styles + open.styles + discard.styles + pick.styles + selectStyles + kit + styles + below,
  });
};

const HEAD_INSET = 3;
const HEAD_MIN_WIDTH = 180;

const canvasSetup = (root: HTMLElement) => {
  const viewport = root.querySelector<HTMLElement>('.sk-viewport');
  const world = root.querySelector<HTMLElement>('.sk-world');
  const heads = [...(root.querySelector('.sk-fixed-heads')?.children ?? [])] as HTMLElement[];

  if (!viewport || !world) return;

  mountCanvasViewport({
    viewport,
    world,
    frameSelector: '.sk-frame',
    padding: HEAD_INSET,
    outline: 1,
    chip: {
      fit: root.querySelector('[data-camera-fit]'),
      reset: root.querySelector('[data-camera-reset]'),
      label: root.querySelector('[data-camera-reset] button'),
    },
    onPaint: (camera, frames) =>
      heads.forEach((head, index) => {
        const column = frames[index];
        const start = camera.x + (column?.x ?? 0) * camera.zoom;
        const left = Math.max(HEAD_INSET, start);
        const right = Math.min(viewport.clientWidth - HEAD_INSET, start + (column?.width ?? 0) * camera.zoom);

        head.hidden = right - left < HEAD_MIN_WIDTH;
        head.style.left = `${left}px`;
        head.style.width = `${Math.max(0, right - left)}px`;
      }),
  });
};

const fitControl = await button.render({ label: 'Fit', variant: 'transparent', size: 'sm' });
const resetControl = await button.render({ label: '100%', variant: 'transparent', size: 'sm' });
const canvasTools = html`<div class="st-canvas-zoom">
  <span data-camera-fit>${fitControl.body}</span>
  <span class="st-canvas-zoom-value" data-camera-reset>${resetControl.body}</span>
</div>`;

const zoomedRoundPicker = () =>
  formField({
    id: 'zoomed-round-picker',
    size: 'sm',
    control: select({ options: [{ value: 'r1', label: 'Runde 1 · Mehr Platz für die Leinwand' }], value: 'r1' }),
  });

const renderZoomedPage = async () => {
  const side = await partTree.render({
    layers: [
      { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
      { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
    ],
  });
  const tree = await partTree.render(partTree.states['components-open']);
  const frames = await canvasFrames.render(canvasFrames.states.default);
  const open = await shellMain.render({
    section: 'System',
    product: 'studio',
    side: tree.body,
    content: frames.body,
  });
  const hidden = await shellMain.render({
    section: 'System',
    product: 'studio',
    side: tree.body,
    content: frames.body,
    panel: 'hidden',
  });
  const merge = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
  const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
  const fit = await button.render({ label: 'Fit', variant: 'transparent', size: 'sm' });
  const content = html`<div class="zc-page" data-treatment="attached" data-et-skip="CLIPPED">
    <header class="zc-head">
      <span class="sk-head-title">pages/system</span><span class="zc-gap"></span>${discard.body}
    </header>
    <div class="zc-round zb-round"><div class="zr-picker">${zoomedRoundPicker()}</div></div>
    <section class="zc-world" aria-label="Varianten bei 60 Prozent Zoom">
      <figure class="sk-frame zc-frame">${pageShot('current', open.body)}</figure>
      <figure class="sk-frame zc-frame" data-selected>${pageShot('a', hidden.body, pinMark(PAGE_PIN))}</figure>
      <figure class="sk-frame zc-frame">${pageShot('b', open.body)}</figure>
    </section>
    <div class="zc-attached">
      <div class="zc-inline">
        <span class="zc-name">Variante a</span
        ><span class="sk-author">${agentLogo('claude', 'sk-logo')}Claude</span>${merge.body}
      </div>
      <span class="zc-note">Panel ausgeblendet</span>
    </div>
    <div class="zc-attached left-[1193.2px] right-0 overflow-hidden">
      <div class="zc-inline [&>*]:flex-none [&>*]:whitespace-nowrap">
        <span class="zc-name">Variante b</span
        ><span class="sk-author">${agentLogo('codex', 'sk-logo')}Codex</span>${merge.body}
      </div>
      <span class="zc-note">Panel 200 px</span>
    </div>
    <div class="st-canvas-zoom">${fit.body}<span class="st-canvas-zoom-value">60%</span></div>
  </div>`;
  const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });
  return drawing({
    body: shell.body,
    styles:
      shell.styles +
      side.styles +
      tree.styles +
      frames.styles +
      merge.styles +
      discard.styles +
      selectStyles +
      kit +
      styles +
      below,
  });
};

export default definePart<{ sketch: 'page' | 'zoomed' }>({
  note: 'One continuous canvas for pages, top-aligned after fit with no extra camera inset. Screen-size variant heads stay within the visible portion of their column; a sliver under 180px hides its head. The header has a stable height before fitting. 100% reveals the nearest frame from its top-left. Double-click focuses a frame. Plain Variante labels replace boxed letters. Fit and header geometry reserve space for outlines. Merge keeps the action compact. Native-size frames share one pan/zoom behavior. Variant identities and decision buttons stay at screen size above the canvas. Wheel pans, Ctrl/wheel zooms at the pointer, drag pans, double-click fits a frame. Fit and 100% remain available. State zoomed-page draws the agreed zoom composition: attached heads above the frame, the canvas behind navigation, and the canvas strip under the open side panel dimmed to 40 percent. In zoomed-page every visible frame gets the full head, clipped at the viewport edge.',
  madeBy: ['claude-opus-5-5', 'gpt-6'],
  states: {
    'page-sketch': { sketch: 'page' },
    'zoomed-page': { sketch: 'zoomed' },
  },
  render: async ({ sketch }) => {
    return sketch === 'page' ? renderPageSketch() : renderZoomedPage();
  },
});
