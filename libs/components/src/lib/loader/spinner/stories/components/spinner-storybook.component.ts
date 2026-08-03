import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective, RegisteredColorThemeName } from '@ethlete/core';
import { SpinnerComponent } from '../../spinner.component';

@Component({
  selector: 'et-sb-spinner',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">spinner</p>
        <div
          class="flex min-h-36 items-center justify-center rounded-2xl border p-6 text-et-brand"
          etProvideSurface="dark-elevated"
          style="background: rgb(var(--et-surface-background)); border-color: rgb(var(--et-surface-border))"
        >
          <et-spinner
            [diameter]="diameter()"
            [strokeWidth]="strokeWidth()"
            [track]="track()"
            [determinate]="determinate()"
            [value]="value()"
            [color]="color()"
          />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent, ProvideSurfaceDirective],
})
export class SpinnerStorybookComponent {
  public diameter = input(45);
  public strokeWidth = input(2);
  public track = input(true);
  public determinate = input(false);
  public value = input(0);
  public color = input<RegisteredColorThemeName | null>(null);
}
