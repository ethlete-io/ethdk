import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { CHART_IMPORTS } from '../chart.imports';
import {
  BarChartCategoryLabelSpacing,
  BarChartDatum,
  BarChartLayout,
  BarChartOrientation,
  BarChartSeries,
  BarChartSeriesDatum,
} from '../headless/bar-chart.directive';

export type BarChartStoryDataset =
  'sign-ups' | 'goal-difference' | 'tickets' | 'budget' | 'goals' | 'daily-visits' | 'empty';

type StoryDataset = {
  label: string;
  data: readonly BarChartDatum[] | readonly BarChartSeriesDatum[];
  series?: readonly BarChartSeries[];
};

const DAILY_VISITS = [
  412, 388, 455, 501, 476, 298, 264, 430, 467, 489, 512, 530, 310, 287, 445, 472, 498, 521, 544, 330, 301, 468, 490,
  515, 538, 560, 345, 318, 480, 505, 527,
];

const DATASETS: Record<BarChartStoryDataset, StoryDataset> = {
  'daily-visits': {
    label: 'Visits per day in March',
    data: DAILY_VISITS.map((value, index) => ({ label: 'Mar ' + (index + 1), value })),
  },
  empty: {
    label: 'Visits per day in April',
    data: [],
  },
  'sign-ups': {
    label: 'Sign-ups per month',
    data: [
      { label: 'Jan', value: 1240 },
      { label: 'Feb', value: 1580 },
      { label: 'Mar', value: 2130 },
      { label: 'Apr', value: 1890 },
      { label: 'May', value: 2460 },
      { label: 'Jun', value: 2980 },
      { label: 'Jul', value: 2710 },
      { label: 'Aug', value: 3320 },
    ],
  },
  'goal-difference': {
    label: 'Goal difference',
    data: [
      { label: 'Falcons', value: 18 },
      { label: 'Harbour', value: 9 },
      { label: 'Rovers', value: 2 },
      { label: 'United', value: -4 },
      { label: 'Athletic', value: -11 },
      { label: 'Wanderers', value: -14 },
    ],
  },
  goals: {
    label: 'Goals scored this season',
    data: [
      { label: 'Falcons', value: 54 },
      { label: 'Harbour City', value: 47 },
      { label: 'Rovers', value: 41 },
      { label: 'United Athletic Club', value: 36 },
      { label: 'Wanderers', value: 29 },
    ],
  },
  tickets: {
    label: 'Tickets sold per month',
    series: [
      { key: 'online', label: 'Online' },
      { key: 'boxOffice', label: 'Box office' },
      { key: 'partners', label: 'Partners' },
    ],
    data: [
      { label: 'Jan', values: { online: 820, boxOffice: 410, partners: 160 } },
      { label: 'Feb', values: { online: 940, boxOffice: 380, partners: 210 } },
      { label: 'Mar', values: { online: 1210, boxOffice: 450, partners: 240 } },
      { label: 'Apr', values: { online: 1080, boxOffice: 520, partners: 190 } },
      { label: 'May', values: { online: 1390, boxOffice: 470, partners: 300 } },
      { label: 'Jun', values: { online: 1620, boxOffice: 560, partners: 280 } },
    ],
  },
  budget: {
    label: 'Club budget per quarter (k€)',
    series: [
      { key: 'sponsoring', label: 'Sponsoring' },
      { key: 'tickets', label: 'Tickets' },
      { key: 'salaries', label: 'Salaries' },
      { key: 'travel', label: 'Travel' },
    ],
    data: [
      { label: 'Q1', values: { sponsoring: 120, tickets: 80, salaries: -150, travel: -30 } },
      { label: 'Q2', values: { sponsoring: 140, tickets: 95, salaries: -150, travel: -45 } },
      { label: 'Q3', values: { sponsoring: 90, tickets: 40, salaries: -160, travel: -20 } },
      { label: 'Q4', values: { sponsoring: 160, tickets: 110, salaries: -165, travel: -50 } },
    ],
  },
};

@Component({
  selector: 'et-sb-bar-chart',
  template: `
    <div class="text-medium flex flex-col gap-4 p-8 font-sans">
      <p class="text-small m-0 opacity-60">{{ story().label }}</p>
      <div [style.inline-size]="boxWidth()">
        <et-bar-chart
          [data]="story().data"
          [series]="series()"
          [layout]="layout()"
          [orientation]="orientation()"
          [label]="story().label"
          [height]="height()"
          [colorToken]="colorToken() || null"
          [maxBarWidth]="maxBarWidth()"
          [categoryLabelSpacing]="categoryLabelSpacing()"
        >
          @if (chartTitle()) {
            <h3 etBarChartTitle>{{ chartTitle() }}</h3>
          }
          <p etBarChartEmpty>No visits recorded yet</p>
          @if (chartNote()) {
            <p etBarChartNote>{{ chartNote() }}</p>
          }
        </et-bar-chart>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHART_IMPORTS],
})
export class BarChartStorybookComponent {
  public dataset = input<BarChartStoryDataset>('sign-ups');
  public layout = input<BarChartLayout>('grouped');
  public orientation = input<BarChartOrientation>('vertical');
  public width = input(640);
  public height = input(240);
  public maxBarWidth = input(24);
  public colorToken = input('');
  public lastSeriesColorToken = input('');
  public categoryLabelSpacing = input<BarChartCategoryLabelSpacing>('auto');
  public chartTitle = input('');
  public chartNote = input('');

  protected story = computed(() => DATASETS[this.dataset()]);
  protected series = computed(() => {
    const series = this.story().series ?? [];
    const override = this.lastSeriesColorToken();

    if (!override || !series.length) return series;

    return series.map((entry, index) => (index === series.length - 1 ? { ...entry, colorToken: override } : entry));
  });
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);
}
