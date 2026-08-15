import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { formatDurationMs } from '@ethlete/timetrack';
import { injectCollectionPause } from './collection-pause';

/**
 * The hard pause, in the titlebar beside the timer.
 *
 * A pause has to be visible from anywhere in the app, not found in a settings screen: an app that has
 * stopped watching must never look like one that is watching, and the band at the top of the shell is
 * the one part of it that is on screen however far a day is scrolled.
 */
@Component({
  selector: 'ethlete-pause-control',
  template: `
    @if (pause.isPaused()) {
      <div class="flex items-center gap-2">
        <span class="text-small font-medium text-et-warning-ink">Collection paused — {{ pausedFor() }}</span>
        <button (click)="pause.toggle()" et-button variant="filled" size="sm">Resume</button>
      </div>
    } @else {
      <button (click)="pause.toggle()" et-button variant="outline" size="sm">Pause collection</button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class PauseControlComponent {
  protected pause = injectCollectionPause();

  protected pausedFor = computed(() => formatDurationMs(this.pause.pausedForMs()));
}
