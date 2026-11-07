import { TestBed } from '@angular/core/testing';
import { anchoredDialogOverlayStrategy } from './anchored-dialog.strategy';
import { buildAnchoredRuntimePositionStrategy } from './anchored.strategy';

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
});
