import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex h-dvh flex-col">
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
})
export class AppComponent {}
