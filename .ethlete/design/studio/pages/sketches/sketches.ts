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
  NO_CONTEXT,
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
      : button.render({ label: 'Übernehmen', variant: 'outline', size: 'sm' });

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
  const pick = await button.render({ label: 'Übernehmen', variant: 'outline', size: 'sm' });
  const open = await systemPage();
  const hidden = await systemPage('hidden');
  const pages = { current: open.body, a: hidden.body, b: open.body };

  const heads = PAGE_VARIANTS.map(
    (variant) =>
      html`<div class="sk-a-col-head">
        <div class="sk-variant-head">
          <span class="sk-letter" ${variant.key === 'current' ? ' data-current' : ''}>${variant.label}</span>
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
    <section class="sk-a-grid" data-page-sketch>
      ${heads} ${shots}
      <div class="sk-a-span sk-no-context">${NO_CONTEXT}</div>
    </section>
  </div>`;

  const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });

  return drawing({
    body: shell.body,
    styles: shell.styles + side.styles + open.styles + discard.styles + pick.styles + kit + styles,
  });
};

const dimmed = (variant: Variant, body: string) => (variant.drawing ? `<div class="sk-dim">${body}</div>` : body);

export default definePart<{ sketch: 'element' | 'page' }>({
  note: 'Every round is a row on one long canvas, newest on top: the variants of the newest round stand side by side next to current, one frame per changed state, with the unchanged states folded below and an In context band that crops pages/system per variant. Older rounds fold to one thin row with their note. The SDK buttons take the Studio accent through the colour tokens. A sketch on a page (page-sketch) draws each 1440x900 frame scaled to a fifth side by side, a click opens it at full size, and the In context band drops out. Costs: the newest round owns the canvas, so an older round must be unfolded in place to compare it; a round with many states pushes the In context band below the fold; page frames at a fifth are an overview only, so any detail costs a click.',
  madeBy: ['claude-opus-5-5'],
  states: { open: { sketch: 'element' }, 'page-sketch': { sketch: 'page' } },
  checks: { skip: ['CLIPPED'] },
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
            <span class="sk-letter" ${variant.key === 'current' ? ' data-current' : ''}>${variant.label}</span>
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

    const crops = VARIANTS.map((variant) => dimmed(variant, contextCrop(variant.key, page.body))).join('');

    const content = html`<div class="sk-page">
      <header class="sk-head">
        <span class="sk-head-title">${SKETCH.part}</span>
        <span class="sk-status">${SKETCH.status}</span>
        <span class="sk-head-gap"></span>
        ${discard.body}
      </header>
      ${newest ? roundHead(newest, 0, ROUNDS.length) : ''}
      <section class="sk-a-grid">
        ${heads} ${stateRows}
        <div class="sk-a-span">${foldedStates(UNCHANGED_STATES)}</div>
        <div class="sk-a-span sk-band-title">Im Kontext · pages/system</div>
        ${crops}
      </section>
      <div class="sk-a-older">
        ${older.map((round, index) => foldedRound(round, index + 1, ROUNDS.length)).join('')}
      </div>
    </div>`;

    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });

    return drawing({
      body: shell.body,
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
