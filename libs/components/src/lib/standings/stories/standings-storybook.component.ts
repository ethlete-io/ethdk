import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { STANDINGS_IMPORTS } from '../standings.imports';
import { NormalizedStandingRow, StandingsZone } from '../standings.types';

@Component({
  selector: 'et-sb-standings',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-4">
        <p class="text-small m-0 opacity-60">
          A real table, with the zone bands and the legend coming from one config. Drag <code>width</code> down: at
          720px the form column goes, at 560px the rest of the detail columns do, and position, team and points stay - a
          table read sideways is worse than a table with fewer columns.
        </p>

        <div [style.inline-size]="boxWidth()">
          <et-standings
            [rows]="rows()"
            [zones]="zones()"
            [highlightedRowId]="highlight() ? 'neo' : null"
            [showLegend]="showLegend()"
          />
        </div>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_IMPORTS, ProvideSurfaceDirective],
})
export class StandingsStorybookComponent {
  public surface = input('dark');
  public width = input(760);
  public showLegend = input(true);
  public highlight = input(true);
  public withZones = input(true);
  public withForm = input(true);

  /** Caps at the viewport so a phone gets the collapsed table instead of a horizontal scrollbar. */
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);

  protected zones = computed<StandingsZone[]>(() =>
    this.withZones()
      ? [
          { from: 1, to: 2, color: 'success', label: 'Advances to the playoffs' },
          { from: 6, to: 6, color: 'danger', label: 'Relegated' },
        ]
      : [],
  );

  protected rows = computed<NormalizedStandingRow[]>(() =>
    STANDINGS_ROWS.map((row) => ({ ...row, form: this.withForm() ? row.form : null })),
  );
}

// Below the component on purpose: an interpolated template literal above an inline `template:` breaks the
// Angular language service inside it.
const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const participant = (config: { id: string; name: string; code: string; fill: string }) => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: null,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: null,
});

const STANDINGS_ROWS: NormalizedStandingRow[] = [
  {
    id: 'fcb',
    position: 1,
    participant: participant({ id: 'fcb', name: 'FC Berlin', code: 'FCB', fill: '#00ffa1' }),
    played: 10,
    wins: 8,
    ties: 1,
    losses: 1,
    points: 25,
    difference: 18,
    form: ['win', 'win', 'loss', 'win', 'win'],
  },
  {
    id: 'neo',
    position: 2,
    participant: participant({ id: 'neo', name: 'Neon Esports', code: 'NEO', fill: '#00d0ff' }),
    played: 10,
    wins: 7,
    ties: 2,
    losses: 1,
    points: 23,
    difference: 12,
    form: ['win', 'tie', 'win', 'win', 'tie'],
  },
  {
    id: 'rlp',
    position: 3,
    participant: participant({ id: 'rlp', name: 'Rote Löwen Pankow', code: 'RLP', fill: '#ffd000' }),
    played: 10,
    wins: 5,
    ties: 2,
    losses: 3,
    points: 17,
    difference: 4,
    form: ['loss', 'win', 'win', 'tie', 'loss'],
  },
  {
    id: 'haf',
    position: 4,
    participant: participant({ id: 'haf', name: 'Hafen United', code: 'HAF', fill: '#ff7a00' }),
    played: 10,
    wins: 4,
    ties: 1,
    losses: 5,
    points: 13,
    difference: -2,
    form: ['loss', 'loss', 'win', 'win', 'loss'],
  },
  {
    id: 'spr',
    position: 5,
    participant: participant({ id: 'spr', name: 'Spree Rangers', code: 'SPR', fill: '#7cff6b' }),
    played: 10,
    wins: 2,
    ties: 3,
    losses: 5,
    points: 9,
    difference: -9,
    form: ['tie', 'loss', 'loss', 'tie', 'loss'],
  },
  {
    id: 'alw',
    position: 6,
    participant: participant({ id: 'alw', name: 'Alpen Wölfe', code: 'ALW', fill: '#63e6ff' }),
    played: 10,
    wins: 1,
    ties: 1,
    losses: 8,
    points: 4,
    difference: -23,
    form: ['loss', 'loss', 'loss', 'win', 'loss'],
  },
];
