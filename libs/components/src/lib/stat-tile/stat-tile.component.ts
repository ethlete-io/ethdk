import { booleanAttribute, Component, computed, inject, Injector, input, ViewEncapsulation } from '@angular/core';
import { injectLocale, mountVisuallyHidden, ProvideColorDirective } from '@ethlete/core';
import { injectSemanticTheme } from '../internals/semantic-theme';
import { SkeletonComponent, SkeletonItemComponent } from '../skeleton';
import { formatStatTileNumber, statTileDirection, statTileSentiment } from './stat-tile-format';
import { injectStatTileLabels } from './stat-tile-labels';
import { StatTileFormat, StatTileGoodDirection } from './stat-tile.types';

/**
 * A single headline number with its label, an optional signed delta and an optional trend - the form a value
 * takes when the number is the chart. Chrome is not included: put it in an `et-card`, or a row of them.
 *
 * @example
 * <et-stat-tile label="Revenue" [value]="4210000" [delta]="0.124" [deltaFormat]="{ style: 'percent' }" caption="vs last month">
 *   <et-stat-tile-sparkline [values]="trend" />
 * </et-stat-tile>
 */
@Component({
  selector: 'et-stat-tile',
  templateUrl: './stat-tile.component.html',
  styleUrl: './stat-tile.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, SkeletonComponent, SkeletonItemComponent],
  host: {
    class: 'et-stat-tile',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class StatTileComponent {
  private injector = inject(Injector);
  private locale = injectLocale();

  protected labels = injectStatTileLabels();

  public label = input.required<string>();

  /** A number is formatted with `format`; a string is shown as given. `null` shows a dash. */
  public value = input.required<number | string | null>();

  /** How a numeric value is formatted. @default compact from 10,000 (`12.9K`), one fraction digit */
  public format = input<StatTileFormat | null>(null);

  /** Shown after the value, smaller - `ms`, `users`. */
  public unit = input<string | null>(null);

  /** The signed change against the period `caption` names. Its sign decides the direction. */
  public delta = input<number | null>(null);

  /** How the delta is formatted. Intl options keep the `+`/`-` sign unless they set `signDisplay`. @default like `format` */
  public deltaFormat = input<StatTileFormat | null>(null);

  /** Which direction is good, for the success or error colour. `null` leaves every delta neutral. @default 'up' */
  public goodDirection = input<StatTileGoodDirection | null>('up');

  /** The comparison the delta is measured against, or any short context line - `vs last month`. */
  public caption = input<string | null>(null);

  /** Replaces the value and delta with a skeleton. The label stays. */
  public loading = input(false, { transform: booleanAttribute });

  protected formattedValue = computed(() => {
    const value = this.value();

    if (value === null) return null;
    if (typeof value === 'string') return value;

    return formatStatTileNumber(value, { format: this.format(), locale: this.locale.currentLocale() });
  });

  protected deltaView = computed(() => {
    const delta = this.delta();

    if (delta === null || !Number.isFinite(delta)) return null;

    const direction = statTileDirection(delta);
    const sentiment = statTileSentiment(direction, this.goodDirection());
    const text = formatStatTileNumber(delta, {
      format: this.deltaFormat() ?? this.format(),
      locale: this.locale.currentLocale(),
      defaults: { signDisplay: 'exceptZero' },
    });

    return { direction, sentiment, text };
  });

  protected deltaTheme = computed(() => {
    const sentiment = this.deltaView()?.sentiment;

    if (!sentiment || sentiment === 'neutral') return undefined;

    return injectSemanticTheme(this.injector, sentiment === 'good' ? 'success' : 'error');
  });

  protected directionLabel = computed(() => {
    const labels = this.labels();
    const direction = this.deltaView()?.direction;

    if (direction === 'up') return labels.up;
    if (direction === 'down') return labels.down;

    return labels.unchanged;
  });

  constructor() {
    mountVisuallyHidden();
  }
}
