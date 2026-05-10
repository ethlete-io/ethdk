import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { ProgressBarComponent } from '../../progress-bar.component';

@Component({
  selector: 'et-sb-progress-bar',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">
          {{ indeterminate() ? 'indeterminate' : 'determinate (' + value() + '%)' }}
        </p>
        <div class="flex items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-6">
          <et-progress-bar [value]="value()" [indeterminate]="indeterminate()" class="w-full text-et-brand" />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent],
})
export class ProgressBarStorybookComponent {
  value = input(42);
  indeterminate = input(false);
}
