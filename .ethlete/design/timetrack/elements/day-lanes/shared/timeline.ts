import { html } from '@design-system';
import {
  DAY_HEIGHT_REM,
  DAY_START_HOUR,
  HOUR_REM,
  HOURS,
  Row,
  formatMinutes,
  durationOf,
  heightRemOf,
  topRemOf,
} from './day';

export type Column = { header: string; body: string; minRem: number; grow: number };

const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

export const LANE_MIN_REM = 30;

export const rowBand = (options: { row: Row; left?: string; width?: string; detail?: string; overlay?: string }) => {
  const { row } = options;
  const height = heightRemOf(row);
  const compact = height < LABEL_MIN_REM;
  const detailed = height >= DETAIL_MIN_REM;

  return html`
    <div
      class="et-color--${row.theme} absolute flex flex-col overflow-hidden rounded-sm border-l-2 border-l-et-tone-fill bg-et-tone-fill/15 px-2 py-1 text-left text-small data-compact:py-0 data-compact:leading-none"
      style="top: ${topRemOf(row.from)}rem; height: ${height}rem; left: ${options.left ?? '0'}; width: ${
        options.width ?? '100%'
      }"
      ${compact && 'data-compact'}
      data-row="${row.id}"
    >
      ${options.overlay ?? ''}
      <span class="relative block w-fit max-w-full truncate">
        ${row.label} <span class="text-et-surface-text-muted">${formatMinutes(durationOf(row))}</span>
        ${!detailed && html`<span class="text-et-surface-text-muted">${' · ' + row.description}</span>`}
      </span>
      ${detailed && html`<span class="relative block w-fit max-w-full truncate text-et-surface-text-muted">${row.description}</span>`}
      ${options.detail ?? ''}
    </div>
  `;
};

export const laneHeader = (label: string) =>
  html`<span class="block truncate px-2 py-1 text-small text-et-surface-text-muted">${label}</span>`;

export const dayTimeline = (columns: Column[]) => html`
  <div class="flex h-full w-full flex-col overflow-hidden bg-et-surface-background pb-4">
    <div class="flex">
      <div class="w-13 shrink-0"></div>
      ${columns.map(
        (column) => html`
          <div
            class="basis-0 overflow-hidden border-b border-l border-et-surface-border"
            style="flex-grow: ${column.grow}; min-width: ${column.minRem}rem"
            data-lane-header
          >
            ${column.header}
          </div>
        `,
      )}
    </div>

    <div class="relative mt-4" style="height: ${DAY_HEIGHT_REM}rem">
      ${HOURS.map(
        (hour) => html`
          <div
            class="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
            style="top: ${(hour - DAY_START_HOUR) * HOUR_REM}rem"
          >
            <span class="w-11 shrink-0 text-right text-mono text-et-surface-text-subtle">${hour}:00</span>
            <span class="h-px grow bg-et-surface-border"></span>
          </div>
        `,
      )}

      <div class="absolute inset-y-0 right-0 left-13 flex">
        ${columns.map(
          (column) => html`
            <div
              class="relative basis-0 border-l border-et-surface-border"
              style="flex-grow: ${column.grow}; min-width: ${column.minRem}rem"
              data-lane
            >
              ${column.body}
            </div>
          `,
        )}
      </div>
    </div>
  </div>
`;
