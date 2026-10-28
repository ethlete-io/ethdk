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
  roundHead,
  SKETCH,
  typed,
  UNCHANGED_STATES,
  type Variant,
  VARIANTS,
} from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import { canvasSetup } from './canvas-setup';

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
  const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm' });
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
          ${pageAuthor(variant)}
          ${variant.key === 'current' ? '<span class="sk-current-tag">Gemergt</span>' : pick.body}
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
      <span class="sk-status">${PAGE_SKETCH.status}</span>
      <span class="sk-head-gap"></span>
      ${discard.body}
    </header>
    ${roundHead(PAGE_ROUND, 0, 1)}
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
    styles: shell.styles + side.styles + open.styles + discard.styles + pick.styles + kit + styles,
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

export default definePart<{ sketch: 'element' | 'page' }>({
  note: 'One continuous canvas for components and pages, top-aligned after fit with no extra camera inset. Screen-size variant heads stay within the visible portion of their column; a sliver under 180px hides its head. The header has a stable height before fitting. 100% reveals the nearest frame from its top-left. Double-click focuses state and full-context frames. Pending variants show quiet outlined placeholders instead of unfinished drawings. Earlier rounds follow context content within the canvas, with no fixed footer. Plain Variante labels replace boxed letters. Fit and header geometry reserve space for outlines. Context pages are complete miniature frames that can be zoomed into on the same canvas, not clipped crops. Round titles omit duplicate variant letters, Merge keeps the action compact, and drawing status is quiet inline text beside its author. Native-size frames share one pan/zoom behavior; the initial camera fits the newest round. Variant identities and decision buttons stay at screen size above the canvas. Wheel pans, Ctrl/wheel zooms at the pointer, drag pans, double-click fits a frame. Fit and 100% remain available. Cost: the overview of large pages cannot show detail until zoomed in; the fixed variant bar consumes space.',
  madeBy: ['claude-opus-5-5', 'gpt-6'],
  states: { open: { sketch: 'element' }, 'page-sketch': { sketch: 'page' } },
  render: async ({ sketch }) => {
    if (sketch === 'page') return renderPageSketch();
    const [newest, ...older] = ROUNDS;
    const side = await partTree.render(openSketches);
    const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm' });
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
        <span class="sk-status">${SKETCH.status}</span>
        <span class="sk-head-gap"></span>
        ${discard.body}
      </header>
      ${newest ? roundHead(newest, 0, ROUNDS.length) : ''}
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
        styles,
    });
  },
});
