import { BarChartComponent } from './bar-chart.component';
import { BarChartPlotDirective } from './headless/bar-chart-plot.directive';
import { BarChartDirective } from './headless/bar-chart.directive';
import { ChartPlotDirective } from './headless/chart-plot.directive';

export const CHART_IMPORTS = [BarChartComponent, BarChartDirective, BarChartPlotDirective, ChartPlotDirective] as const;
