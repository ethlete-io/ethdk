import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PieChartDatum } from '../headless/pie-chart.directive';
import { PieChartComponent } from '../pie-chart.component';

export type PieChartStoryDataset = 'devices' | 'channels' | 'single' | 'with-zero';

type StoryDataset = {
  label: string;
  data: readonly PieChartDatum[];
};

const DATASETS: Record<PieChartStoryDataset, StoryDataset> = {
  devices: {
    label: 'Sessions by device',
    data: [
      { label: 'Mobile', value: 5820 },
      { label: 'Desktop', value: 3410 },
      { label: 'Tablet', value: 740 },
      { label: 'Smart TV', value: 230 },
    ],
  },
  channels: {
    label: 'Visits by channel',
    data: [
      { label: 'Search', value: 4200 },
      { label: 'Direct', value: 2600 },
      { label: 'Social', value: 1800 },
      { label: 'Referral', value: 900 },
      { label: 'Email', value: 520 },
      { label: 'Podcasts', value: 310 },
      { label: 'Print', value: 140 },
      { label: 'Events', value: 90 },
    ],
  },
  single: {
    label: 'Tickets sold online',
    data: [{ label: 'Online', value: 1280 }],
  },
  'with-zero': {
    label: 'Goals by period',
    data: [
      { label: 'First half', value: 21 },
      { label: 'Second half', value: 33 },
      { label: 'Extra time', value: 0 },
      { label: 'Penalties', value: 4 },
    ],
  },
};

@Component({
  selector: 'et-sb-pie-chart',
  template: `
    <div
      [etProvideSurface]="surface()"
      class="text-medium flex flex-col gap-4 p-8 font-sans"
      style="background: var(--et-surface-background-solid); color: var(--et-surface-color-solid)"
    >
      <p class="text-small m-0 opacity-60">{{ story().label }}</p>
      <div [style.inline-size]="boxWidth()">
        <et-pie-chart
          [data]="story().data"
          [label]="story().label"
          [size]="size()"
          [innerRadius]="innerRadius()"
          [showTotal]="showTotal()"
          [colorToken]="colorToken() || null"
        >
          @if (centerText()) {
            <span class="text-small" etPieChartCenter>{{ centerText() }}</span>
          }
        </et-pie-chart>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PieChartComponent, ProvideSurfaceDirective],
})
export class PieChartStorybookComponent {
  public surface = input('light');
  public dataset = input<PieChartStoryDataset>('devices');
  public width = input(520);
  public size = input(200);
  public innerRadius = input(0);
  public showTotal = input(false);
  public centerText = input('');
  public colorToken = input('');

  protected story = computed(() => DATASETS[this.dataset()]);
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);
}
