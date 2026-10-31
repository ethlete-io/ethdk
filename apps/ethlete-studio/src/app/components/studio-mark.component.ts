import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-studio-mark',
  template: `
    <svg class="block size-full" viewBox="0 0 32 32" aria-hidden="true">
      <rect class="fill-(--et-theme-color-primary-solid)" width="32" height="32" rx="8" />
      <path
        class="stroke-(--et-theme-color-on-primary)"
        d="M21.17 8.62 A5.5 5.5 0 1 0 16 16 A5.5 5.5 0 1 1 10.83 23.38"
        fill="none"
        stroke-width="4"
      />
    </svg>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block' },
})
export class StudioMarkComponent {}
