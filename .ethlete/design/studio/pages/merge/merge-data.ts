import { embedPage, html, slot } from '@design-system';
import { disclosureBodyClass } from '@system/components/disclosure';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';

export type Row = { part: string; state: string; instances: number; width: number; height: number; body: string };

export const TARGET = { part: 'components/button', name: 'button', variant: 'b', note: 'Pill radius on every size' };

const frames = await canvasFrames.render(canvasFrames.states.default);
const emptySystem = embedPage('pages/system', { state: 'empty', width: 1440, height: 900 });

export const CHANGED: Row[] = [
  { part: 'elements/canvas-frames', state: 'default', instances: 18, width: 1440, height: 560, body: frames.body },
  { part: 'pages/system', state: 'empty', instances: 1, width: 1440, height: 900, body: emptySystem.body },
];

export const UNCHANGED = { part: 'pages/inbox', states: ['all', 'none'] };

export const unchangedLabel = `${UNCHANGED.states.length} states of ${UNCHANGED.part} without visible change`;

export const rowStyles = frames.styles;

export const buttonTree = await partTree.render({
  layers: [
    { title: 'Components', open: true, parts: [{ name: 'button', leaf: true, selected: true }] },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
});

export const shot = (row: Row, side: 'now' | 'after', scale: number, projected = true) =>
  html`<div
    class="mg-shot relative flex-none overflow-hidden rounded-control-md bg-et-surface-bg"
    data-et-skip="CLIPPED"
    data-side="${side}"
    style="--mg-scale: ${scale}; --mg-w: ${row.width}px; --mg-h: ${row.height}px"
  >
    <div class="mg-shot-page pointer-events-none origin-top-left">
      ${projected ? html`<div class="contents" ${slot('shot')}>${row.body}</div>` : row.body}
    </div>
  </div>`;

export const rowCaption = (row: Row, stacked = false) =>
  html`<span
    class="flex items-baseline gap-space-2 min-w-0 text-ui-sm whitespace-nowrap ${stacked ? 'flex-wrap gap-y-0' : ''}"
    ><span class="text-et-surface font-code">${row.part}</span><span class="text-et-surface-muted">${row.state}</span
    ><span
      class="text-et-surface-muted text-(length:--text-xs) ${stacked ? 'basis-full' : "before:content-['·'] before:mr-space-2"}"
      >${row.instances === 1 ? '1 instance' : `${row.instances} instances`}</span
    ></span
  >`;

export const picked = (variant: string) =>
  html`<span
    class="mg-picked inline-flex items-center gap-space-1 h-control-sm px-space-3 box-border rounded-control-md bg-et-theme/20 text-et-theme-ink text-(length:--text-sm) whitespace-nowrap"
    >Picked <code class="font-code">${variant}</code></span
  >`;

export const unchangedBody = html`<ul class="${disclosureBodyClass}">
  ${UNCHANGED.states.map((state) => html`<li><span class="text-et-surface font-code">${UNCHANGED.part}</span><span class="text-et-surface-muted">${state}</span></li>`).join('')}
</ul>`;
