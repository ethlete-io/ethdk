import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleBarComponent } from './components/title-bar/title-bar.component';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex min-w-0 grow flex-col bg-(--et-surface-background-solid)">
      <ethlete-title-bar />
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, TitleBarComponent],
  host: { class: 'flex h-dvh overflow-hidden' },
})
export class AppComponent {}
