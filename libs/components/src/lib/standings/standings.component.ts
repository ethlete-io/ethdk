import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProvideColorDirective, mountVisuallyHidden } from '@ethlete/core';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { injectMatchLabels, MATCH_PARTICIPANT_IMPORTS, matchParticipantDisplayName } from '../match';
import { TOOLTIP_IMPORTS } from '../tooltip';
import { StandingsDirective } from './headless';
import { NormalizedStandingRow } from './standings.types';

/**
 * A league or group table: positions, the participants, played/won/drawn/lost, the points they rank by, and
 * recent form where the competition reports it. Driven by the headless {@link StandingsDirective}.
 *
 * It is a **real `<table>`** with a caption, column headers and a row header per position, because that is
 * what lets someone navigate it cell by cell and hear which column they are in. Zone bands (promotion,
 * relegation, advancing) come from a config that also draws the legend, so the two cannot drift apart.
 *
 * **Two densities, like the match card**: under 560px it keeps position, participant and points and drops
 * the rest - a table nobody can read sideways is worse than a table with fewer columns.
 *
 * @example
 * <et-standings [rows]="rows()" [zones]="zones" [highlightedRowId]="myTeamId()" />
 */
@Component({
  selector: 'et-standings',
  templateUrl: './standings.component.html',
  styleUrl: './standings.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MATCH_PARTICIPANT_IMPORTS,
    ProvideColorDirective,
    NgTemplateOutlet,
    IconDirective,
    RouterLink,
    TOOLTIP_IMPORTS,
  ],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: StandingsDirective,
      inputs: [
        'rows',
        'zones',
        'highlightedRowId',
        'showLegend',
        'labels',
        'expandedRows',
        'expandMode',
        'extraColumns',
        'participantLink',
      ],
      outputs: ['expandedRowsChange'],
    },
  ],
  host: {
    class: 'et-standings',
  },
})
export class StandingsComponent {
  protected standings = inject(StandingsDirective);

  private matchLabels = injectMatchLabels();

  protected labels = computed(() => this.standings.resolvedLabels());

  protected columnCount = computed(
    () =>
      8 +
      Number(this.standings.hasDifference()) +
      Number(this.standings.hasForm()) +
      this.standings.extraColumns().length,
  );

  constructor() {
    mountVisuallyHidden();
  }

  protected participantName(row: NormalizedStandingRow) {
    return matchParticipantDisplayName({ participant: row.participant, labels: this.matchLabels() });
  }

  protected toggleRow(event: Event, rowId: string) {
    event.stopPropagation();
    this.standings.toggleRow(rowId);
  }

  /** Signed, because a difference of `-4` and one of `4` are the two things this column exists to tell apart. */
  protected differenceText(difference: number | null) {
    if (difference === null) return '';

    return difference > 0 ? `+${difference}` : `${difference}`;
  }
}
