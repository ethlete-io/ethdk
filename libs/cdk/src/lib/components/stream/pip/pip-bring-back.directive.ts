import { Directive, ElementRef, afterRenderEffect, inject, signal } from '@angular/core';
import { signalHostElementIntersection } from '@ethlete/core';
import { injectPipManager } from '../pip-manager';
import { STREAM_SLOT_PLAYER_ID_TOKEN } from '../stream-manager.types';
import { animatePulse } from './pip-animation';

@Directive({
  selector: '[etPipBringBack]',
  host: {
    '(click)': 'bringBack($event)',
  },
})
export class PipBringBackDirective {
  private pipManager = injectPipManager();
  private slotPlayerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN, { optional: true });
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private intersection = signalHostElementIntersection();
  private pendingPulse = signal(false);

  constructor() {
    afterRenderEffect(() => {
      if (!this.pendingPulse()) return;
      if (!this.intersection().some((e) => e.isVisible)) return;
      this.pendingPulse.set(false);
      animatePulse(this.el.nativeElement);
    });
  }

  pulse(): void {
    this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    this.pendingPulse.set(true);
  }

  bringBack(event: Event): void {
    event.stopPropagation();
    const playerId = this.slotPlayerId?.();
    if (playerId) this.pipManager.pipDeactivate(playerId);
  }
}
