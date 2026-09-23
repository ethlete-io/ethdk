import { BarChartComponent } from './bar-chart.component';
import { BarChartPlotDirective } from './headless/bar-chart-plot.directive';
import { BarChartDirective } from './headless/bar-chart.directive';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { LineChartSliceDirective } from './headless/line-chart-slice.directive';
import { LineChartDirective } from './headless/line-chart.directive';
import { PieChartDirective } from './headless/pie-chart.directive';
import { LineChartComponent } from './line-chart.component';
import { PieChartComponent } from './pie-chart.component';
import { SankeyChartDirective } from './headless/sankey-chart.directive';
import { SankeyChartComponent } from './sankey-chart.component';

export const CHART_IMPORTS = [
  BarChartComponent,
  BarChartDirective,
  BarChartPlotDirective,
  ChartPlotDirective,
  LineChartComponent,
  LineChartDirective,
  LineChartSliceDirective,
  PieChartComponent,
  PieChartDirective,
  SankeyChartComponent,
  SankeyChartDirective,
] as const;
