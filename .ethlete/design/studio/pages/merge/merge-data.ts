import { html } from '@design-system';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import system from '@system/pages/system';

export type Row = { part: string; state: string; instances: number; width: number; height: number; body: string };

export const TARGET = { part: 'components/button', name: 'button', variant: 'b', note: 'Pill radius on every size' };

const frames = await canvasFrames.render(canvasFrames.states.default);
const emptySystem = await system.render({ empty: true });

export const CHANGED: Row[] = [
  { part: 'elements/canvas-frames', state: 'default', instances: 18, width: 1440, height: 560, body: frames.body },
  { part: 'pages/system', state: 'empty', instances: 1, width: 1440, height: 900, body: emptySystem.body },
];

export const UNCHANGED = { part: 'pages/inbox', states: ['all', 'none'] };

export const unchangedLabel = `${UNCHANGED.states.length} states of ${UNCHANGED.part} without visible change`;

export const rowStyles = frames.styles + emptySystem.styles;

export const buttonTree = await partTree.render({
  layers: [
    { title: 'Components', open: true, parts: [{ name: 'button', leaf: true, selected: true }] },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
});

export const shot = (row: Row, side: 'now' | 'after', scale: number) =>
  html`<div
    class="mg-shot"
    data-et-skip="CLIPPED"
    data-side="${side}"
    style="--mg-scale: ${scale}; --mg-w: ${row.width}px; --mg-h: ${row.height}px"
  >
    <div class="mg-shot-page">${row.body}</div>
  </div>`;

export const rowCaption = (row: Row) =>
  html`<span class="mg-row-caption"
    ><span class="mg-row-part">${row.part}</span><span class="mg-row-state">${row.state}</span
    ><span class="mg-row-count">${row.instances === 1 ? '1 instance' : `${row.instances} instances`}</span></span
  >`;

export const picked = (variant: string) => html`<span class="mg-picked">Picked <code>${variant}</code></span>`;

const CHEVRON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

export const unchangedLine = () =>
  html`<button class="mg-unchanged" type="button">${CHEVRON}<span>${unchangedLabel}</span></button>`;
