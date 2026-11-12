import { embedPage, html, slot } from '@design-system';
import { disclosure, disclosureBodyClass } from '@system/components/disclosure';
import { UNCHANGED, stateCount, unchangedGroups } from '@shared/unchanged';
import canvasFrames from '@system/elements/canvas-frames';

export type Row = {
  part: string;
  state: string;
  instances: number;
  width: number;
  height: number;
  body: string;
  missing?: 'now' | 'after';
};

export const TARGET = { part: 'components/button', name: 'button', variant: 'b', note: 'Pill-Radius in jeder Größe' };

const emptySystem = embedPage('pages/system', { state: 'empty', width: 1440, height: 900 });

export const changedOf = async (): Promise<{ rows: Row[]; styles: string }> => {
  const frames = await canvasFrames.render(canvasFrames.states.default);

  return {
    rows: [
      { part: 'elements/canvas-frames', state: 'default', instances: 18, width: 1440, height: 560, body: frames.body },
      { part: 'pages/system', state: 'empty', instances: 1, width: 1440, height: 900, body: emptySystem.body },
      {
        part: 'pages/system',
        state: 'onboarding',
        instances: 1,
        width: 1440,
        height: 900,
        body: emptySystem.body,
        missing: 'now',
      },
    ],
    styles: frames.styles,
  };
};

export const shot = (row: Row, side: 'now' | 'after', scale: number, projected = true) =>
  html`<div
    class="mg-shot relative flex-none overflow-hidden rounded-control-md bg-et-surface-bg"
    data-et-skip="CLIPPED"
    ${projected ? '' : 'inert'}
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
      >${row.instances === 1 ? '1 Instanz' : `${row.instances} Instanzen`}</span
    ></span
  >`;

export const picked = (variant: string) =>
  html`<span
    class="mg-picked inline-flex items-center gap-space-1 h-control-sm px-space-3 box-border rounded-control-md bg-et-theme/20 text-et-theme-ink text-(length:--text-sm) whitespace-nowrap"
    >Gewählt <code class="font-code">${variant}</code></span
  >`;

const groups = unchangedGroups(UNCHANGED);

const unchangedLabel = `${groups.length} Teile ohne sichtbare Änderung`;

const partLabel = (part: string, count: number) =>
  html`<span class="flex flex-wrap gap-x-space-2 gap-y-0"
    ><span class="text-et-surface font-code">${part}</span
    ><span class="whitespace-nowrap">${stateCount(count)}</span></span
  >`;

const unchangedBody = (openPart: string) =>
  html`<div class="st-disclosure-body flex flex-col m-0">
    ${groups
      .map((group) =>
        disclosure({
          label: partLabel(group.part, group.states.length),
          body: html`<ul class="${disclosureBodyClass}">
            ${group.states.map((state) => html`<li>${state}</li>`).join('')}
          </ul>`,
          open: group.part === openPart,
          size: 'xs',
        }),
      )
      .join('')}
  </div>`;

export const unchangedList = (open: boolean) =>
  disclosure({ label: unchangedLabel, body: unchangedBody(groups[0]?.part ?? ''), open, size: 'xs' });
