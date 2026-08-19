import { afterNextRender, booleanAttribute, computed, Directive, input } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { injectStandingsLabels, StandingsLabels } from '../standings-labels';
import { STANDINGS_ERROR_CODES } from '../standings-errors';
import { NormalizedStandingRow, StandingsZone } from '../standings.types';

/** A row paired with whatever the config says about the position it sits in. */
export type StandingsRenderRow = {
  row: NormalizedStandingRow;
  /** The zone this position falls in, or `null` when it falls in none. */
  zone: StandingsZone | null;
  /** Whether this is the row the consumer asked to highlight. */
  isHighlighted: boolean;
};

/**
 * Headless standings: takes rows and zone bands and works out what each row means - which band it sits in,
 * whether it is the one to highlight - plus the strings the table announces.
 *
 * It imposes no markup. The default `et-standings` puts a real `<table>` around this; a consumer who wants
 * cards instead of rows can read the same state.
 */
@Directive({
  selector: '[etStandings]',
  exportAs: 'etStandings',
  host: {
    '[attr.data-has-zones]': 'zones().length ? "" : null',
  },
})
export class StandingsDirective {
  private hostElement = injectHostElement();

  private injectedLabels = injectStandingsLabels();

  /** The rows, in the order they should appear - this never re-sorts them. */
  public rows = input.required<readonly NormalizedStandingRow[]>();

  /**
   * Position bands that mean something (promotion, relegation, advancing). The same config draws the row
   * banding and the legend. @default []
   */
  public zones = input<readonly StandingsZone[]>([]);

  /** The `id` of the row to single out - "your team" in a table of twenty. */
  public highlightedRowId = input<string | null>(null);

  /** Draw the legend under the table. Off with no zones either way. @default true */
  public showLegend = input(true, { transform: booleanAttribute });

  /** Override this instance's strings - see {@link provideStandingsLabels} for the app-wide version. */
  public labels = input<Partial<StandingsLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<StandingsLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /** Every row with its zone and highlight state resolved - what a template iterates. */
  public renderRows = computed<StandingsRenderRow[]>(() => {
    const zones = this.zones();
    const highlightedRowId = this.highlightedRowId();

    return this.rows().map((row) => ({
      row,
      zone: zones.find((zone) => row.position >= zone.from && row.position <= zone.to) ?? null,
      isHighlighted: !!highlightedRowId && row.id === highlightedRowId,
    }));
  });

  /** The zones the legend lists - none of them when the legend is off. */
  public legendZones = computed(() => (this.showLegend() ? this.zones() : []));

  /** Whether any row reports form, since an empty column is worse than no column. */
  public hasForm = computed(() => this.rows().some((row) => !!row.form?.length));

  /** Whether any row reports a difference. */
  public hasDifference = computed(() => this.rows().some((row) => row.difference !== null));

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        const zones = this.zones();

        for (const [index, zone] of zones.entries()) {
          const overlapping = zones.find(
            (other, otherIndex) => otherIndex !== index && other.from <= zone.to && other.to >= zone.from,
          );

          if (!overlapping) continue;

          throw new RuntimeError(
            STANDINGS_ERROR_CODES.OVERLAPPING_ZONES,
            `[StandingsDirective] The zones "${zone.label}" (${zone.from}-${zone.to}) and "${overlapping.label}" ` +
              `(${overlapping.from}-${overlapping.to}) both cover a position, so a row would be in both. ` +
              'Give every zone its own range.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
