import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BarChartDatum } from '../headless/bar-chart.directive';
import { CHART_IMPORTS } from '../chart.imports';

const MONTHLY_SIGN_UPS: BarChartDatum[] = [
  { label: 'Jan', value: 1240 },
  { label: 'Feb', value: 1580 },
  { label: 'Mar', value: 2130 },
  { label: 'Apr', value: 1890 },
  { label: 'May', value: 2460 },
  { label: 'Jun', value: 2980 },
  { label: 'Jul', value: 2710 },
  { label: 'Aug', value: 3320 },
];

const GOAL_DIFFERENCE: BarChartDatum[] = [
  { label: 'Falcons', value: 18 },
  { label: 'Harbour', value: 9 },
  { label: 'Rovers', value: 2 },
  { label: 'United', value: -4 },
  { label: 'Athletic', value: -11 },
  { label: 'Wanderers', value: -14 },
];

@Component({
  selector: 'et-sb-bar-chart',
  template: `
    <div
      [etProvideSurface]="surface()"
      class="text-medium flex flex-col gap-4 p-8 font-sans"
      style="background: var(--et-surface-background-solid); color: var(--et-surface-color-solid)"
    >
      <p class="text-small m-0 opacity-60">{{ label() }}</p>
      <div [style.inline-size]="boxWidth()">
        <et-bar-chart
          [data]="data()"
          [label]="label()"
          [height]="height()"
          [colorToken]="colorToken() || null"
          [maxBarWidth]="maxBarWidth()"
        />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHART_IMPORTS, ProvideSurfaceDirective],
})
export class BarChartStorybookComponent {
  public surface = input('light');
  public dataset = input<'sign-ups' | 'goal-difference'>('sign-ups');
  public width = input(640);
  public height = input(240);
  public maxBarWidth = input(24);
  public colorToken = input('');

  protected data = computed(() => (this.dataset() === 'goal-difference' ? GOAL_DIFFERENCE : MONTHLY_SIGN_UPS));
  protected label = computed(() => (this.dataset() === 'goal-difference' ? 'Goal difference' : 'Sign-ups per month'));
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);
}
