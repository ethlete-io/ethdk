import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { LineChartDatum, LineChartSeries, LineChartSeriesDatum } from '../headless/line-chart.directive';
import { LineChartComponent } from '../line-chart.component';

export type LineChartStoryDataset = 'visitors' | 'tickets' | 'daily' | 'gaps' | 'channels' | 'intraday';

type StoryDataset = {
  label: string;
  data: readonly LineChartDatum[] | readonly LineChartSeriesDatum[];
  series?: readonly LineChartSeries[];
};

const DAILY_VISITORS = [
  412, 438, 401, 520, 610, 655, 480, 455, 470, 498, 560, 702, 744, 530, 512, 546, 590, 640, 810, 862, 600, 575, 590,
  615, 680, 900, 948, 690,
];

const INTRADAY = [12, 9, 7, 6, 6, 9, 22, 48, 71, 80, 84, 90, 96, 88, 82, 79, 85, 94, 102, 97, 80, 61, 38, 21];

const DATASETS: Record<LineChartStoryDataset, StoryDataset> = {
  visitors: {
    label: 'Visitors per month',
    data: [
      { x: 'Jan', value: 1240 },
      { x: 'Feb', value: 1580 },
      { x: 'Mar', value: 2130 },
      { x: 'Apr', value: 1890 },
      { x: 'May', value: 2460 },
      { x: 'Jun', value: 2980 },
      { x: 'Jul', value: 2710 },
      { x: 'Aug', value: 3320 },
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
      { x: 'Jan', values: { online: 820, boxOffice: 410, partners: 160 } },
      { x: 'Feb', values: { online: 940, boxOffice: 380, partners: 210 } },
      { x: 'Mar', values: { online: 1210, boxOffice: 450, partners: 240 } },
      { x: 'Apr', values: { online: 1080, boxOffice: 520, partners: 190 } },
      { x: 'May', values: { online: 1390, boxOffice: 470, partners: 300 } },
      { x: 'Jun', values: { online: 1620, boxOffice: 560, partners: 280 } },
    ],
  },
  daily: {
    label: 'Visitors per day',
    data: DAILY_VISITORS.map((value, index) => ({ x: new Date(2025, 2, 17 + index), value })),
  },
  gaps: {
    label: 'Match attendance (k)',
    series: [
      { key: 'home', label: 'Home' },
      { key: 'away', label: 'Away' },
    ],
    data: [
      { x: 'W1', values: { home: 18.2, away: 4.1 } },
      { x: 'W2', values: { home: 19.4, away: 3.8 } },
      { x: 'W3', values: { home: null, away: 4.6 } },
      { x: 'W4', values: { home: 21.0, away: null } },
      { x: 'W5', values: { home: 20.3, away: 5.2 } },
      { x: 'W6', values: { home: 22.8, away: null } },
      { x: 'W7', values: { home: 23.1, away: 5.9 } },
      { x: 'W8', values: { home: null, away: 6.3 } },
      { x: 'W9', values: { home: 24.6, away: 6.0 } },
    ],
  },
  channels: {
    label: 'Streams per channel',
    series: [
      { key: 'app', label: 'App' },
      { key: 'web', label: 'Web' },
      { key: 'tv', label: 'TV' },
      { key: 'partner', label: 'Partner' },
    ],
    data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => ({
      x: new Date(2024, 8 + month, 1),
      values: {
        app: 320 + month * 42 + (month % 3) * 30,
        web: 280 + month * 18 - (month % 4) * 20,
        tv: 140 + (month % 5) * 25,
        partner: 60 + month * 9,
      },
    })),
  },
  intraday: {
    label: 'Live viewers on match day (k)',
    data: INTRADAY.map((value, hour) => ({ x: new Date(2025, 9, 26, hour), value })),
  },
};

@Component({
  selector: 'et-sb-line-chart',
  template: `
    <div
      [etProvideSurface]="surface()"
      class="text-medium flex flex-col gap-4 p-8 font-sans"
      style="background: var(--et-surface-background-solid); color: var(--et-surface-color-solid)"
    >
      <p class="text-small m-0 opacity-60">{{ story().label }}</p>
      <div [style.inline-size]="boxWidth()">
        <et-line-chart
          [data]="story().data"
          [series]="story().series ?? []"
          [label]="story().label"
          [area]="area()"
          [stacked]="stacked()"
          [points]="points()"
          [height]="height()"
          [colorToken]="colorToken() || null"
        />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [LineChartComponent, ProvideSurfaceDirective],
})
export class LineChartStorybookComponent {
  public surface = input('light');
  public dataset = input<LineChartStoryDataset>('visitors');
  public area = input(false);
  public stacked = input(false);
  public points = input(false);
  public width = input(640);
  public height = input(240);
  public colorToken = input('');

  protected story = computed(() => DATASETS[this.dataset()]);
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);
}
