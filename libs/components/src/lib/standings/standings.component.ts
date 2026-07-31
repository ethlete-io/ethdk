import { Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { MATCH_PARTICIPANT_IMPORTS } from '../match';
import { StandingsDirective } from './headless';

/**
 * A league or group table: positions, the participants, played/won/drawn/lost, the points they rank by, and
 * recent form where the competition reports it. Driven by the headless {@link StandingsDirective}.
 *
 * It is a **real `<table>`** with a caption, column headers and a row header per position, because that is
 * what lets someone navigate it cell by cell and hear which column they are in. Zone bands (promotion,
 * relegation, advancing) come from a config that also draws the legend, so the two cannot drift apart.
 *
 * **Two densities, like the match card**: under 560px it keeps position, participant and points and drops
 * the rest — a table nobody can read sideways is worse than a table with fewer columns.
 *
 * @example
 * <et-standings [rows]="rows()" [zones]="zones" [highlightedRowId]="myTeamId()" />
 */
@Component({
  selector: 'et-standings',
  templateUrl: './standings.component.html',
  styleUrl: './standings.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_PARTICIPANT_IMPORTS, ProvideColorDirective],
  hostDirectives: [
    {
      directive: StandingsDirective,
      inputs: ['rows', 'zones', 'highlightedRowId', 'showLegend', 'labels'],
    },
  ],
  host: {
    class: 'et-standings',
  },
})
export class StandingsComponent {
  protected standings = inject(StandingsDirective);

  protected labels = computed(() => this.standings.resolvedLabels());

  /** Signed, because a difference of `-4` and one of `4` are the two things this column exists to tell apart. */
  protected differenceText(difference: number | null) {
    if (difference === null) return '';

    return difference > 0 ? `+${difference}` : `${difference}`;
  }
}
