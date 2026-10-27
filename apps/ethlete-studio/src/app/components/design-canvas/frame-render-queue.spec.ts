import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { MAX_RENDERING_FRAMES, RenderSlotState, injectFrameRenderQueue } from './frame-render-queue';

describe('FrameRenderQueue', () => {
  it('renders at most four frames at once, visible ones first, and counts the rest as waiting', () => {
    const queue = TestBed.runInInjectionContext(() => injectFrameRenderQueue());
    const states: (RenderSlotState | null)[] = [];
    const slots: Subscription[] = [];
    const request = (visible: boolean) => {
      const index = states.push(null) - 1;

      slots.push(queue.slot$(() => visible).subscribe((state) => (states[index] = state)));
    };

    for (let index = 0; index < MAX_RENDERING_FRAMES + 2; index++) request(false);
    request(true);

    expect(states.filter((state) => state === 'rendering')).toHaveLength(MAX_RENDERING_FRAMES);
    expect(queue.count()).toBe(MAX_RENDERING_FRAMES + 3);

    slots[0]?.unsubscribe();

    expect(states.at(-1)).toBe('rendering');
    expect(states[MAX_RENDERING_FRAMES]).toBe('queued');

    slots.forEach((slot) => slot.unsubscribe());

    expect(queue.count()).toBe(0);
  });
});
