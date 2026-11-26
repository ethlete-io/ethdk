import { Component, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON, ICON_IMPORTS, provideIcons, TIMES_ICON } from '@ethlete/components';

@Component({
  selector: 'app-icon-default-example',
  template: `
    <div class="app-example-row">
      <i class="icon-sm" etIcon="et-chevron"></i>
      <i class="icon-md" etIcon="et-chevron"></i>
      <i class="icon-lg" etIcon="et-chevron"></i>
      <i class="icon-xl" etIcon="et-chevron"></i>
    </div>

    <div class="app-example-row">
      <i class="icon-md icon-rotate-90" etIcon="et-chevron"></i>
      <i class="icon-md icon-rotate-180" etIcon="et-chevron"></i>
      <i class="icon-md icon-rotate-270" etIcon="et-chevron"></i>
    </div>

    <div class="app-example-row">
      <i class="icon-md" etIcon="et-times"></i>
      <i class="icon-md icon-rose" etIcon="et-chevron"></i>
      <i class="icon-md icon-green" etIcon="et-chevron"></i>
      <i class="icon-md icon-amber" etIcon="et-times"></i>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  styles: `
    .icon-sm {
      inline-size: 16px;
      block-size: 16px;
    }

    .icon-md {
      inline-size: 24px;
      block-size: 24px;
    }

    .icon-lg {
      inline-size: 32px;
      block-size: 32px;
    }

    .icon-xl {
      inline-size: 48px;
      block-size: 48px;
    }

    .icon-rotate-90 {
      rotate: 90deg;
    }

    .icon-rotate-180 {
      rotate: 180deg;
    }

    .icon-rotate-270 {
      rotate: -90deg;
    }

    .icon-rose {
      color: #e11d48;
    }

    .icon-green {
      color: #16a34a;
    }

    .icon-amber {
      color: #d97706;
    }
  `,
})
export class IconDefaultExampleComponent {}
