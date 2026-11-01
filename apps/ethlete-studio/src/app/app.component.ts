import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex min-w-0 grow flex-col">
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
  host: { class: 'flex h-dvh overflow-hidden' },
})
export class AppComponent {}
