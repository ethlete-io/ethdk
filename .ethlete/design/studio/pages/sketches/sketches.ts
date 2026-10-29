import { formField } from '@ethlete/components/design/form-field';
import { buttonStyles } from '@ethlete/components/design/button';
import { select, selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import partTree from '@system/elements/part-tree';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import {
  authorMark,
  changedStates,
  contextCrop,
  drawingLabel,
  foldedRound,
  foldedStates,
  NOTES,
  PAGE_PIN,
  PAGE_ROUND,
  PAGE_SKETCH,
  PAGE_VARIANTS,
  pageAuthor,
  pageShot,
  pinMark,
  pinOf,
  ROUNDS,
  SKETCH,
  typed,
  UNCHANGED_STATES,
  type Variant,
  VARIANTS,
} from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import below from './below.css?inline';
import header from './header.css?inline';
import headStyles from './heads.css?inline';
import { mountCanvasViewport } from 'ethlete-studio/canvas';
import { agentLogo } from './agent-logos';
import { belowDrawing, belowRows } from './shared/below';

const belowData = { VARIANTS, NOTES, changedStates, typed, contextCrop, authorMark, drawingLabel };

const openSketches = {
  layers: [
    { title: 'Components', open: true, parts: [{ name: 'button', leaf: true }] },
    { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true, selected: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'inbox', leaf: true, warns: true }] },
  ],
};

const pickButton = async (variant: Variant) =>
  variant.key === 'current'
    ? { body: '<span class="sk-current-tag">Gemergt</span>', styles: '' }
    : variant.drawing
      ? { body: drawingLabel(variant), styles: '' }
      : button.render({ label: 'Merge', variant: 'outline', size: 'sm' });

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
      html`<div class="sk-a-col-head">
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
    <div class="zr-picker">${zoomedRoundPicker()}</div>
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
      shell.styles +
      side.styles +
      open.styles +
      discard.styles +
      pick.styles +
      selectStyles +
      kit +
      styles +
      below +
      header +
      headStyles,
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

const dimmed = (variant: Variant, body: string) =>
  variant.drawing
    ? `<figure class="sk-frame sk-pending" aria-label="Variante ${variant.label} wird gezeichnet"><span>Wird gezeichnet</span></figure>`
    : body;

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
    <div class="zc-attached" data-next>
      <div class="zc-inline">
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
      below +
      headStyles,
  });
};

const roundPicker = () => {
  const options = ROUNDS.map((round, index) => ({
    value: round.key,
    label: `Runde ${ROUNDS.length - index} · ${round.title}`,
  }));
  return formField({
    id: 'round-picker',
    size: 'sm',
    control: select({ options, value: ROUNDS[0]?.key }),
  });
};

const renderBelow = async () => {
  const rows = await belowRows(belowData);
  const world = html`${rows.stateRows}
    <div class="sk-a-span zb-mark" data-camera="80"></div>
    <div class="sk-a-span zb-spacer" data-anchor="band"></div>
    ${rows.contextFrames}`;
  return belowDrawing({
    round: html`<div class="zr-picker">${roundPicker()}</div>`,
    status: false,
    discardColor: 'danger',
    heads: rows.heads,
    world,
    labels: '<span class="zb-label sk-band-title" data-at="band">Im Kontext · pages/system</span>',
    styles: rows.styles + selectStyles + buttonStyles + kit + styles + below,
  });
};

export default definePart<{ sketch: 'element' | 'page' | 'zoomed' | 'below' }>({
  note: 'One continuous canvas for components and pages, top-aligned after fit with no extra camera inset. Screen-size variant heads stay within the visible portion of their column; a sliver under 180px hides its head. The header has a stable height before fitting. 100% reveals the nearest frame from its top-left. Double-click focuses state and full-context frames. Pending variants show quiet outlined placeholders instead of unfinished drawings. Earlier rounds follow context content within the canvas, with no fixed footer. Plain Variante labels replace boxed letters. Fit and header geometry reserve space for outlines. Context pages are complete miniature frames that can be zoomed into on the same canvas, not clipped crops. Round titles omit duplicate variant letters, Merge keeps the action compact, and drawing status is quiet inline text beside its author. Native-size frames share one pan/zoom behavior; the initial camera fits the newest round. Variant identities and decision buttons stay at screen size above the canvas. Wheel pans, Ctrl/wheel zooms at the pointer, drag pans, double-click fits a frame. Fit and 100% remain available. State zoomed-page draws the agreed zoom composition: attached heads above the frame, the canvas behind navigation, and the canvas strip under the open side panel dimmed to 40 percent. State zoomed-below pans a 150% camera below the variant rows: the header holds only the part name and a danger Verwerfen button, with no status badge because a sketch is always in progress and no arrow buttons; the round line sits directly under the header as quiet text, the round name (Runde 3 · Kleinere Baumschrift) with a chevron and no field box, and opens the round select; the variant heads follow directly under it; only the Im Kontext band stays on the canvas, under a screen-size band label aligned to the first visible frame edge, and its frame captions scale with the frames. Cost: the round line takes its own row again under the header, stepping through rounds in order is gone so a far round always needs the select, and comparing rounds side by side on the canvas is gone. Variant heads have no right side: Merge follows the author inline, the Aktuell head carries no Gemergt label because the current column is always the merged state, and each head ends 24px before the next column. In zoomed-page every visible frame gets the full head, clipped at the viewport edge.',
  madeBy: ['claude-opus-5-5', 'gpt-6'],
  states: {
    'page-sketch': { sketch: 'page' },
    'zoomed-page': { sketch: 'zoomed' },
  },
  render: async ({ sketch }) => {
    if (sketch === 'page') return renderPageSketch();
    if (sketch === 'zoomed') return renderZoomedPage();
    if (sketch === 'below') return renderBelow();
    const [, ...older] = ROUNDS;
    const side = await partTree.render(openSketches);
    const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
    const page = await systemPage();
    const picks = await Promise.all(VARIANTS.map(pickButton));
    const frames = await Promise.all(
      changedStates(partTree.states['components-open']).map(async (state) => ({
        name: state.name,
        drawn: await partTree.render(state.props),
      })),
    );

    const heads = VARIANTS.map(
      (variant, index) =>
        html`<div class="sk-a-col-head">
          <div class="sk-variant-head">
            <span class="sk-letter" ${variant.key === 'current' ? ' data-current' : ''}
              >${variant.key === 'current' ? variant.label : 'Variante ' + variant.label}</span
            >
            ${authorMark(variant)} ${picks[index]?.body ?? ''}
          </div>
          <span class="sk-variant-note">${NOTES[variant.key]}</span>
        </div>`,
    ).join('');

    const stateRows = frames
      .map(({ name, drawn }) =>
        VARIANTS.map((variant) =>
          dimmed(
            variant,
            html`<figure class="sk-frame sk-a-frame">
              <figcaption class="sk-frame-caption">${name}</figcaption>
              ${typed(variant.key, drawn.body)} ${pinMark(pinOf(variant.key, name))}
            </figure>`,
          ),
        ).join(''),
      )
      .join('');

    const contextFrames = VARIANTS.map((variant) => dimmed(variant, contextCrop(variant.key, page.body))).join('');

    const content = html`<div class="sk-page">
      <header class="sk-head">
        <span class="sk-head-title">${SKETCH.part}</span>
        <span class="sk-head-gap"></span>
        ${discard.body}
      </header>
      <div class="zr-picker">${roundPicker()}</div>
      <div class="sk-fixed-heads">${heads}</div>
      ${canvasTools}
      <div class="sk-viewport" tabindex="0" aria-label="Design Canvas">
        <section class="sk-a-grid sk-world">
          ${stateRows}
          <div class="sk-a-span">${foldedStates(UNCHANGED_STATES)}</div>
          <div class="sk-a-span sk-band-title">Im Kontext · pages/system</div>
          ${contextFrames}
          <div class="sk-a-span sk-a-older">
            ${older.map((round, index) => foldedRound(round, index + 1, ROUNDS.length)).join('')}
          </div>
        </section>
      </div>
    </div>`;

    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });

    return drawing({
      body: shell.body,
      setup: canvasSetup,
      styles:
        shell.styles +
        side.styles +
        page.styles +
        (frames[0]?.drawn.styles ?? '') +
        discard.styles +
        (picks[1]?.styles ?? '') +
        kit +
        styles +
        selectStyles +
        below +
        header,
    });
  },
});
