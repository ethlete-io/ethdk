import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../headless';

@Component({
  selector: 'et-sb-icon',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">chevron</p>
        <div class="flex flex-wrap items-center gap-4">
          <i class="size-4" etIcon="et-chevron"></i>
          <i class="size-6" etIcon="et-chevron"></i>
          <i class="size-8" etIcon="et-chevron"></i>
          <i class="size-12" etIcon="et-chevron"></i>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <i class="size-6 rotate-90" etIcon="et-chevron"></i>
          <i class="size-6 rotate-180" etIcon="et-chevron"></i>
          <i class="size-6 -rotate-90" etIcon="et-chevron"></i>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">times</p>
        <div class="flex flex-wrap items-center gap-4">
          <i class="size-4" etIcon="et-times"></i>
          <i class="size-6" etIcon="et-times"></i>
          <i class="size-8" etIcon="et-times"></i>
          <i class="size-12" etIcon="et-times"></i>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">color inheritance</p>
        <div class="flex flex-wrap items-center gap-4">
          <i class="size-6 text-[#e11d48]" etIcon="et-chevron"></i>
          <i class="size-6 text-[#16a34a]" etIcon="et-chevron"></i>
          <i class="size-6 text-[#2563eb]" etIcon="et-chevron"></i>
          <i class="size-6 text-[#d97706]" etIcon="et-times"></i>
          <i class="size-6 text-[#7c3aed]" etIcon="et-times"></i>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
})
export class IconStorybookComponent {}
