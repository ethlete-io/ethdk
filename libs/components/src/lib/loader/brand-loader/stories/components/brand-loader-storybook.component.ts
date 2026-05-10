import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { BrandLoaderComponent } from '../../brand-loader.component';

@Component({
  selector: 'et-sb-brand-loader',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">light</p>
        <div class="flex min-h-36 items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-6">
          <et-brand-loader />
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">dark</p>
        <div
          class="flex min-h-36 items-center justify-center rounded-2xl border border-slate-900/10 p-6"
          style="background: #0a0a0a; color: #0a0a0a"
        >
          <et-brand-loader />
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLoaderComponent],
})
export class BrandSpinnerStorybookComponent {}
