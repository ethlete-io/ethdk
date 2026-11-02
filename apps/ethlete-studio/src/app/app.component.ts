import { Component, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { windowChrome$ } from '../host/window';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { injectUpdateCheck } from './update-check';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex min-w-0 grow flex-col bg-(--et-surface-background-solid)">
      @if (chrome(); as chrome) {
        <ethlete-title-bar
          [os]="chrome.os"
          [left]="chrome.left"
          [right]="chrome.right"
          [update]="!!updateCheck.version()"
          class="shrink-0"
        />
      }
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, TitleBarComponent],
  host: { class: 'flex h-dvh overflow-hidden' },
})
export class AppComponent {
  protected updateCheck = injectUpdateCheck();

  // eslint-disable-next-line ethlete/no-silent-catch-error -- window chrome is optional; without it the title bar is left out
  protected chrome = toSignal(windowChrome$().pipe(catchError(() => of(null))), { initialValue: null });
}
