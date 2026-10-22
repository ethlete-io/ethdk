import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartSeries, BarChartSeriesDatum } from '@ethlete/components';

@Component({
  selector: 'app-chart-stacked-negative-example',
  template: `<et-bar-chart [data]="data" [series]="series" layout="stacked" label="Club budget per quarter (k€)" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartStackedNegativeExampleComponent {
  public series: BarChartSeries[] = [
    { key: 'sponsoring', label: 'Sponsoring' },
    { key: 'tickets', label: 'Tickets' },
    { key: 'salaries', label: 'Salaries' },
    { key: 'travel', label: 'Travel' },
  ];

  public data: BarChartSeriesDatum[] = [
    { label: 'Q1', values: { sponsoring: 120, tickets: 80, salaries: -150, travel: -30 } },
    { label: 'Q2', values: { sponsoring: 140, tickets: 95, salaries: -150, travel: -45 } },
    { label: 'Q3', values: { sponsoring: 90, tickets: 40, salaries: -160, travel: -20 } },
    { label: 'Q4', values: { sponsoring: 160, tickets: 110, salaries: -165, travel: -50 } },
  ];
}
