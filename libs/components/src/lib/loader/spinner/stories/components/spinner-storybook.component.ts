import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { SpinnerComponent } from '../../spinner.component';

@Component({
  selector: 'et-sb-spinner',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">spinner</p>
        <div
          class="flex min-h-36 items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-6 text-et-brand"
        >
          <et-spinner
            [diameter]="diameter()"
            [strokeWidth]="strokeWidth()"
            [track]="track()"
            [determinate]="determinate()"
            [value]="value()"
          />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
})
export class SpinnerStorybookComponent {
  public diameter = input(45);
  public strokeWidth = input(2);
  public track = input(true);
  public determinate = input(false);
  public value = input(0);
}
