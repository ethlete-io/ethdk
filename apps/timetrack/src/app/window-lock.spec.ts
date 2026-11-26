import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HOST_PORTS, HostPorts, HostShellMissingError, WindowLockState } from '../host';
import { injectWindowLock } from './window-lock';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

const UNLOCKED_CAPABLE: WindowLockState = { locked: true, promptsItself: false, available: true };

const setup = (windowLock: {
  state$?: () => Observable<WindowLockState>;
  unlock$?: (password?: string) => Observable<boolean>;
  lock$?: () => Observable<void>;
  agentsWaiting$?: () => Observable<number>;
}) => {
  const ports = {
    windowLock: {
      state$: windowLock.state$ ?? (() => of(UNLOCKED_CAPABLE)),
      unlock$: windowLock.unlock$ ?? (() => of(true)),
      lock$: windowLock.lock$ ?? (() => of(undefined)),
      agentsWaiting$: windowLock.agentsWaiting$ ?? (() => of(0)),
    },
  } as unknown as HostPorts;

  const injector = createEnvironmentInjector(
    [{ provide: HOST_PORTS, useValue: ports }],
    Injector.NULL as EnvironmentInjector,
  );

  return { lock: runInInjectionContext(injector, () => injectWindowLock()), injector };
};

describe('injectWindowLock', () => {
  it('unlocks on a verified password', () => {
    const { lock, injector } = setup({});

    lock.unlock('secret');

    expect(lock.isLocked()).toBe(false);
    expect(lock.isChecking()).toBe(false);
    expect(lock.wasRefused()).toBe(false);
    injector.destroy();
  });

  it('stays locked and says so on a wrong password', () => {
    const { lock, injector } = setup({ unlock$: () => of(false) });

    lock.unlock('wrong');

    expect(lock.isLocked()).toBe(true);
    expect(lock.wasRefused()).toBe(true);
    expect(lock.isChecking()).toBe(false);
    injector.destroy();
  });

  it('stops checking when the unlock call fails, so the user can try again', () => {
    const attempts: (string | undefined)[] = [];
    let fail = true;
    const { lock, injector } = setup({
      unlock$: (password) => {
        attempts.push(password);

        return fail ? throwError(() => new Error('PAM unavailable')) : of(true);
      },
    });

    lock.unlock('secret');

    expect(lock.failure()).toBe('PAM unavailable');
    expect(lock.isChecking()).toBe(false);
    expect(lock.isLocked()).toBe(true);

    fail = false;
    lock.unlock('secret');

    expect(attempts).toEqual(['secret', 'secret']);
    expect(lock.isLocked()).toBe(false);
    expect(lock.failure()).toBeNull();
    injector.destroy();
  });

  it('drops a second unlock while the first is still being checked', () => {
    const answer$ = new Subject<boolean>();
    const attempts: (string | undefined)[] = [];
    const { lock, injector } = setup({
      unlock$: (password) => {
        attempts.push(password);

        return answer$;
      },
    });

    lock.unlock('one');
    lock.unlock('two');

    expect(lock.isChecking()).toBe(true);
    expect(attempts).toEqual(['one']);

    answer$.next(true);
    answer$.complete();

    expect(lock.isLocked()).toBe(false);
    injector.destroy();
  });

  it('says an agent waits for as long as the host counts one', () => {
    const waiting$ = new Subject<number>();
    const { lock, injector } = setup({ agentsWaiting$: () => waiting$ });

    expect(lock.isAgentWaiting()).toBe(false);

    waiting$.next(2);
    expect(lock.isAgentWaiting()).toBe(true);

    waiting$.next(0);
    expect(lock.isAgentWaiting()).toBe(false);
    injector.destroy();
  });

  it('opens a window with no host behind it', () => {
    const { lock, injector } = setup({ state$: () => throwError(() => new HostShellMissingError()) });

    expect(lock.ready()).toBe(true);
    expect(lock.isLocked()).toBe(false);
    injector.destroy();
  });

  it('keeps the window locked when a present host fails to answer', () => {
    const { lock, injector } = setup({ state$: () => throwError(() => new Error('store closed')) });

    expect(lock.ready()).toBe(true);
    expect(lock.isLocked()).toBe(true);
    expect(lock.failure()).toBe('store closed');
    injector.destroy();
  });
});
