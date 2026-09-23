import { BarChartComponent } from './bar-chart.component';
import { BarChartPlotDirective } from './headless/bar-chart-plot.directive';
import { BarChartDirective } from './headless/bar-chart.directive';

export const CHART_IMPORTS = [BarChartComponent, BarChartDirective, BarChartPlotDirective] as const;
