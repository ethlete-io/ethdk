import { definePart, drawing, html } from '@design-system';
import {
  LANES,
  Lane,
  Row,
  Subagent,
  durationOf,
  formatMinutes,
  heightRemOf,
  shortSubagentsOf,
  stripesOf,
  topRemOf,
} from '@shared/day';
import { Column, LANE_MIN_REM, laneHeader, dayTimeline, rowBand } from '@shared/timeline';

const SUB_ROW_MIN_REM = 20;

const shortList = (row: Row) =>
  shortSubagentsOf(row).map(
    (subagent) =>
      html`<span class="relative block w-fit max-w-full truncate text-et-surface-muted" data-short-subagent
        >↳ ${subagent.task} · ${formatMinutes(durationOf(subagent))}</span
      >`,
  );

const bracket = (row: Row) => html`
  <div
    class="et-color--${row.theme} absolute left-0 w-3 rounded-r-sm border-y border-r border-et-theme/50"
    style="top: ${topRemOf(row.from)}rem; height: ${heightRemOf(row)}rem"
  ></div>
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
  <div class="et-color--${row.theme}">
    <span class="absolute left-3 h-px w-3 bg-et-theme/50" style="top: ${topRemOf(subagent.from) + 0.8}rem"></span>
    <div
      class="absolute right-1 left-6 flex flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme/60 bg-et-theme/8 px-2 py-0.5 text-small leading-tight"
      style="top: ${topRemOf(subagent.from)}rem; height: ${heightRemOf(subagent)}rem"
      title="${subagent.task}"
      data-subagent
    >
      ${stripeLabel(subagent)}
    </div>
  </div>
`;

const subRowHeader = (row: Row) =>
  html`<span class="block truncate py-1 pr-2 pl-4 text-small text-et-surface-subtle"
    >↳ subagents of ${row.label}</span
  >`;

const columnsOf = (lane: Lane): Column[] => {
  const parent = lane.rows.find((row) => stripesOf(row).length);
  const own: Column = {
    header: laneHeader(lane.label),
    body: lane.rows.map((row) => rowBand({ row, detail: shortList(row).join('') })).join(''),
    minRem: LANE_MIN_REM,
    grow: 1,
  };

  if (!parent) return [own];

  return [
    own,
    {
      header: subRowHeader(parent),
      body: html`${bracket(parent)}${stripesOf(parent).map((subagent) => stripe(parent, subagent))}`,
      minRem: SUB_ROW_MIN_REM,
      grow: 0,
    },
  ];
};

export default definePart({
  note: 'A subagent of 15 min or longer is a band in an indented sub-row right after its session lane, joined to the session band by a bracket. A shorter one is listed in the session band.',
  controls: {},
  states: { default: {} },
  describe: { default: 'Day of 19.11. shape: two parallel sessions, three subagents under the acme-web session' },
  render: () => drawing({ body: dayTimeline(LANES.flatMap(columnsOf)) }),
});
