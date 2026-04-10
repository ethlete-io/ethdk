import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { injectPipManager } from '../pip-manager';
import { injectStreamManager } from '../stream-manager';
import { StreamPipEntry } from '../stream-manager.types';
import { animateWithFixedWrapper } from './headless/internals/pip-animation';
import { PipCellDirective } from './headless/pip-cell.directive';
import { PIP_ENTRY_TOKEN } from './headless/pip-entry.token';

@Component({
  selector: 'et-pip-player',
  template: `
    @if (thumbnailUrl(); as url) {
      <div [class.et-pip-player__thumb-wrapper--hidden]="!isThumbVisible()" class="et-pip-player__thumb-wrapper">
        <img [src]="url" class="et-pip-player__preview-thumb" alt="" aria-hidden="true" />
      </div>
    }
  `,
  styleUrl: './pip-player.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-pip-player',
    '[class.et-pip-player--ready]': 'isReady()',
    '[attr.data-pip-player-id]': 'resolvedEntry().playerId',
    '[attr.inert]': 'pipCell ? pipCell.cell().playerInertAttr : null',
    '[style.--et-pip-player-ratio]': 'resolvedEntry()?.aspectRatio ?? (16 / 9)',
  },
  providers: [
    {
      provide: PIP_ENTRY_TOKEN,
      useFactory: () => {
        const player = inject(PipPlayerComponent);
        return player.resolvedEntry;
      },
    },
  ],
})
export class PipPlayerComponent {
  private document = inject(DOCUMENT);
  private el = inject(ElementRef<HTMLElement>);
  private streamManager = injectStreamManager();
  private pipManager = injectPipManager();
  private renderer = injectRenderer();
  protected pipCell = inject(PipCellDirective, { optional: true });

  entry = input<StreamPipEntry>();
  showThumbnail = input<boolean>();
  isReady = signal(false);

  resolvedEntry = computed(() => this.entry() ?? this.pipCell?.cell().pip ?? (null as unknown as StreamPipEntry));

  thumbnailUrl = computed(() => this.resolvedEntry().thumbnail?.() ?? null);

  isThumbVisible = computed(() => this.showThumbnail() ?? (this.pipCell ? !this.pipCell.cell().isFeatured : false));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pipManager.parkPlayerElement(this.resolvedEntry().playerId));

    afterRenderEffect(() => {
      const pip = this.resolvedEntry();
      const entryEl = this.el.nativeElement;
      const { playerId } = pip;

      const playerEl = this.streamManager.getPlayerElement(playerId);
      if (!playerEl) return;
      if (playerEl.parentElement === entryEl) {
        return;
      }

      this.isReady.set(false);

      const fromRect = this.pipManager.getInitialRect(playerId);

      queueMicrotask(() => {
        if (!entryEl.isConnected) return;
        if (playerEl.parentElement === entryEl) {
          this.isReady.set(true);

          return;
        }

        const toRect = entryEl.getBoundingClientRect();

        if (fromRect && fromRect.width > 0 && fromRect.height > 0 && toRect.width > 0 && toRect.height > 0) {
          this.renderer.setStyle(entryEl, { visibility: 'hidden' });

          animateWithFixedWrapper({
            playerEl,
            fromRect,
            toRect,
            document: this.document,
            renderer: this.renderer,
            onFinish: () => {
              this.renderer.moveBefore({ newParent: entryEl, child: playerEl, before: entryEl.firstElementChild });
              this.renderer.setStyle(entryEl, { visibility: null });
              this.isReady.set(true);
            },
          });
        } else {
          this.renderer.moveBefore({ newParent: entryEl, child: playerEl, before: entryEl.firstElementChild });
          this.isReady.set(true);
        }
      });
    });
  }
}
