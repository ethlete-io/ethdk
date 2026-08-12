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
      The titlebar is sticky and opaque: it is the only drag region and the only way to close the
      window, so it has to stay reachable however far a view is scrolled.
    -->
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-et-surface-border bg-et-surface-bg px-3 py-2"
      data-tauri-drag-region="deep"
    >
      <ethlete-timer-control />
      <ethlete-window-controls />
    </div>

    <div class="flex items-start gap-8 p-8">
      <!--
        The rail sticks below the titlebar rather than scrolling with the view: a day review runs far
        past the fold, and navigating out of it must not mean scrolling back up first.
      -->
      <div class="sticky top-14 flex w-56 shrink-0 flex-col gap-6">
        <div class="flex flex-col gap-1 px-3">
          <h1 class="text-h3">Timetrack</h1>
          <p class="text-small text-et-surface-subtle">Local-first Jira and Tempo worklogs.</p>
        </div>

        <ethlete-sidebar />
      </div>

      <main class="flex min-w-0 grow flex-col gap-8">
        <router-outlet />
      </main>
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
