import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'et-sb-dummy-chart',
  template: `
    <div class="h-full flex flex-col p-3 box-border">
      <div class="text-sm font-semibold mb-1" style="color: rgb(var(--et-surface-color))">{{ title() }}</div>
      <div class="text-[11px] mb-2" style="color: rgb(var(--et-surface-color-muted))">Last 10 days</div>
      <div class="flex-1 flex items-end gap-[3px]" style="min-height: 0">
        @for (bar of BARS; track $index) {
          <div
            [style.height.%]="bar"
            [style.background]="bar >= 75 ? '#3b82f6' : bar >= 50 ? '#60a5fa' : '#93c5fd'"
            [style.min-height.px]="4"
            class="flex-1 rounded-t transition-all"
          ></div>
        }
      </div>
      <div class="flex justify-between mt-2 text-[10px]" style="color: rgb(var(--et-surface-color-muted))">
        <span>Mon</span>
        <span>Wed</span>
        <span>Fri</span>
        <span>Sun</span>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DummyChartComponent {
  public title = input('Chart Widget');
  public readonly BARS = [65, 40, 80, 55, 90, 45, 70, 60, 85, 50];
}

@Component({
  selector: 'et-sb-dummy-table',
  template: `
    <div class="h-full flex flex-col p-3 box-border">
      <div class="text-sm font-semibold mb-3" style="color: rgb(var(--et-surface-color))">{{ title() }}</div>
      <div class="flex-1 overflow-auto">
        @for (row of ROWS; track row) {
          <div
            class="flex justify-between py-1.5 text-[13px]"
            style="border-bottom: 1px solid rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color))"
          >
            <span>{{ row.name }}</span>
            <span style="color: rgb(var(--et-surface-color-muted))">{{ row.value }}</span>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DummyTableComponent {
  public title = input('Table Widget');
  public readonly ROWS = [
    { name: 'Revenue', value: '$12,450' },
    { name: 'Users', value: '1,234' },
    { name: 'Orders', value: '456' },
    { name: 'Conversion', value: '3.2%' },
    { name: 'Avg. Session', value: '4m 32s' },
  ];
}

@Component({
  selector: 'et-sb-dummy-text',
  template: `
    <div class="h-full flex flex-col p-3 box-border">
      <div class="text-sm font-semibold mb-2" style="color: rgb(var(--et-surface-color))">{{ title() }}</div>
      <p class="text-[13px] leading-relaxed m-0" style="color: rgb(var(--et-surface-color-muted))">{{ body() }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DummyTextComponent {
  public title = input('Text Widget');
  public body = input(
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  );
}
