import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SHELL_VIEWS } from './views';

@Component({
  selector: 'ethlete-sidebar',
  template: `
    <nav class="flex flex-col gap-1" aria-label="Views">
      @for (view of VIEWS; track view.path) {
        <a
          [routerLink]="view.path"
          class="flex flex-col gap-0.5 rounded-md px-3 py-2 no-underline transition-colors hover:bg-et-surface-border/40"
          routerLinkActive="bg-et-brand/10 text-et-brand-ink"
        >
          <span class="text-base">{{ view.label }}</span>
          <span class="text-small text-et-surface-subtle">{{ view.hint }}</span>
        </a>
      }
    </nav>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive],
})
export class SidebarComponent {
  protected readonly VIEWS = SHELL_VIEWS;
}
