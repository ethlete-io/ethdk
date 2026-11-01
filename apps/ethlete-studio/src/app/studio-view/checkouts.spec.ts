import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectNotificationManager, provideNotificationManager } from '@ethlete/components';
import { createCheckouts } from './checkouts';

type Answers = Record<string, (args: Record<string, unknown>) => unknown>;

const stubHost = (answers: Answers) => {
  let next = 1;

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: (command: string, args: Record<string, unknown>) =>
        command in answers ? Promise.resolve(answers[command]?.(args)) : new Promise(() => undefined),
      transformCallback: () => next++,
      unregisterCallback: () => undefined,
    },
  });
};

const settle = async () => {
  for (let round = 0; round < 5; round++) await new Promise((resolve) => setTimeout(resolve));
};

const mount = async (answers: Answers, remembered: string) => {
  stubHost(answers);

  const picks: string[] = [];
  const injector = createEnvironmentInjector(provideNotificationManager(), TestBed.inject(EnvironmentInjector));
  const checkouts = runInInjectionContext(injector, () =>
    createCheckouts({ remembered, pick: (checkout) => picks.push(checkout) }),
  );

  await settle();

  const manager = runInInjectionContext(injector, () => injectNotificationManager());

  return { checkouts, picks, manager };
};

const keeping = (roots: string[]): Answers => ({ design_roots: () => ({ search: '', roots }) });

describe('createCheckouts', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('picks the remembered checkout, not the first kept one', async () => {
    const { checkouts, picks } = await mount(keeping(['/dev/alpha', '/dev/beta']), '/dev/beta');

    expect(checkouts.current()).toBe('/dev/beta');
    expect(picks).toEqual(['/dev/beta']);
  });

  it('names a Windows checkout by its folder, and picks a checkout by that name', async () => {
    const { checkouts, picks } = await mount(keeping(['C:\\Users\\tom\\dev\\alpha', '/dev/beta']), '');

    checkouts.chooseByName('beta');

    expect(checkouts.names()).toEqual(['alpha', 'beta']);
    expect(checkouts.current()).toBe('/dev/beta');
    expect(picks).toEqual(['C:\\Users\\tom\\dev\\alpha', '/dev/beta']);
  });

  it('keeps the folder picked in the OS dialog and opens it', async () => {
    const added: unknown[] = [];
    const { checkouts, picks } = await mount(
      {
        ...keeping(['/dev/alpha']),
        'plugin:dialog|open': () => '/dev/gamma',
        design_roots_add: ({ checkout }) => {
          added.push(checkout);

          return { search: '', roots: ['/dev/alpha', '/dev/gamma'] };
        },
      },
      '',
    );

    checkouts.openFolder();
    await settle();

    expect(added).toEqual(['/dev/gamma']);
    expect(checkouts.names()).toEqual(['alpha', 'gamma']);
    expect(checkouts.current()).toBe('/dev/gamma');
    expect(picks).toEqual(['/dev/alpha', '/dev/gamma']);
  });

  it('changes nothing when the dialog is cancelled', async () => {
    const { checkouts, picks } = await mount({ ...keeping(['/dev/alpha']), 'plugin:dialog|open': () => null }, '');

    checkouts.openFolder();
    await settle();

    expect(checkouts.current()).toBe('/dev/alpha');
    expect(picks).toEqual(['/dev/alpha']);
  });

  it('shows the error toast and keeps the checkout when the folder has no design work', async () => {
    const { checkouts, picks, manager } = await mount(
      {
        ...keeping(['/dev/alpha']),
        'plugin:dialog|open': () => '/dev/empty',
        design_roots_add: () => Promise.reject(new Error('no design work')),
      },
      '',
    );

    checkouts.openFolder();
    await settle();

    const shown = manager.notifications().map((ref) => ref.entry().config);

    expect(shown).toEqual([expect.objectContaining({ status: 'error', title: 'Ordner nicht geöffnet' })]);
    expect(checkouts.current()).toBe('/dev/alpha');
    expect(picks).toEqual(['/dev/alpha']);
  });
});
