import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryDevtoolsEntry } from '@ethlete/query/devtools-contract';
import { ɵQUERY_DEVTOOLS_VIEW_STATE_KEY as QUERY_DEVTOOLS_VIEW_STATE_KEY } from '@ethlete/query-devtools/toggle';
import { QueryDevtoolsComponent } from './query-devtools.component';
import { AnyQuery } from './query-devtools-types';

class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

const installJsdomShims = () => {
  if (!globalThis.ResizeObserver) {
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
  }

  if (!globalThis.matchMedia) {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
};

const mount = (startOpen: boolean) => {
  const fixture = TestBed.createComponent(QueryDevtoolsComponent);
  fixture.componentRef.setInput('startOpen', startOpen);
  fixture.detectChanges();

  return fixture;
};

describe('QueryDevtoolsComponent', () => {
  beforeEach(() => {
    installJsdomShims();
    // Only the timer APIs, never `Date`: a faked clock outlives this file's teardown badly enough that a
    // later spec's `new Date(...)` serializes as `{}`, and nothing here needs wall-clock control.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('should warn once when the provider is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    mount(false).destroy();
    mount(false).destroy();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('provideQueryDevtools()');

    warn.mockRestore();
  }, 30_000);

  it('should report a socket that refuses a message apart from invalid JSON', () => {
    const fixture = mount(false);
    const panel = fixture.componentInstance;
    const emit = () => {
      throw new Error('Socket is closed.');
    };
    const entry = { id: 'ws-1', handle: { emit } } as unknown as QueryDevtoolsEntry;

    panel.emitSocketMessage({ entry, event: 'ping', data: '{}' });
    expect(panel.socketEmitErrorFor('ws-1')).toBe('Socket is closed.');

    panel.emitSocketMessage({ entry, event: 'ping', data: '{' });
    expect(panel.socketEmitErrorFor('ws-1')).toBe('Invalid JSON');

    fixture.destroy();
  });

  it('should not schedule a recurring timer while the panel is closed', () => {
    const before = vi.getTimerCount();
    const fixture = mount(false);

    expect(vi.getTimerCount()).toBe(before);

    vi.advanceTimersByTime(5000);

    expect(vi.getTimerCount()).toBe(before);

    fixture.destroy();
  });

  it('should name the missing provider in the empty Queries tab', () => {
    const fixture = mount(true);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'provideQueryDevtools() is not in the application providers',
    );

    fixture.destroy();
  }, 30_000);

  it('should schedule the clock only while the panel is open', () => {
    const fixture = mount(true);
    const whileOpen = vi.getTimerCount();

    expect(whileOpen).toBeGreaterThan(0);

    (fixture.componentInstance as unknown as { open: WritableSignal<boolean> }).open.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    expect(vi.getTimerCount()).toBeLessThan(whileOpen);

    fixture.destroy();
  });

  it('should slim the args a copied report carries, not only its response', () => {
    const fixture = mount(true);
    const written: { text: string }[] = [];

    vi.spyOn(
      fixture.componentInstance as unknown as { writeToClipboard: (payload: { text: string }) => void },
      'writeToClipboard',
    ).mockImplementation((payload) => void written.push(payload));

    const entry = { id: 'login', kind: 'query', meta: { method: 'POST', route: '/auth/login' } } as QueryDevtoolsEntry;
    const query = {
      error: () => null,
      latestHttpEvent: () => null,
      executionState: () => null,
      lastTimeExecutedAt: () => null,
      args: () => ({ body: { email: 'dev@example.com', password: 'hunter2' } }),
      response: () => ({ ok: true }),
      subtle: { request: () => null },
    } as unknown as AnyQuery;

    fixture.componentInstance.copyReport(entry, query);

    expect(written[0]?.text).toContain('dev@example.com');
    expect(written[0]?.text).not.toContain('hunter2');

    fixture.destroy();
  });

  it('should release the probe lock when the panel is destroyed', () => {
    const fixture = mount(true);
    const release = vi.fn();
    const instance = fixture.componentInstance as unknown as { probeHold: { release: () => void } | null };
    instance.probeHold = { release };

    fixture.destroy();

    expect(release).toHaveBeenCalled();
    expect(instance.probeHold).toBe(null);
  });

  it('should style the pop-out without a style attribute a strict CSP would block', () => {
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = () => 'blob:popout';
    URL.revokeObjectURL = () => undefined;

    const frame = document.createElement('iframe');
    document.body.append(frame);

    const popup = frame.contentWindow as Window;
    const nonced = document.createElement('style');
    nonced.setAttribute('nonce', 'from-the-page');
    document.head.append(nonced);
    document.documentElement.style.setProperty('--qdt-spec-token', '1');

    vi.spyOn(window, 'open').mockReturnValue(popup);

    const fixture = mount(true);
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute');

    fixture.componentInstance.popOut();
    popup.dispatchEvent(new Event('load'));

    expect(setAttribute.mock.calls.filter(([name]) => name === 'style')).toEqual([]);
    expect(popup.document.documentElement.style.getPropertyValue('--qdt-spec-token')).toBe('1');
    expect(popup.document.body.style.margin).toBe('0px');
    expect(popup.document.head.querySelector('style[nonce="from-the-page"]')).not.toBeNull();

    fixture.destroy();
    frame.remove();
    nonced.remove();
    document.documentElement.style.removeProperty('--qdt-spec-token');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should keep the inspect-mode Escape and clicks away from the app', () => {
    const fixture = mount(true);
    const panel = fixture.componentInstance as unknown as { inspectActive: WritableSignal<boolean> };
    const target = document.body.appendChild(document.createElement('div'));
    const appKeydown = vi.fn();
    const appClick = vi.fn();

    target.addEventListener('keydown', appKeydown);
    target.addEventListener('click', appClick);

    panel.inspectActive.set(true);
    fixture.detectChanges();

    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(appClick).not.toHaveBeenCalled();
    expect(appKeydown).not.toHaveBeenCalled();
    expect(panel.inspectActive()).toBe(false);

    target.remove();
    fixture.destroy();
  });

  it('should write the view state once a resize ends, not on every move', () => {
    const fixture = mount(true);
    const panel = fixture.componentInstance as unknown as {
      drag: WritableSignal<unknown>;
      panelHeight: WritableSignal<number>;
    };
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const viewStateWrites = () => setItem.mock.calls.filter(([key]) => key === QUERY_DEVTOOLS_VIEW_STATE_KEY).length;

    panel.drag.set({ kind: 'panel', doc: document });
    fixture.detectChanges();

    for (const height of [310, 320, 330]) {
      panel.panelHeight.set(height);
      fixture.detectChanges();
    }

    expect(viewStateWrites()).toBe(0);

    panel.drag.set(null);
    fixture.detectChanges();

    expect(viewStateWrites()).toBe(1);

    fixture.destroy();
  });

  describe('pop-out', () => {
    const shortcut = () => new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', ctrlKey: true, altKey: true });

    const setup = () => {
      const { createObjectURL, revokeObjectURL } = URL;
      const revoke = vi.fn();
      let blobs = 0;

      URL.createObjectURL = () => `blob:popout-${++blobs}`;
      URL.revokeObjectURL = revoke;

      const frame = document.createElement('iframe');
      document.body.append(frame);

      const popup = frame.contentWindow as Window;

      vi.spyOn(window, 'open').mockReturnValue(popup);

      const fixture = mount(true);
      const panel = fixture.componentInstance as unknown as { poppedOut: () => boolean };

      const teardown = () => {
        fixture.destroy();
        frame.remove();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
        vi.restoreAllMocks();
      };

      return { fixture, panel, popup, revoke, teardown };
    };

    it('should dock back on the shortcut pressed inside the pop-up', () => {
      const { fixture, panel, popup, teardown } = setup();

      fixture.componentInstance.popOut();
      popup.dispatchEvent(new Event('load'));

      expect(panel.poppedOut()).toBe(true);

      popup.document.dispatchEvent(shortcut());

      expect(panel.poppedOut()).toBe(false);

      teardown();
    });

    it('should drop the pop-up listeners on dock-back', () => {
      const { fixture, popup, teardown } = setup();
      const removed = vi.spyOn(popup, 'removeEventListener');

      fixture.componentInstance.popOut();
      popup.dispatchEvent(new Event('load'));
      popup.document.dispatchEvent(shortcut());

      expect(removed.mock.calls.map(([type]) => type)).toContain('pagehide');

      teardown();
    });

    it('should revoke the blob of a pop-out that never loaded', () => {
      const { fixture, revoke, teardown } = setup();

      fixture.componentInstance.popOut();

      expect(revoke).not.toHaveBeenCalled();

      fixture.componentInstance.popOut();

      expect(revoke).toHaveBeenCalledWith('blob:popout-1');

      teardown();
    });

    it('should stop the clock while the pop-up is hidden', () => {
      const { fixture, popup, teardown } = setup();

      fixture.componentInstance.popOut();
      popup.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      const whileVisible = vi.getTimerCount();

      Object.defineProperty(popup.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      popup.document.dispatchEvent(new Event('visibilitychange'));
      fixture.detectChanges();

      expect(vi.getTimerCount()).toBeLessThan(whileVisible);

      teardown();
    });
  });
});
