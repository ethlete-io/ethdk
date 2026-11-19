import { TestBed } from '@angular/core/testing';
import { anchoredDialogOverlayStrategy } from './anchored-dialog.strategy';
import { buildAnchoredRuntimePositionStrategy } from './anchored.strategy';
import { OverlayStrategyContext } from './overlay-strategy.types';

describe('arrowAnchor', () => {
  it('resolves a function against the origin', () => {
    const origin = document.createElement('div');
    const button = origin.appendChild(document.createElement('button'));

    const position = buildAnchoredRuntimePositionStrategy({ arrowAnchor: (at) => at.querySelector('button') })(origin);

    expect(position).toMatchObject({ kind: 'anchored', referenceElement: origin, arrowAnchor: button });
  });

  it('reaches the position of the anchored dialog strategy', () => {
    const origin = document.createElement('div');
    const button = document.createElement('button');
    const [breakpoint] = TestBed.runInInjectionContext(() => anchoredDialogOverlayStrategy({ arrowAnchor: button })());

    expect(breakpoint?.strategy.config.positionStrategy?.(origin)).toMatchObject({ arrowAnchor: button });
  });

  it('scales the pane from the arrow anchor, not from the centre of a wide origin', () => {
    const rectOf = (element: Element, left: number, top: number, width: number, height: number) =>
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, top, width, height));
    const origin = document.body.appendChild(document.createElement('div'));
    const button = origin.appendChild(document.createElement('button'));
    const containerEl = document.body.appendChild(document.createElement('div'));
    const leave = vi.fn();

    rectOf(origin, 0, 0, 960, 40);
    rectOf(button, 100, 6, 80, 28);
    rectOf(containerEl, 0, 50, 400, 200);

    const [breakpoint] = TestBed.runInInjectionContext(() => anchoredDialogOverlayStrategy({ arrowAnchor: button })());

    breakpoint?.strategy.onBeforeLeave?.({
      origin,
      containerEl,
      lifecycle: { leave },
    } as unknown as OverlayStrategyContext);

    expect(containerEl.style.transformOrigin).toBe('140px -30px');
    expect(leave).toHaveBeenCalledTimes(1);

    origin.remove();
    containerEl.remove();
  });
});
