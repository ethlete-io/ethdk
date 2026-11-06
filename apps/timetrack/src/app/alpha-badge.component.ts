import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-alpha-badge',
  template: `
    <span
      class="inline-block rounded-full border border-et-danger/50 bg-et-danger/15 px-2.5 py-1 text-[1rem] leading-none font-bold tracking-[0.14em] text-et-danger-active uppercase dark:text-et-danger-ink"
      data-alpha-patch
    >
      Early alpha
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class AlphaBadgeComponent {}
