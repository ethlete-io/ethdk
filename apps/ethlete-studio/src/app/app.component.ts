import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex h-dvh flex-col">
      <nav class="flex gap-4 border-b border-et-surface-border px-8 py-2">
        <a
          [routerLinkActiveOptions]="{ exact: true }"
          class="text-et-surface-muted"
          routerLink="/"
          routerLinkActive="text-et-surface-fg"
          >Calls</a
        >
        <a class="text-et-surface-muted" routerLink="/agent" routerLinkActive="text-et-surface-fg">Agent</a>
      </nav>
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class AppComponent {}
