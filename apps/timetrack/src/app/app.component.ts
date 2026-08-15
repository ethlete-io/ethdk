import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shell';
import { TimerControlComponent } from './timer-control.component';
import { injectTrayReadout } from './tray-readout';
import { WindowControlsComponent } from './window-controls.component';

@Component({
  selector: 'ethlete-root',
  template: `
    <!--
      The window is one viewport tall and never scrolls as a whole; a view scrolls inside <main>.
      That is what keeps the titlebar reachable - it is the only drag region and the only way to
      close the window, so it must never leave the screen.
    -->
    <div class="flex h-dvh flex-col">
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-et-surface-border px-3 py-2"
        data-tauri-drag-region="deep"
      >
        <ethlete-timer-control />
        <ethlete-window-controls />
      </div>

      <div class="flex min-h-0 grow">
        <div class="flex w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-et-surface-border py-6 pr-4 pl-3">
          <div class="flex flex-col gap-1 px-3">
            <h1 class="text-h3">Timetrack</h1>
            <p class="text-small text-et-surface-subtle">Local-first Jira and Tempo worklogs.</p>
          </div>

          <ethlete-sidebar />
        </div>

        <main class="flex min-h-0 min-w-0 grow flex-col overflow-y-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, SidebarComponent, TimerControlComponent, WindowControlsComponent],
})
export class AppComponent {
  constructor() {
    // The tray readout has no view of its own, so nothing else would ever construct it.
    injectTrayReadout();
  }
}
