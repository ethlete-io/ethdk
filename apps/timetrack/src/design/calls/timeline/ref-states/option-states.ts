import { css, drawing, html } from '@design-explore';
import { BandCase, CASES, MINUTES } from './fixture';

const HOUR_REM = 8;
const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

const TILE_BASE =
  'flex w-full flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border px-2 py-1 text-small text-et-surface-muted';

const HEIGHT_REM = (MINUTES / 60) * HOUR_REM;

const band = (bandCase: BandCase) => {
  const labelled = HEIGHT_REM >= LABEL_MIN_REM - 0.3;
  const compact = HEIGHT_REM < LABEL_MIN_REM;
  const detailed = HEIGHT_REM >= DETAIL_MIN_REM;
  const detail = bandCase.detail ?? '';

  return html`
    <div
      class="et-color--${bandCase.tone} flex w-full cursor-grab flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small outline-none hover:bg-et-theme/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink data-[compact]:py-0 data-[compact]:leading-none data-[dragging]:opacity-70 data-[excluded]:cursor-cell data-[marked]:ring-2 data-[marked]:ring-et-theme-ink data-[marked]:ring-inset data-[stand-in]:border-dashed"
      style="height: ${HEIGHT_REM}rem"
      ${compact && 'data-compact'}
      ${bandCase.dragging && 'data-dragging'}
      ${bandCase.excluded && 'data-excluded'}
      ${bandCase.marked && 'data-marked'}
      ${bandCase.standIn && 'data-stand-in'}
      tabindex="0"
    >
      ${labelled && html`<span class="block truncate">${bandCase.label}</span>`}
      ${detailed && detail && html`<span class="block truncate text-et-surface-muted">${detail}</span>`}
    </div>
  `;
};

export default drawing({
  body: html`
    <div class="et-surface--dark flex flex-wrap gap-4 bg-et-surface-bg p-10 text-et-surface">
      ${CASES.map(
        (c) => html`
          <div class="flex w-64 flex-col gap-2">
            <div class="flex items-baseline justify-between text-mono">
              <span>${c.name}</span>
              <span class="text-et-surface-subtle">asks ${c.asks}</span>
            </div>
            <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">${band(c)}</div>
          </div>
        `,
      )}

      <div class="flex w-64 flex-col gap-2">
        <div class="flex items-baseline justify-between text-mono">
          <span>in the background</span>
          <span class="text-et-surface-subtle">asks nothing</span>
        </div>
        <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
          <div
            class="bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,var(--color-et-surface-border)_6px,var(--color-et-surface-border)_7px)] ${TILE_BASE}"
            style="height: ${HEIGHT_REM}rem"
          >
            <span class="block truncate">ET-772 · in the background · 45m</span>
          </div>
        </div>
      </div>

      <div class="flex w-64 flex-col gap-2">
        <div class="flex items-baseline justify-between text-mono">
          <span>break</span>
          <span class="text-et-surface-subtle">asks a click</span>
        </div>
        <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
          <div class="bg-et-surface-interaction ${TILE_BASE}" style="height: ${HEIGHT_REM}rem">
            <span class="block truncate">45m</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: css`
    /* The frame runs without the surface directive, so the value the dark theme sets at runtime is written here. */
    #root {
      --et-surface-interaction: 161 161 161;
    }
  `,
});
