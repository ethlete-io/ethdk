import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';
import participantBase from '../src/lib/match/match-participant.component.css?inline';
import pickBase from '../src/lib/standings/standings-pick.component.css?inline';
import standingsBase from '../src/lib/standings/standings.component.css?inline';

export type StandingsMockFormResult = 'win' | 'tie' | 'loss';

export type StandingsMockRow = {
  position: number;
  name: string;
  played: number;
  wins: number;
  ties: number;
  losses: number;
  /** Left out, the table has no difference column unless another row has one. */
  difference?: number;
  points: number;
  /** Oldest first. Left out on every row, the table has no form column. */
  form?: readonly StandingsMockFormResult[];
};

export type StandingsMockZone = {
  from: number;
  to: number;
  label: string;
  /** A color theme name the app registers. Left out, the zone takes the color theme around the table. */
  color?: string;
};

export type StandingsMockOptions = {
  rows: readonly StandingsMockRow[];
  zones?: readonly StandingsMockZone[];
  /** The position of the highlighted (own) row. */
  highlighted?: number;
  showLegend?: boolean;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

export type StandingsPickMockRow = {
  name: string;
  /** The consumer's mark template content, as HTML, drawn only while locked. */
  mark?: string;
  /** A design marker for the reorder handle, e.g. `hover` or `focus-visible`. */
  handleForce?: string;
};

export type StandingsPickMockOptions = {
  rows: readonly StandingsPickMockRow[];
  advancingCount: number;
  locked?: boolean;
  /** The index of the card being dragged, and its offset from the slot in px. */
  dragging?: { index: number; offset: number };
  /** Per index, the preview offset in px the other cards slide by while a drag runs. */
  shifts?: readonly number[];
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets the standings mocks draw with: the real standings, standings pick, match participant and focus ring CSS. */
export const standingsStyles = /* @__PURE__ */ [focusRing, participantBase, standingsBase, pickBase].join('\n');

const forced = (force: string | undefined) => (force ? ` data-et-force="${force}"` : '');

const colored = (color: string | undefined) => (color ? ` et-color--${color}` : '');

const participant = (name: string, className: string) =>
  `<et-match-participant class="et-match-participant ${className}"><span class="et-match-participant-emblem"><span data-mark="${(Array.from(name.trim())[0] ?? '').toUpperCase()}" class="et-match-participant-emblem-mark" aria-hidden="true"></span></span><span class="et-match-participant-names"><span class="et-match-participant-name">${name}</span></span></et-match-participant>`;

const differenceText = (difference: number | undefined) =>
  difference === undefined ? '' : difference > 0 ? `+${difference}` : `${difference}`;

const FORM_SHORT = { win: 'W', tie: 'D', loss: 'L' } as const;

const headCell = (column: string, label: string) =>
  `<th class="et-standings-cell" data-column="${column}" scope="col">${label}</th>`;

/** Draws an `et-standings` table with its zone bands, highlighted row and legend, as HTML. */
export const standings = (options: StandingsMockOptions) => {
  const zones = options.zones ?? [];
  const hasDifference = options.rows.some((row) => row.difference !== undefined);
  const hasForm = options.rows.some((row) => row.form);
  const zoneOf = (position: number) => zones.find((zone) => position >= zone.from && position <= zone.to);

  const head = [
    headCell('position', '#'),
    headCell('participant', 'Team'),
    ...['P', 'W', 'D', 'L'].map((label) => headCell('detail', label)),
    hasDifference ? headCell('detail', 'Diff') : '',
    headCell('points', 'Pts'),
    hasForm ? headCell('form', 'Form') : '',
  ].join('');

  const body = options.rows
    .map((row) => {
      const zone = zoneOf(row.position);
      const highlighted = row.position === options.highlighted;
      const attributes = [
        zone ? ' data-zone=""' : '',
        highlighted ? ' data-highlighted="" aria-current="true"' : '',
      ].join('');
      const form = row.form
        ? `<span class="et-standings-form">${row.form.map((result) => `<span data-result="${result}" class="et-standings-form-result" aria-hidden="true">${FORM_SHORT[result]}</span>`).join('')}</span>`
        : '';

      return [
        `<tr class="et-standings-row${colored(zone?.color)}"${attributes}>`,
        `<th class="et-standings-cell" data-column="position" scope="row">${row.position}</th>`,
        `<td class="et-standings-cell" data-column="participant">${participant(row.name, 'et-standings-participant')}</td>`,
        ...[row.played, row.wins, row.ties, row.losses].map(
          (value) => `<td class="et-standings-cell" data-column="detail">${value}</td>`,
        ),
        hasDifference
          ? `<td class="et-standings-cell" data-column="detail">${differenceText(row.difference)}</td>`
          : '',
        `<td class="et-standings-cell" data-column="points">${row.points}</td>`,
        hasForm ? `<td class="et-standings-cell" data-column="form">${form}</td>` : '',
        `</tr>`,
      ].join('');
    })
    .join('');

  const legend =
    options.showLegend && zones.length
      ? `<ul aria-label="What the highlighted positions mean" class="et-standings-legend">${zones.map((zone) => `<li class="et-standings-legend-item"><span class="et-standings-legend-swatch${colored(zone.color)}" aria-hidden="true"></span>${zone.label}</li>`).join('')}</ul>`
      : '';

  return `<et-standings class="et-standings"${zones.length ? ' data-has-zones=""' : ''} ${options.attributes ?? ''}><div class="et-standings-content"><table class="et-standings-table"><thead><tr class="et-standings-head-row">${head}</tr></thead><tbody>${body}</tbody></table>${legend}</div></et-standings>`;
};

/** Draws an `et-standings-pick` list with its cut line, at rest, mid-drag or locked with marks, as HTML. */
export const standingsPick = (options: StandingsPickMockOptions) => {
  const items = options.rows
    .map((row, index) => {
      const advancing = index < options.advancingCount;
      const dragging = options.dragging?.index === index;
      const offset = dragging ? options.dragging?.offset : options.shifts?.[index];
      const translate = offset ? ` style="translate: 0 ${offset}px"` : '';
      const mark = options.locked && row.mark ? `<span class="et-standings-pick-mark">${row.mark}</span>` : '';
      const handle = options.locked
        ? ''
        : `<button aria-label="Move ${row.name}, position ${index + 1}" class="et-standings-pick-handle et-focus-ring" type="button"${forced(row.handleForce)}><span class="et-standings-pick-grip" aria-hidden="true"></span></button>`;
      const cut =
        index === options.advancingCount - 1
          ? `<p class="et-standings-pick-cut" aria-hidden="true"><span class="et-standings-pick-cut-line"></span><span class="et-standings-pick-cut-label">Advancing</span><span class="et-standings-pick-cut-line"></span></p>`
          : '';

      return [
        `<li class="et-standings-pick-item"${advancing ? ' data-advancing=""' : ''}>`,
        `<div class="et-standings-pick-row"><span class="et-standings-pick-position">${index + 1}</span>`,
        `<div class="et-standings-pick-card"${dragging ? ' data-dragging=""' : ''}${translate}>`,
        participant(row.name, 'et-standings-pick-participant'),
        mark,
        handle,
        `</div></div>${cut}</li>`,
      ].join('');
    })
    .join('');

  return `<et-standings-pick class="et-standings-pick"${options.locked ? ' data-locked=""' : ''} ${options.attributes ?? ''}><ol aria-label="Your predicted order" class="et-standings-pick-list"${options.dragging ? ' data-dragging=""' : ''}>${items}</ol></et-standings-pick>`;
};
