import { ApplicationRef, Component, ErrorHandler, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../test-helpers';
import { injectPipChromeManager } from './pip-chrome-manager';
import { injectPipManager } from './pip-manager';
import { injectStreamManager } from './stream-manager';

const PLAYER_ID = 'youtube-abc';

@Component({
  selector: 'et-chrome-without-token',
  template: '',
})
class ChromeWithoutTokenComponent {}

class CollectingErrorHandler implements ErrorHandler {
  errors: unknown[] = [];

  handleError(error: unknown) {
    this.errors.push(error);
  }
}

describe('PipChromeManager', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useClass: CollectingErrorHandler }] });
  });

  const activateWithChrome = (pipChromeComponent: Type<unknown>) => {
    const slotEl = document.createElement('div');

    document.body.appendChild(slotEl);

    const pipManager = TestBed.runInInjectionContext(() => {
      injectPipChromeManager();

      const streamManager = injectStreamManager();

      streamManager.registerPlayer({ id: PLAYER_ID, element: document.createElement('div') });
      streamManager.registerSlot({ playerId: PLAYER_ID, priority: false, element: slotEl });

      return injectPipManager();
    });

    pipManager.pipActivate(slotEl, { pipChromeComponent });

    let thrown: unknown = null;

    try {
      TestBed.inject(ApplicationRef).tick();
    } catch (error) {
      thrown = error;
    }

    return [...(TestBed.inject(ErrorHandler) as CollectingErrorHandler).errors, thrown]
      .filter((entry) => entry !== null)
      .map(String)
      .join('\n');
  };

  it('tells a chrome without the token to provide PIP_CHROME_REF_TOKEN, not to use hostDirectives', () => {
    const report = activateWithChrome(ChromeWithoutTokenComponent);

    expect(report).toContain('ET1604');
    expect(report).toContain('PIP_CHROME_REF_TOKEN');
    expect(report).toContain('useExisting');
    expect(report).toContain('PipChromeRef');
    expect(report).not.toContain('hostDirectives');
  });
});
