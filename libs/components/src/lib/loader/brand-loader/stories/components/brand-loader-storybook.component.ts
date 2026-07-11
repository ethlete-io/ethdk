import { Component, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BrandLoaderComponent } from '../../brand-loader.component';

@Component({
  selector: 'et-sb-brand-loader',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">brand loader</p>
        <div
          class="flex min-h-36 items-center justify-center rounded-2xl border p-6"
          etProvideSurface="dark-elevated"
          style="background: rgb(var(--et-surface-background)); border-color: rgb(var(--et-surface-border)); color: rgb(var(--et-surface-background))"
        >
          <et-brand-loader />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BrandLoaderComponent, ProvideSurfaceDirective],
})
export class BrandSpinnerStorybookComponent {}
