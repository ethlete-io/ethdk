import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { ProgressBarComponent } from '../../progress-bar.component';

@Component({
  selector: 'et-sb-progress-bar',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">
          {{ indeterminate() ? 'indeterminate' : 'determinate (' + value() + '%)' }}
        </p>
        <div
          class="flex items-center justify-center rounded-2xl border p-6"
          etProvideSurface="dark-elevated"
          style="background: rgb(var(--et-surface-background)); border-color: rgb(var(--et-surface-border))"
        >
          <et-progress-bar [value]="value()" [indeterminate]="indeterminate()" class="w-full text-et-brand" />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProgressBarComponent, ProvideSurfaceDirective],
})
export class ProgressBarStorybookComponent {
  public value = input(42);
  public indeterminate = input(false);
}
