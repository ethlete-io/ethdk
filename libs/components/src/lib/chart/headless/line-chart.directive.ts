import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  injectSurfaceColorPalette,
  injectHostElement,
  injectLocale,
  RegisteredColorThemeName,
  RuntimeError,
} from '@ethlete/core';
import { filter, fromEvent, merge, tap } from 'rxjs';
import { ChartAxisLabel, ChartLegendItem, ChartRect, ChartTableModel, ChartTick } from '../chart.types';
import { injectReportError } from '../../internals/report-error';
import { LINE_CHART_ERROR_CODES } from '../line-chart-errors';
import { CHART_PLOT_HOST, ChartPlotDirective, ChartPlotHost } from './chart-plot.directive';
import { ChartValueFormatter, resolveChartValueFormatter } from './internals/chart-format';
import {
  bandEnds,
  bandExtent,
  createAreaPath,
  createLinePath,
  createSeriesBands,
  createSliceBounds,
  findNearestIndex,
  splitLineSegments,
} from './internals/chart-line';
import { assertChartPlot } from './internals/chart-plot-check';
import { createFittedValueTicks, createLinearScale, createValueTicks, numberExtent } from './internals/chart-scale';
import {
  describeSeriesDataMismatch,
  findSharedSeriesColor,
  resolveChartAccentMixes,
  resolveChartSeriesColors,
} from './internals/chart-series';
import {
  createTimeTicks,
  createTimeValueFormatter,
  isValidTimeZone,
  viewerTimeZone,
} from './internals/chart-time-scale';

/** Where a point sits along the x axis: a category name, or an instant on a time axis. */
export type LineChartX = string | Date;

/** One point of a single-series chart. A `null` or missing value breaks the line. */
export type LineChartDatum = {
  x: LineChartX;
  value: number | null | undefined;
};

/** One x of a multi-series chart: a value per series `key`. A `null` or missing value breaks that series' line. */
export type LineChartSeriesDatum = {
  x: LineChartX;
  values: Readonly<Record<string, number | null | undefined>>;
};

/** A series of a multi-series chart. Its values are read from each datum's `values[key]`. */
export type LineChartSeries = {
  key: string;
  /** Names the series in the legend, the tooltip, the description and the table header. */
  label: string;
  /** The color theme the series is drawn in. @default the palette entry at the series' position, else a step of the accent */
  colorToken?: RegisteredColorThemeName | null;
};

/** Formats a value for the axis, the tooltip and the table. */
export type LineChartValueFormatter = ChartValueFormatter;

/** Formats an instant of a time axis for the tooltip, the accessible names and the table. */
export type LineChartDateFormatter = (date: Date) => string;

/** A value-axis tick. `y` is its offset from the top of the plot. */
export type LineChartTick = ChartTick & {
  y: number;
};

/** A point of a line, in plot pixels. */
export type LineChartPoint = {
  key: string;
  x: number;
  y: number;
  /** Whether the point has no defined neighbour, so no line segment shows it. Draw it as a dot. */
  isIsolated: boolean;
};

/** One series' marks, ready to render. */
export type LineChartLine = {
  key: string;
  seriesIndex: number;
  /** The series; `null` in a single-series chart. */
  series: LineChartSeries | null;
  /** The color theme the series is drawn in; `null` takes the surrounding accent at `accentMix`. */
  colorToken: RegisteredColorThemeName | null;
  /** How much of the accent a series without a color theme is mixed with the surface, in percent; `null` for a series with one or in a single-series chart. */
  accentMix: number | null;
  /** The line through every run of defined points. Missing values leave a gap. */
  linePath: string;
  /** The fill between the line and the baseline - or the series below, when stacked. */
  areaPath: string;
  points: LineChartPoint[];
};

/** One series' value at a slice's x. */
export type LineChartSliceEntry = {
  key: string;
  series: LineChartSeries | null;
  colorToken: RegisteredColorThemeName | null;
  accentMix: number | null;
  value: number;
  valueText: string;
  /** The point's offset from the top of the plot. */
  y: number;
};

/** Everything the chart shows at one x: the hover, tap and focus target that reads out every series. */
export type LineChartSlice = {
  key: string;
  index: number;
  /** The x, as given in `data`. */
  x: LineChartX;
  /** The x's offset from the left of the plot. */
  position: number;
  /** The x as text, e.g. `"Mar 3, 2025"` or the category. */
  label: string;
  /** The series with a value at this x, in series order. */
  entries: LineChartSliceEntry[];
  /** The hover, tap and focus target: the stretch of the plot closer to this x than to its neighbours. */
  target: ChartRect;
  /** A zero-size rect at the topmost point, for the tooltip to point at. */
  anchor: ChartRect;
  /** The values as text, e.g. `"Online 1,210, Box office 450"`. */
  description: string;
};

type NormalizedRow = {
  x: LineChartX;
  time: number | null;
  values: (number | null)[];
};

const TIME_TICK_SPACING = 72;
const CATEGORY_LABEL_SPACING = 48;
const EMPTY_DESCRIPTION = '–';

const finiteOrNull = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Headless line chart: turns `data` into line and area paths, value-axis ticks, x-axis labels, one
 * slice per x that reads out every series, legend entries and the strings a table view needs. `Date`
 * x values get a time axis; strings get evenly spaced categories. The element marked `etChartPlot`
 * reports the width the x axis spans; each `etLineChartSlice` element is a hover, tap and arrow-key
 * target.
 *
 * @example
 * <div etLineChart [data]="data" label="Visitors per day">
 *   <div etChartPlot><svg>…</svg></div>
 * </div>
 */
@Directive({
  selector: '[etLineChart]',
  exportAs: 'etLineChart',
  providers: [{ provide: CHART_PLOT_HOST, useExisting: LineChartDirective }],
})
export class LineChartDirective implements ChartPlotHost {
  private palette = injectSurfaceColorPalette();
  private locale = injectLocale();
  private hostElement = injectHostElement();
  private destroyRef = inject(DestroyRef);
  private reportError = injectReportError();

  /**
   * The points, in order. `{ x, value }` per point for one series; with `series`, `{ x, values }`
   * holding a value per series key. `Date` x values are sorted by time.
   */
  public data = input.required<readonly LineChartDatum[] | readonly LineChartSeriesDatum[]>();

  /** The series to draw from each datum's `values`. Empty draws one series from each datum's `value`. @default [] */
  public series = input<readonly LineChartSeries[]>([]);

  /** Names the chart for assistive tech and captions its table view. */
  public label = input.required<string>();

  /** Fills the space under each line. @default false */
  public area = input(false, { transform: booleanAttribute });

  /** Stacks the series on each other - positives up, negatives down - instead of drawing each from zero. @default false */
  public stacked = input(false, { transform: booleanAttribute });

  /**
   * Whether the value axis includes zero. `false` fits the axis to the data. An area always includes
   * zero, since it fills down to the baseline. @default true
   */
  public includeZero = input(true, { transform: booleanAttribute });

  /** Draws a dot at every point, not only at points no line segment shows. @default false */
  public points = input(false, { transform: booleanAttribute });

  /** Height of the plot area in px, excluding the axis labels. @default 240 */
  public height = input(240, { transform: numberAttribute });

  /** Roughly how many value-axis intervals to draw; the axis rounds to a clean 1, 2 or 5 step. @default 5 */
  public tickCount = input(5, { transform: numberAttribute });

  /** Formats values for the axis, the tooltip and the table. @default the app locale's number format */
  public valueFormatter = input<LineChartValueFormatter | null>(null);

  /**
   * Formats a time axis' instants for the tooltip, the accessible names and the table. Axis ticks keep
   * their own format. @default the app locale's date, with the time when an instant is not a midnight
   */
  public dateFormatter = input<LineChartDateFormatter | null>(null);

  /** The IANA time zone a time axis is laid out and labelled in. @default the viewer's time zone */
  public timeZone = input<string | null>(null);

  /** The table view's x column header. Wins over `categoryHeader` and `dateHeader`. @default null */
  public xHeader = input<string | null>(null);

  /** The table view's x column header on a category axis, while `xHeader` is `null`. @default 'Category' */
  public categoryHeader = input('Category');

  /** The table view's x column header on a time axis, while `xHeader` is `null`. @default 'Date' */
  public dateHeader = input('Date');

  /** The table view's value column header in a single-series chart. @default 'Value' */
  public valueHeader = input('Value');

  public formatValue = computed(() => resolveChartValueFormatter(this.valueFormatter(), this.locale.currentLocale()));

  /**
   * The element the chart is laid out in. Set by `etChartPlot`.
   *
   * @internal
   */
  public plot = signal<ChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  /** Whether the x values are instants, laid out on a time axis. */
  public isTime = computed(() => {
    const data = this.data();

    return data.length > 0 && data.every((datum) => datum.x instanceof Date);
  });

  public isStacked = computed(() => this.stacked() && this.series().length > 1);

  /** The color theme per entry of `series`, resolved against the palette. */
  public seriesColors = computed(() => resolveChartSeriesColors(this.series(), this.palette()));

  /** The accent mix per entry of `series`, in percent; `null` for a series with a color theme. */
  public seriesAccentMixes = computed(() => resolveChartAccentMixes(this.seriesColors()));

  /** The legend entries - one per series when there are two or more, else none. */
  public legendItems = computed<ChartLegendItem[]>(() => {
    const series = this.series();
    const colors = this.seriesColors();
    const mixes = this.seriesAccentMixes();

    if (series.length < 2) return [];

    return series.map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      colorToken: colors[index] ?? null,
      accentMix: mixes[index] ?? null,
    }));
  });

  private requestedTabStop = signal(0);
  private skipShowDelay = signal(false);

  /** @internal */
  public skipsShowDelay = this.skipShowDelay.asReadonly();
  private sliceHandles = new Set<LineChartSliceHandle>();

  private isValidTimeZone = computed(() => {
    const timeZone = this.timeZone();

    return timeZone === null || isValidTimeZone(timeZone);
  });

  private resolvedTimeZone = computed(() => {
    const timeZone = this.timeZone();

    return timeZone !== null && this.isValidTimeZone() ? timeZone : viewerTimeZone();
  });

  private hasMixedX = computed(() => !this.isTime() && this.data().some((datum) => datum.x instanceof Date));

  private rows = computed<NormalizedRow[]>(() => {
    if (this.hasMixedX()) return [];

    const series = this.series();
    const isTime = this.isTime();

    const rows = series.length
      ? (this.data() as readonly LineChartSeriesDatum[]).map((datum) => ({
          x: datum.x,
          values: series.map((entry) => finiteOrNull(datum.values?.[entry.key])),
        }))
      : (this.data() as readonly LineChartDatum[]).map((datum) => ({
          x: datum.x,
          values: [finiteOrNull(datum.value)],
        }));

    const normalized = rows.map((row) => ({ ...row, time: isTime ? (row.x as Date).getTime() : null }));

    return isTime
      ? normalized.filter((row) => Number.isFinite(row.time)).sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
      : normalized;
  });

  /** The index of the slice that takes the chart's one tab stop. */
  public tabStopIndex = computed(() => Math.min(this.requestedTabStop(), Math.max(0, this.rows().length - 1)));

  private bands = computed(() =>
    createSeriesBands({
      rows: this.rows().map((row) => row.values),
      seriesCount: Math.max(1, this.series().length),
      stacked: this.isStacked(),
    }),
  );

  private fitsDataWithoutZero = computed(() => !this.includeZero() && !this.area());

  public valueTicks = computed(() =>
    this.fitsDataWithoutZero()
      ? createFittedValueTicks(bandEnds(this.bands()), this.tickCount())
      : createValueTicks(bandExtent(this.bands()), this.tickCount()),
  );

  private valueScale = computed(() => createLinearScale(this.valueTicks().domain, [this.height(), 0]));

  /** The zero line's offset from the top of the plot; the domain edge nearest zero when zero is outside the value axis. */
  public baseline = computed(() => {
    const [min, max] = this.valueTicks().domain;

    return this.valueScale()(Math.min(Math.max(0, min), max));
  });

  public ticks = computed<LineChartTick[]>(() => {
    const scale = this.valueScale();
    const format = this.formatValue();

    return this.valueTicks().ticks.map((value) => {
      const position = scale(value);

      return { value, text: format(value), position, y: position };
    });
  });

  /** The value-axis labels, at their ticks. */
  public valueLabels = computed<ChartAxisLabel[]>(() =>
    this.ticks().map((tick) => ({ key: tick.value, text: tick.text, position: tick.position })),
  );

  private timeDomain = computed(() => numberExtent(this.rows().map((row) => row.time ?? 0)));

  /** Each x's offset from the left of the plot, in `data` order (time order on a time axis). */
  public positions = computed<number[]>(() => {
    const rows = this.rows();
    const width = this.plotWidth();

    if (!this.isTime()) {
      const step = rows.length ? width / rows.length : 0;

      return rows.map((_, index) => index * step + step / 2);
    }

    const domain = this.timeDomain();

    if (domain[0] === domain[1]) return rows.map(() => width / 2);

    const scale = createLinearScale(domain, [0, width]);

    return rows.map((row) => scale(row.time ?? 0));
  });

  private formatX = computed<(row: NormalizedRow) => string>(() => {
    if (!this.isTime()) return (row) => String(row.x);

    const custom = this.dateFormatter();

    if (custom) return (row) => custom(row.x as Date);

    const format = createTimeValueFormatter({
      instants: this.rows().map((row) => row.time ?? 0),
      timeZone: this.resolvedTimeZone(),
      locale: this.locale.currentLocale(),
    });

    return (row) => format(row.time ?? 0);
  });

  /** The x-axis labels: time ticks on a time axis, else every category that has room. */
  public xLabels = computed<ChartAxisLabel[]>(() => {
    const width = this.plotWidth();

    if (this.isTime()) {
      const domain = this.timeDomain();

      if (domain[0] === domain[1]) {
        const row = this.rows()[0];

        return row ? [{ key: 0, text: this.formatX()(row), position: width / 2 }] : [];
      }

      const scale = createLinearScale(domain, [0, width]);
      const { ticks } = createTimeTicks({
        domain,
        count: Math.max(2, Math.round(width / TIME_TICK_SPACING)),
        timeZone: this.resolvedTimeZone(),
        locale: this.locale.currentLocale(),
      });

      return ticks.map((tick) => ({ key: tick.value, text: tick.text, position: scale(tick.value) }));
    }

    const rows = this.rows();
    const positions = this.positions();
    const step = rows.length ? width / rows.length : 0;
    const stride = step > 0 ? Math.max(1, Math.ceil(CATEGORY_LABEL_SPACING / step)) : 1;
    const format = this.formatX();

    return rows.flatMap((row, index) =>
      index % stride ? [] : [{ key: index, text: format(row), position: positions[index] ?? 0, extent: step * stride }],
    );
  });

  public lines = computed<LineChartLine[]>(() => {
    const series = this.series();
    const colors = this.seriesColors();
    const mixes = this.seriesAccentMixes();
    const positions = this.positions();
    const scale = this.valueScale();

    return this.bands().map((bands, seriesIndex) => {
      const entry = series[seriesIndex] ?? null;
      const key = entry?.key ?? '';
      const coords = bands.map((band, index) =>
        band ? { x: positions[index] ?? 0, y0: scale(band.start), y1: scale(band.end), index } : null,
      );
      const segments = splitLineSegments(coords);

      return {
        key,
        seriesIndex,
        series: entry,
        colorToken: entry ? (colors[seriesIndex] ?? null) : null,
        accentMix: entry ? (mixes[seriesIndex] ?? null) : null,
        linePath: createLinePath(segments.map((segment) => segment.map((point) => ({ x: point.x, y: point.y1 })))),
        areaPath: createAreaPath(segments),
        points: segments.flatMap((segment) =>
          segment.map((point) => ({
            key: `${point.index}:${key}`,
            x: point.x,
            y: point.y1,
            isIsolated: segment.length === 1,
          })),
        ),
      };
    });
  });

  public slices = computed<LineChartSlice[]>(() => {
    const rows = this.rows();
    const series = this.series();
    const colors = this.seriesColors();
    const mixes = this.seriesAccentMixes();
    const positions = this.positions();
    const bounds = createSliceBounds(positions, this.plotWidth());
    const scale = this.valueScale();
    const bands = this.bands();
    const format = this.formatValue();
    const formatX = this.formatX();
    const height = this.height();
    const multi = series.length > 1;

    return rows.map((row, index) => {
      const entries = row.values.flatMap((value, seriesIndex): LineChartSliceEntry[] => {
        const band = bands[seriesIndex]?.[index];

        if (value === null || !band) return [];

        const entry = series[seriesIndex] ?? null;

        return [
          {
            key: entry?.key ?? '',
            series: entry,
            colorToken: entry ? (colors[seriesIndex] ?? null) : null,
            accentMix: entry ? (mixes[seriesIndex] ?? null) : null,
            value,
            valueText: format(value),
            y: scale(band.end),
          },
        ];
      });
      const position = positions[index] ?? 0;
      const bound = bounds[index] ?? { start: 0, width: 0 };
      const top = entries.length ? Math.min(...entries.map((entry) => entry.y)) : 0;
      const description = entries.length
        ? entries
            .map((entry) => (multi && entry.series ? `${entry.series.label} ${entry.valueText}` : entry.valueText))
            .join(', ')
        : EMPTY_DESCRIPTION;

      return {
        key: `${index}:${row.time === null ? String(row.x) : row.time}`,
        index,
        x: row.x,
        position,
        label: formatX(row),
        entries,
        target: { x: bound.start, y: 0, width: bound.width, height },
        anchor: { x: position, y: top, width: 0, height: 0 },
        description,
      };
    });
  });

  /** The data as a table: a row per x, a column per series. */
  public table = computed<ChartTableModel>(() => {
    const series = this.series();
    const format = this.formatValue();
    const formatX = this.formatX();
    const xHeader = this.xHeader() ?? (this.isTime() ? this.dateHeader() : this.categoryHeader());

    return {
      columns: [xHeader, ...(series.length ? series.map((entry) => entry.label) : [this.valueHeader()])],
      rows: this.rows().map((row) => ({
        header: formatX(row),
        cells: row.values.map((value) => (value === null ? '' : format(value))),
      })),
    };
  });

  constructor() {
    assertChartPlot(this, 'LineChartDirective');

    fromEvent<PointerEvent>(this.hostElement, 'pointermove')
      .pipe(
        filter((event) => event.pointerType === 'touch'),
        tap((event) => this.showSliceAt(event.clientX)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    merge(fromEvent(this.hostElement, 'pointerenter'), fromEvent(this.hostElement, 'pointerleave'))
      .pipe(
        tap(() => this.skipShowDelay.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    if (ngDevMode) {
      effect(() => {
        const mismatch = describeSeriesDataMismatch(this.data(), this.series());

        if (mismatch !== null) console.warn(`[LineChartDirective] ${mismatch}`);
      });

      effect(() => {
        if (!this.hasMixedX()) return;

        this.reportError(
          new RuntimeError(
            LINE_CHART_ERROR_CODES.MIXED_X_TYPES,
            '[LineChartDirective] The data mixes Date and string x values. ' +
              'Give every datum a Date for a time axis, or a string for categories.',
          ),
        );
      });

      effect(() => {
        if (this.isValidTimeZone()) return;

        this.reportError(
          new RuntimeError(
            LINE_CHART_ERROR_CODES.INVALID_TIME_ZONE,
            `[LineChartDirective] The timeZone input "${this.timeZone()}" is not an IANA time zone. ` +
              'The chart falls back to the viewer time zone.',
          ),
        );
      });

      effect(() => {
        if (this.includeZero() || !this.area()) return;

        console.warn(
          '[LineChartDirective] includeZero is false on an area chart. An area fills down to zero, so the value ' +
            'axis keeps zero. Drop area, or drop includeZero.',
        );
      });

      effect(() => {
        const shared = findSharedSeriesColor(this.seriesColors());

        if (shared !== null) {
          console.warn(
            `[LineChartDirective] Two or more series share the colorToken "${shared}". Give each series its own ` +
              'colorToken or provide a palette with provideColorPalette().',
          );
        }
      });
    }
  }

  /** @internal */
  public registerSlice(slice: LineChartSliceHandle) {
    this.sliceHandles.add(slice);

    return () => this.sliceHandles.delete(slice);
  }

  /** @internal */
  public setSkipsShowDelay(skips: boolean) {
    this.skipShowDelay.set(skips);
  }

  /** @internal */
  public markTabStop(index: number) {
    this.requestedTabStop.set(index);
  }

  /** Moves focus to the slice at `index`, clamped to the first and last. */
  public focusSlice(index: number) {
    const last = this.rows().length - 1;
    const target = Math.max(0, Math.min(last, index));

    this.requestedTabStop.set(target);

    for (const slice of this.sliceHandles) {
      if (slice.index() === target) slice.focus();
    }
  }

  private showSliceAt(clientX: number) {
    const plot = this.plot();

    if (!plot || !this.sliceHandles.size) return;

    const index = findNearestIndex(this.positions(), clientX - plot.element.getBoundingClientRect().left);

    for (const slice of this.sliceHandles) {
      if (slice.index() === index) slice.showTooltip();
      else slice.hideTooltip();
    }
  }
}

/** @internal */
export type LineChartSliceHandle = {
  element: Element;
  index: () => number;
  focus: () => void;
  showTooltip: () => void;
  hideTooltip: () => void;
};
