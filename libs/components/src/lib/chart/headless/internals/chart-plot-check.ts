import { afterNextRender } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CHART_ERROR_CODES } from '../../chart-errors';
import { ChartPlotHost } from '../chart-plot.directive';

export const assertChartPlot = (host: ChartPlotHost, directiveName: string) => {
  if (!ngDevMode) return;

  afterNextRender(() => {
    if (host.plot()) return;

    throw new RuntimeError(
      CHART_ERROR_CODES.MISSING_PLOT,
      `[${directiveName}] A required [etChartPlot] element was not found in the template. ` +
        'Add the etChartPlot directive to the element the marks are drawn in.',
    );
  });
};
