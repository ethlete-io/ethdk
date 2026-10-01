import { Component, Directive, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  BarChartComponent,
  BarChartDirective,
  BarChartPlotDirective,
  BarChartSeries,
  BarChartSeriesDatum,
  CHART_ERROR_CODES,
  CHART_IMPORTS,
  CHART_PLOT_HOST,
  ChartPlotDirective,
  ChartPlotHost,
  LINE_CHART_ERROR_CODES,
  LineChartComponent,
  LineChartDatum,
  LineChartDirective,
  LineChartSliceDirective,
  PIE_CHART_ERROR_CODES,
  PieChartComponent,
  PieChartDatum,
  PieChartDirective,
  provideOverlay,
  SANKEY_CHART_ERROR_CODES,
  SankeyChartComponent,
  SankeyChartDirective,
  SankeyChartLinkInput,
  SankeyChartNodeInput,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import { fakeLayout } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const PLOT_WIDTH = 400;

const SERIES: BarChartSeries[] = [
  { key: 'home', label: 'Home', colorToken: 'sunshine' },
  { key: 'away', label: 'Away', colorToken: 'red' },
];

@Component({
  selector: 'et-scenario-goals-chart',
  imports: [BarChartComponent],
  template: `
    <et-bar-chart
      [data]="goals()"
      [series]="series"
      [layout]="layout()"
      [valueFormatter]="asGoals"
      [height]="200"
      categoryHeader="Month"
      label="Goals per month"
    />
  `,
})
class GoalsChartComponent {
  series = SERIES;
  layout = signal<'grouped' | 'stacked'>('grouped');
  goals = signal<BarChartSeriesDatum[]>([
    { label: 'Jan', values: { home: 3, away: 1 } },
    { label: 'Feb', values: { home: 5, away: null } },
    { label: 'Mar', values: { home: 2, away: 4 } },
  ]);
  asGoals = (value: number) => `${value} goals`;
}

@Component({
  selector: 'et-scenario-attendance-chart',
  imports: [LineChartComponent],
  template: `<et-line-chart [data]="attendance()" [height]="160" label="Attendance" valueHeader="Fans" points />`,
})
class AttendanceChartComponent {
  attendance = signal<LineChartDatum[]>([
    { x: 'Round 1', value: 1200 },
    { x: 'Round 2', value: 1500 },
    { x: 'Round 3', value: null },
    { x: 'Round 4', value: 900 },
  ]);
}

@Component({
  selector: 'et-scenario-mixed-line',
  imports: [LineChartComponent],
  template: `<et-line-chart [data]="data" label="Mixed" />`,
})
class MixedLineComponent {
  data = [
    { x: 'Round 1', value: 1 },
    { x: new Date(2026, 0, 1), value: 2 },
  ] as LineChartDatum[];
}

@Component({
  selector: 'et-scenario-results-pie',
  imports: [PieChartComponent],
  template: `
    <et-pie-chart [data]="results()" [innerRadius]="40" label="Results" showTotal totalLabel="Matches">
      <span class="season" etPieChartCenter>2026</span>
    </et-pie-chart>
  `,
})
class ResultsPieComponent {
  results = signal<PieChartDatum[]>([
    { label: 'Wins', value: 6, colorToken: 'sunshine' },
    { label: 'Draws', value: 2, colorToken: 'default' },
    { label: 'Losses', value: 2, colorToken: 'red' },
  ]);
}

@Component({
  selector: 'et-scenario-transfer-flow',
  imports: [SankeyChartComponent],
  template: `<et-sankey-chart [nodes]="nodes()" [links]="links()" [height]="240" label="Transfers" />`,
})
class TransferFlowComponent {
  nodes = signal<SankeyChartNodeInput[]>([
    { id: 'academy', label: 'Academy', colorToken: 'sunshine' },
    { id: 'team-a', label: 'Team A', colorToken: 'default' },
    { id: 'team-b', label: 'Team B', colorToken: 'red' },
  ]);
  links = signal<SankeyChartLinkInput[]>([
    { source: 'academy', target: 'team-a', value: 8 },
    { source: 'academy', target: 'team-b', value: 3 },
  ]);
}

@Component({
  selector: 'et-scenario-own-bars',
  imports: [CHART_IMPORTS],
  template: `
    <figure #chart="etBarChart" [data]="data" [height]="100" etBarChart label="Points">
      <div class="own-plot" etBarChartPlot>
        @for (bar of chart.bars(); track bar.key) {
          <span [style.inline-size.px]="bar.width" class="own-bar">{{ bar.name }}={{ bar.valueText }}</span>
        }
      </div>
    </figure>
  `,
})
class OwnBarsComponent {
  chart = viewChild.required(BarChartDirective);
  plot = viewChild.required(BarChartPlotDirective);
  data = [
    { label: 'Team A', value: 30 },
    { label: 'Team B', value: 10 },
  ];
}

@Component({
  selector: 'et-scenario-own-lines',
  imports: [LineChartDirective, LineChartSliceDirective, ChartPlotDirective],
  template: `
    <section #chart="etLineChart" [data]="data" etLineChart label="Form">
      <svg class="own-line-plot" etChartPlot>
        @for (slice of chart.slices(); track slice.key) {
          <svg:g [etLineChartSlice]="slice.index" [attr.aria-label]="slice.label" class="own-slice" />
        }
      </svg>
    </section>
  `,
})
class OwnLinesComponent {
  data: LineChartDatum[] = [
    { x: 'Mon', value: 1 },
    { x: 'Tue', value: 3 },
    { x: 'Wed', value: 2 },
  ];
}

@Component({
  selector: 'et-scenario-own-pie',
  imports: [PieChartDirective, ChartPlotDirective],
  template: `
    <div #chart="etPieChart" [data]="data" etPieChart label="Share" size="120">
      <div class="own-pie-plot" etChartPlot>{{ chart.diameter() }} {{ chart.totalText() }}</div>
      @for (entry of chart.entries(); track entry.key) {
        <span class="own-entry">{{ entry.datum.label }} {{ entry.percentText }}</span>
      }
    </div>
  `,
})
class OwnPieComponent {
  data: PieChartDatum[] = [
    { label: 'Home', value: 3 },
    { label: 'Away', value: 1 },
  ];
}

@Component({
  selector: 'et-scenario-own-sankey',
  imports: [SankeyChartDirective, ChartPlotDirective],
  template: `
    <div #chart="etSankeyChart" [nodes]="nodes" [links]="links" etSankeyChart label="Flow">
      <div class="own-sankey-plot" etChartPlot>
        @for (node of chart.renderedNodes(); track node.key) {
          <span class="own-node">{{ node.name }}</span>
        }
      </div>
    </div>
  `,
})
class OwnSankeyComponent {
  nodes: SankeyChartNodeInput[] = [
    { id: 'a', label: 'Team A' },
    { id: 'b', label: 'Team B' },
  ];
  links: SankeyChartLinkInput[] = [{ source: 'a', target: 'b', value: 2 }];
}

@Directive({
  selector: '[etScenarioSparkline]',
  exportAs: 'etScenarioSparkline',
  providers: [{ provide: CHART_PLOT_HOST, useExisting: SparklineDirective }],
})
class SparklineDirective implements ChartPlotHost {
  plot = signal<ChartPlotDirective | null>(null);
}

@Component({
  selector: 'et-scenario-sparkline',
  imports: [SparklineDirective, ChartPlotDirective],
  template: `
    <div #spark="etScenarioSparkline" etScenarioSparkline>
      <div class="spark-plot" etChartPlot>{{ spark.plot()?.width() }}px</div>
    </div>
  `,
})
class SparklineComponent {
  host = inject(CHART_PLOT_HOST, { optional: true });
}

@Component({
  selector: 'et-scenario-plotless-bars',
  imports: [BarChartDirective],
  template: `<div [data]="data" etBarChart label="Nothing to measure"></div>`,
})
class PlotlessBarsComponent {
  data = [{ label: 'Team A', value: 1 }];
}

const query = <E extends Element = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const tableRows = (root: ParentNode) =>
  queryAll('.et-chart-table tbody tr', root).map((row) => Array.from(row.children).map(text));

const tableColumns = (root: ParentNode) => queryAll('.et-chart-table thead th', root).map(text);

const measurePlots = () =>
  fakeLayout([
    {
      match: '[etchartplot], [etbarchartplot]',
      clientWidth: PLOT_WIDTH,
      rect: { left: 0, top: 0, width: PLOT_WIDTH, height: 200 },
    },
  ]);

const render = <T>(s: Scenario, component: new () => T) => {
  measurePlots();

  const fixture = TestBed.createComponent(component);

  s.tick();
  s.flush();

  return { fixture, host: fixture.nativeElement as HTMLElement, app: fixture.componentInstance };
};

const tooltip = () => text(document.querySelector('et-tooltip'));

describe('chart scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('draws grouped and stacked series bars with a legend, tooltips and a data table', () => {
    const s = scenario();
    const { host, app } = render(s, GoalsChartComponent);

    expect(query('svg.et-bar-chart-svg', host).getAttribute('width')).toBe(`${PLOT_WIDTH}`);
    expect(queryAll('.et-chart-legend-label', host).map(text)).toEqual(['Home', 'Away']);

    const bars = queryAll('.et-bar-chart-bar', host);

    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Jan, Home',
      'Jan, Away',
      'Feb, Home',
      'Mar, Home',
      'Mar, Away',
    ]);
    expect(bars.every((bar) => bar.getAttribute('role') === 'img' && bar.getAttribute('tabindex') === '0')).toBe(true);

    bars[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    s.flush();
    expect(tooltip()).toContain('2 goals');
    expect(tooltip()).toContain('Mar');

    expect(query('.et-chart-table caption', host).textContent?.trim()).toBe('Goals per month');
    expect(tableColumns(host)).toEqual(['Month', 'Home', 'Away']);
    expect(tableRows(host)).toEqual([
      ['Jan', '3 goals', '1 goals'],
      ['Feb', '5 goals', ''],
      ['Mar', '2 goals', '4 goals'],
    ]);

    const groupedWidth = Number(query('.et-bar-chart-bar-target', bars[0]).getAttribute('width'));

    app.layout.set('stacked');
    s.tick();

    const stacked = queryAll('.et-bar-chart-bar', host);

    expect(stacked).toHaveLength(5);
    expect(Number(query('.et-bar-chart-bar-target', stacked[0]).getAttribute('width'))).toBeGreaterThan(groupedWidth);
  });

  it('moves between line chart slices by keyboard and breaks the line at a gap', () => {
    const s = scenario();
    const { host } = render(s, AttendanceChartComponent);

    const slices = queryAll<SVGElement>('.et-line-chart-slice', host);

    expect(slices.map((slice) => slice.getAttribute('aria-label'))).toEqual([
      'Round 1',
      'Round 2',
      'Round 3',
      'Round 4',
    ]);
    expect(slices.map((slice) => slice.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(queryAll('.et-line-chart-x-axis *', host).some((label) => text(label) === 'Round 3')).toBe(true);
    expect(queryAll('.et-line-chart-point', host)).toHaveLength(3);

    slices[0]!.focus();
    s.keydown('ArrowRight', slices[0]);
    s.flush();
    expect(document.activeElement).toBe(slices[1]);
    expect(slices.map((slice) => slice.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);

    s.keydown('End', slices[1]);
    s.flush();
    expect(document.activeElement).toBe(slices[3]);

    s.keydown('Home', slices[3]);
    s.flush();
    expect(document.activeElement).toBe(slices[0]);

    slices[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    s.flush();
    expect(tooltip()).toContain('Round 2');
    expect(tooltip()).toContain('1,500');

    expect(tableColumns(host)).toEqual(['Category', 'Fans']);
    expect(tableRows(host)).toEqual([
      ['Round 1', '1,200'],
      ['Round 2', '1,500'],
      ['Round 3', ''],
      ['Round 4', '900'],
    ]);
  });

  it('reports a line chart mixing date and string x values', () => {
    const s = scenario();

    measurePlots();
    const fixture = TestBed.createComponent(MixedLineComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    s.flush();

    s.expectError(`ET${LINE_CHART_ERROR_CODES.MIXED_X_TYPES}`);
    expect(queryAll('.et-line-chart-slice', fixture.nativeElement)).toHaveLength(0);
    expect(tableRows(fixture.nativeElement)).toEqual([]);
  });

  it('draws a donut with its total, a percentage legend and projected centre content', () => {
    const s = scenario();
    const { host, app } = render(s, ResultsPieComponent);

    expect(queryAll('.et-pie-chart-slice', host).map((slice) => slice.getAttribute('aria-label'))).toEqual([
      'Wins',
      'Draws',
      'Losses',
    ]);
    expect(text(query('.et-pie-chart-total', host))).toBe('10');
    expect(text(query('.et-pie-chart-total-label', host))).toBe('Matches');
    expect(text(query('.season', host))).toBe('2026');
    expect(
      queryAll('.et-pie-chart-legend-item', host).map((item) => Array.from(item.querySelectorAll('span')).map(text)),
    ).toEqual([
      ['', 'Wins', '6', '60%'],
      ['', 'Draws', '2', '20%'],
      ['', 'Losses', '2', '20%'],
    ]);

    app.results.update((results) => [...results, { label: 'Forfeits', value: -1 }]);
    s.tick();

    s.expectWarning(`ET${PIE_CHART_ERROR_CODES.INVALID_VALUE}`);
    expect(queryAll('.et-pie-chart-slice', host)).toHaveLength(3);
    expect(text(query('.et-pie-chart-total', host))).toBe('10');

    app.results.set([]);
    s.tick();
    expect(host.querySelector('.et-pie-chart-empty')).not.toBeNull();
  });

  it('draws a sankey flow with node totals and highlights a hovered node', () => {
    const s = scenario();
    const { host } = render(s, TransferFlowComponent);

    const nodes = queryAll('.et-sankey-chart-node', host);
    const links = queryAll('.et-sankey-chart-link', host);

    expect(nodes.map((node) => node.getAttribute('aria-label'))).toEqual(['Academy', 'Team A', 'Team B']);
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(['Academy to Team A', 'Academy to Team B']);
    expect(queryAll('.et-sankey-chart-label', host).map(text)).toEqual(['Academy', 'Team A', 'Team B']);

    nodes[1]!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    s.tick();
    expect(query('.et-sankey-chart-svg', host).hasAttribute('data-highlight')).toBe(true);
    expect(links.map((link) => link.hasAttribute('data-highlighted'))).toEqual([true, false]);

    nodes[1]!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    s.tick();
    expect(query('.et-sankey-chart-svg', host).hasAttribute('data-highlight')).toBe(false);

    nodes[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    s.flush();
    expect(tooltip()).toContain('Academy');
    expect(tooltip()).toContain('11');

    expect(tableColumns(host)).toEqual(['Source', 'Target', 'Value']);
    expect(tableRows(host)).toEqual([
      ['Academy', 'Team A', '8'],
      ['Academy', 'Team B', '3'],
    ]);
  });

  it.each([
    [
      'a duplicate node',
      [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'Again' },
      ],
      [],
      SANKEY_CHART_ERROR_CODES.DUPLICATE_NODE,
    ],
    [
      'an unknown node',
      [{ id: 'a', label: 'A' }],
      [{ source: 'a', target: 'z', value: 1 }],
      SANKEY_CHART_ERROR_CODES.UNKNOWN_NODE,
    ],
    [
      'a negative link',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      [{ source: 'a', target: 'b', value: -1 }],
      SANKEY_CHART_ERROR_CODES.INVALID_VALUE,
    ],
    [
      'a cycle',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      [
        { source: 'a', target: 'b', value: 1 },
        { source: 'b', target: 'a', value: 1 },
      ],
      SANKEY_CHART_ERROR_CODES.CYCLE,
    ],
  ] as [string, SankeyChartNodeInput[], SankeyChartLinkInput[], number][])(
    'reports a sankey with %s',
    (_label, nodes, links, code) => {
      const s = scenario();

      measurePlots();

      const fixture = TestBed.createComponent(TransferFlowComponent);

      fixture.componentInstance.nodes.set(nodes);
      fixture.componentInstance.links.set(links);

      expect(() => fixture.detectChanges()).not.toThrow();
      s.tick();
      s.flush();

      s.expectError(`ET${code}`);
      expect(queryAll('.et-sankey-chart-node', fixture.nativeElement)).toHaveLength(0);
      expect(queryAll('.et-sankey-chart-link', fixture.nativeElement)).toHaveLength(0);
    },
  );

  it('builds charts of its own from the headless directives and their plots', () => {
    const s = scenario();
    const { host: bars, app: ownBars } = render(s, OwnBarsComponent);

    expect(queryAll('.own-bar', bars).map(text)).toEqual(['Team A=30', 'Team B=10']);
    expect(ownBars.plot().width()).toBe(PLOT_WIDTH);
    expect(ownBars.chart().plotWidth()).toBe(PLOT_WIDTH);

    const lines = render(s, OwnLinesComponent).host;
    const slices = queryAll<SVGElement>('.own-slice', lines);

    expect(slices.map((slice) => slice.getAttribute('aria-label'))).toEqual(['Mon', 'Tue', 'Wed']);
    slices[0]!.focus();
    s.keydown('ArrowRight', slices[0]);
    s.flush();
    expect(document.activeElement).toBe(slices[1]);

    const pie = render(s, OwnPieComponent).host;

    expect(text(query('.own-pie-plot', pie))).toBe('120 4');
    expect(queryAll('.own-entry', pie).map(text)).toEqual(['Home 75%', 'Away 25%']);

    const sankey = render(s, OwnSankeyComponent).host;

    expect(queryAll('.own-node', sankey).map(text)).toEqual(['Team A', 'Team B']);
  });

  it('measures a plot for a chart directive of the app through CHART_PLOT_HOST', () => {
    const s = scenario();
    const { host, app } = render(s, SparklineComponent);

    expect(app.host).toBeNull();
    expect(text(query('.spark-plot', host))).toBe(`${PLOT_WIDTH}px`);
  });

  it('reports a headless chart with no plot to measure', () => {
    const s = scenario();

    TestBed.createComponent(PlotlessBarsComponent);
    s.tick();
    s.flush();

    s.expectError(`ET${CHART_ERROR_CODES.MISSING_PLOT}`);
  });
});
