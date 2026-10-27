import { computed, signal } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { Observable } from 'rxjs';

export const MAX_RENDERING_FRAMES = 4;

export type RenderSlotState = 'queued' | 'rendering';

type Waiting = { visible: () => boolean; grant: () => void };

/** Lets at most `MAX_RENDERING_FRAMES` frames reload at once, visible frames first. */
export class FrameRenderQueue {
  private waiting = signal<Waiting[]>([]);
  private rendering = signal<ReadonlySet<Waiting>>(new Set());

  /** Frames that wait for a slot or render now. */
  public count = computed(() => this.waiting().length + this.rendering().size);

  /** Emits `queued`, then `rendering` once a slot is free. Unsubscribing gives the slot back. */
  public slot$(visible: () => boolean): Observable<RenderSlotState> {
    return new Observable<RenderSlotState>((subscriber) => {
      const entry: Waiting = { visible, grant: () => subscriber.next('rendering') };

      subscriber.next('queued');
      this.waiting.update((waiting) => [...waiting, entry]);
      this.pump();

      return () => {
        this.waiting.update((waiting) => waiting.filter((other) => other !== entry));

        if (this.rendering().has(entry)) {
          this.rendering.update((rendering) => new Set([...rendering].filter((other) => other !== entry)));
          this.pump();
        }
      };
    });
  }

  private pump() {
    while (this.rendering().size < MAX_RENDERING_FRAMES && this.waiting().length > 0) {
      const waiting = this.waiting();
      const next = waiting.find((entry) => entry.visible()) ?? waiting[0];

      if (!next) return;

      this.waiting.set(waiting.filter((entry) => entry !== next));
      this.rendering.update((rendering) => new Set([...rendering, next]));
      next.grant();
    }
  }
}

const FRAME_RENDER_QUEUE_DEF = /* @__PURE__ */ defineRootProvider(() => new FrameRenderQueue());

export const injectFrameRenderQueue = /* @__PURE__ */ toInjectFn(FRAME_RENDER_QUEUE_DEF);
