import { definePart, drawing, html } from '@design-system';
import { LANES, Lane, Row, Subagent, durationOf, formatMinutes, shortSubagentsOf, stripesOf } from '@shared/day';
import { Column, LANE_MIN_REM, laneHeader, dayTimeline, rowBand } from '@shared/timeline';

const shortList = (row: Row) =>
  shortSubagentsOf(row).map(
    (subagent) =>
      html`<span class="relative block w-fit max-w-full truncate text-et-surface-muted" data-short-subagent
        >✳ ${subagent.task} · ${formatMinutes(durationOf(subagent))}</span
      >`,
  );

const subagentRow = (parent: Row, subagent: Subagent): Row => ({
  id: `${parent.id}-${subagent.from}`,
  label: `✳ ${subagent.task}`,
  description: `agent of ${parent.label} · books nothing`,
  from: subagent.from,
  to: subagent.to,
  theme: parent.theme,
  subagents: [],
});

const childHeader = (lane: Lane, parent: Row) =>
  html`<span class="block truncate px-2 py-1 text-small text-et-surface-muted"
    >✳ agent · ${lane.label} · ${parent.label}</span
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
      header: childHeader(lane, parent),
      body: stripesOf(parent)
        .map((subagent) => rowBand({ row: subagentRow(parent, subagent) }))
        .join(''),
      minRem: LANE_MIN_REM,
      grow: 1,
    },
  ];
};

export default definePart({
  note: 'A subagent of 15 min or longer gets a lane as wide as a session lane, marked with an agent glyph and its session. A shorter one is listed in the session band.',
  controls: {},
  states: { default: {} },
  describe: { default: 'Day of 19.11. shape: two parallel sessions, three subagents under the acme-web session' },
  render: () => drawing({ body: dayTimeline(LANES.flatMap(columnsOf)) }),
});
