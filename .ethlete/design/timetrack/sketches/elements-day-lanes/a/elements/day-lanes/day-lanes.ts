import { definePart, drawing, html } from '@design-system';
import {
  LANES,
  Row,
  Subagent,
  durationOf,
  formatMinutes,
  heightRemOf,
  shortSubagentsOf,
  stripesOf,
  topRemOf,
} from '@shared/day';
import { LANE_MIN_REM, laneHeader, dayTimeline, rowBand } from '@shared/timeline';

const PARENT_WIDTH = 60;

const tick = (row: Row, subagent: Subagent) => html`
  <span
    class="absolute right-0 w-2 rounded-l-sm bg-et-theme"
    style="top: ${topRemOf(subagent.from) - topRemOf(row.from)}rem; height: ${Math.max(heightRemOf(subagent), 0.6)}rem"
    title="${subagent.task} · ${formatMinutes(durationOf(subagent))}"
    data-short-subagent
  ></span>
`;

const TWO_LINE_MIN_REM = 4;

const stripeLabel = (subagent: Subagent) =>
  heightRemOf(subagent) < TWO_LINE_MIN_REM
    ? html`<span class="truncate"
        >${subagent.task} <span class="text-et-surface-muted">${formatMinutes(durationOf(subagent))}</span></span
      >`
    : html`<span class="line-clamp-2">${subagent.task}</span>
        <span class="truncate text-et-surface-muted">${formatMinutes(durationOf(subagent))} · books nothing</span>`;

const stripe = (row: Row, subagent: Subagent) => html`
  <div
    class="et-color--${row.theme} absolute flex flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme/60 bg-et-theme/8 px-1.5 py-0.5 text-small leading-tight"
    style="top: ${topRemOf(subagent.from)}rem; height: ${heightRemOf(subagent)}rem; left: ${PARENT_WIDTH}%; width: ${
      100 - PARENT_WIDTH
    }%"
    title="${subagent.task}"
    data-subagent
  >
    ${stripeLabel(subagent)}
  </div>
`;

const rail = (row: Row) => html`
  <div
    class="et-color--${row.theme} absolute border-l border-dashed border-l-et-theme/40"
    style="top: ${topRemOf(row.from)}rem; height: ${heightRemOf(row)}rem; left: ${PARENT_WIDTH}%"
  ></div>
`;

const subagentCount = (row: Row) => {
  const short = shortSubagentsOf(row).length;

  return html`<span class="relative mt-auto block truncate text-et-surface-muted"
    >${row.subagents.length} subagents${short ? ` · ${short} short` : ''}</span
  >`;
};

const sessionWithSubagents = (row: Row) => html`
  ${rowBand({
    row,
    width: `calc(${PARENT_WIDTH}% - 0.4rem)`,
    overlay: shortSubagentsOf(row)
      .map((subagent) => tick(row, subagent))
      .join(''),
    detail: subagentCount(row),
  })}
  ${rail(row)} ${stripesOf(row).map((subagent) => stripe(row, subagent))}
`;

const laneBody = (rows: Row[]) =>
  rows.map((row) => (row.subagents.length ? sessionWithSubagents(row) : rowBand({ row }))).join('');

export default definePart({
  note: 'A subagent of 15 min or longer is a thin stripe inside its session lane, beside the session band, in the session colour at a lower tone. A shorter one is a tick on the session band.',
  controls: {},
  states: { default: {} },
  describe: { default: 'Day of 19.11. shape: two parallel sessions, three subagents under the acme-web session' },
  render: () =>
    drawing({
      body: dayTimeline(
        LANES.map((lane) => ({
          header: laneHeader(lane.label),
          body: laneBody(lane.rows),
          minRem: LANE_MIN_REM,
          grow: 1,
        })),
      ),
    }),
});
