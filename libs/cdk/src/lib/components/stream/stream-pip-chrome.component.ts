import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  inject,
  viewChildren,
} from '@angular/core';
import { injectStreamManager } from './stream-manager';
import { StreamPipEntry } from './stream-manager.types';
import { animateWithFixedWrapper, pipMoveBefore } from './stream-pip';

@Component({
  selector: 'et-stream-pip-chrome',
  template: `
    @for (pip of manager.pips(); track pip.playerId) {
      <div #pipEntry [attr.data-player-id]="pip.playerId" class="et-stream-pip-chrome__entry">
        <div class="et-stream-pip-chrome__controls">
          @if (pip.onBack) {
            <button (click)="onBack(pip)" class="et-stream-pip-chrome__back" type="button" aria-label="Back">‹</button>
          }
          <button
            (click)="onClose(pip)"
            class="et-stream-pip-chrome__close"
            type="button"
            aria-label="Close picture-in-picture"
          >
            ✕
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-stream-pip-chrome',
  },
})
export class StreamPipChromeComponent {
  private document = inject(DOCUMENT);
  private pipEntries = viewChildren<ElementRef<HTMLElement>>('pipEntry');

  protected manager = injectStreamManager();

  constructor() {
    afterRenderEffect(() => {
      for (const { nativeElement: entryEl } of this.pipEntries()) {
        const playerId = entryEl.dataset['playerId'];
        if (!playerId) continue;

        const playerEl = this.manager.getPlayerElement(playerId);
        if (!playerEl || playerEl.parentElement === entryEl) continue;

        const controlsEl = entryEl.querySelector<HTMLElement>('.et-stream-pip-chrome__controls');
        const fromRect = this.manager.getInitialRect(playerId);
        const toRect = entryEl.getBoundingClientRect();

        if (fromRect && fromRect.width > 0 && fromRect.height > 0 && toRect.width > 0 && toRect.height > 0) {
          entryEl.style.visibility = 'hidden';

          animateWithFixedWrapper({
            playerEl,
            fromRect,
            toRect,
            document: this.document,
            onFinish: () => {
              pipMoveBefore(entryEl, playerEl, controlsEl);
              entryEl.style.visibility = '';
            },
          });
        } else {
          pipMoveBefore(entryEl, playerEl, controlsEl);
        }
      }
    });
  }

  onBack(pip: StreamPipEntry): void {
    pip.onBack?.();
  }

  onClose(pip: StreamPipEntry): void {
    this.manager.pipDeactivate(pip.playerId);
  }
}
