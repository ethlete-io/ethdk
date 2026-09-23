import { ApplicationRef, Component, ErrorHandler, Injector, Type, inject, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../test-helpers';
import { injectPipChromeManager } from './pip-chrome-manager';
import { injectPipManager } from './pip-manager';
import { injectStreamManager } from './stream-manager';
import { PIP_CHROME_REF_TOKEN } from './pip/headless/pip-chrome-ref.token';
import { provideStreamPip } from './stream-pip.provider';
import { STREAM_PIP_TOKEN, StreamPipRegistration } from './stream-pip.token';

const PLAYER_ID = 'youtube-abc';

@Component({
  selector: 'et-chrome-without-token',
  template: '',
})
class ChromeWithoutTokenComponent {}

let registrationSeenByChrome: StreamPipRegistration | null = null;

@Component({
  selector: 'et-chrome-reading-registration',
  template: '',
  providers: [{ provide: PIP_CHROME_REF_TOKEN, useExisting: ChromeReadingRegistrationComponent }],
})
class ChromeReadingRegistrationComponent {
  constructor() {
    registrationSeenByChrome = inject(STREAM_PIP_TOKEN, { optional: true });
  }
}

@Component({
  selector: 'et-pip-registration-host',
  template: '',
  providers: [provideStreamPip()],
})
class PipRegistrationHostComponent {
  public injector = inject(Injector);
}

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

  it('mounts the chrome under the component injector that registered stream PiP', () => {
    registrationSeenByChrome = null;

    const host = TestBed.createComponent(PipRegistrationHostComponent);
    const slotEl = document.createElement('div');

    document.body.appendChild(slotEl);

    const pipManager = runInInjectionContext(host.componentInstance.injector, () => {
      injectPipChromeManager();

      const streamManager = injectStreamManager();

      streamManager.registerPlayer({ id: PLAYER_ID, element: document.createElement('div') });
      streamManager.registerSlot({ playerId: PLAYER_ID, priority: false, element: slotEl });

      return injectPipManager();
    });

    pipManager.pipActivate(slotEl, { pipChromeComponent: ChromeReadingRegistrationComponent });
    TestBed.inject(ApplicationRef).tick();

    expect((TestBed.inject(ErrorHandler) as CollectingErrorHandler).errors).toEqual([]);
    expect(registrationSeenByChrome).toBe(host.componentInstance.injector.get(STREAM_PIP_TOKEN));
  });
});
