import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectNotificationManager, provideNotificationManager } from '@ethlete/components';
import { Observable, Subject } from 'rxjs';
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

const mount = async (answers: Answers, remembered: string, openRequests$?: Observable<string>) => {
  stubHost(answers);

  const picks: string[] = [];
  const injector = createEnvironmentInjector(provideNotificationManager(), TestBed.inject(EnvironmentInjector));
  const checkouts = runInInjectionContext(injector, () =>
    createCheckouts({ remembered, pick: (checkout) => picks.push(checkout), openRequests$ }),
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

  it('switches to a checkout an agent asked Studio to open, and keeps the others', async () => {
    const requests = new Subject<string>();
    let kept = ['/dev/alpha'];
    const { checkouts, picks } = await mount(
      { design_roots: () => ({ search: '', roots: kept }) },
      '/dev/alpha',
      requests,
    );

    kept = ['/dev/alpha', '/dev/beta'];
    requests.next('/dev/beta');
    await settle();

    expect(checkouts.current()).toBe('/dev/beta');
    expect(checkouts.names()).toEqual(['alpha', 'beta']);
    expect(picks).toEqual(['/dev/alpha', '/dev/beta']);
  });

  it('names a Windows checkout by its folder, and picks a checkout by that name', async () => {
    const { checkouts, picks } = await mount(keeping(['C:\\Users\\user\\dev\\alpha', '/dev/beta']), '');

    checkouts.chooseByName('beta');

    expect(checkouts.names()).toEqual(['alpha', 'beta']);
    expect(checkouts.current()).toBe('/dev/beta');
    expect(picks).toEqual(['C:\\Users\\user\\dev\\alpha', '/dev/beta']);
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

  describe('forget', () => {
    const forgetting = (roots: string[]) => {
      const forgotten: string[] = [];

      return {
        forgotten,
        answers: {
          design_roots: () => ({ search: '', roots }),
          design_roots_forget: ({ checkout }: Record<string, unknown>) => {
            forgotten.push(String(checkout));

            return { search: '', roots: roots.filter((root) => root !== checkout) };
          },
        } satisfies Answers,
      };
    };

    it('forgets the shown checkout and shows the first one left', async () => {
      const { forgotten, answers } = forgetting(['/dev/alpha', '/dev/beta', '/dev/gamma']);
      const { checkouts, picks } = await mount(answers, '/dev/beta');

      checkouts.forget();
      await settle();

      expect(forgotten).toEqual(['/dev/beta']);
      expect(checkouts.names()).toEqual(['alpha', 'gamma']);
      expect(checkouts.current()).toBe('/dev/alpha');
      expect(picks).toEqual(['/dev/beta', '/dev/alpha']);
    });

    it('keeps the only checkout', async () => {
      const { forgotten, answers } = forgetting(['/dev/alpha']);
      const { checkouts } = await mount(answers, '');

      checkouts.forget();
      await settle();

      expect(forgotten).toEqual([]);
      expect(checkouts.current()).toBe('/dev/alpha');
    });
  });

  describe('scan', () => {
    const scanning = (found: string[], search = '') => {
      const added: string[] = [];
      const searched: string[] = [];
      let roots = ['/dev/alpha'];

      return {
        added,
        searched,
        answers: {
          design_roots: () => ({ search, roots }),
          design_roots_search: ({ folder }: Record<string, unknown>) => {
            searched.push(String(folder));

            return { search: folder, roots };
          },
          design_scan: () => found,
          design_roots_add: ({ checkout }: Record<string, unknown>) => {
            added.push(String(checkout));
            roots = [...roots, String(checkout)].sort();

            return { search, roots };
          },
        } satisfies Answers,
      };
    };

    it('keeps the two checkouts next to the shown one and names the folder it walked', async () => {
      const { added, searched, answers } = scanning(['/dev/alpha', '/dev/beta', '/dev/gamma']);
      const { checkouts, picks, manager } = await mount(answers, '');

      checkouts.scan();
      await settle();

      expect(searched).toEqual(['/dev']);
      expect(added).toEqual(['/dev/beta', '/dev/gamma']);
      expect(checkouts.names()).toEqual(['alpha', 'beta', 'gamma']);
      expect(picks).toEqual(['/dev/alpha']);
      expect(manager.notifications().map((ref) => ref.entry().config)).toEqual([
        expect.objectContaining({ status: 'success', title: '2 Checkouts gefunden' }),
      ]);
    });

    it('keeps nothing when the walk finds only kept checkouts, and walks the named folder', async () => {
      const { added, searched, answers } = scanning(['/dev/alpha'], '/work');
      const { checkouts, manager } = await mount(answers, '');

      checkouts.scan();
      await settle();

      expect(searched).toEqual([]);
      expect(added).toEqual([]);
      expect(manager.notifications().map((ref) => ref.entry().config)).toEqual([
        expect.objectContaining({ status: 'success', title: 'Keine neuen Checkouts gefunden' }),
      ]);
    });

    it('shows the error toast when the walk fails', async () => {
      const { answers } = scanning([]);
      const { checkouts, manager } = await mount(
        { ...answers, design_scan: () => Promise.reject(new Error('not a directory')) },
        '',
      );

      checkouts.scan();
      await settle();

      expect(manager.notifications().map((ref) => ref.entry().config)).toEqual([
        expect.objectContaining({ status: 'error', title: 'Checkouts nicht durchsucht' }),
      ]);
    });
  });
});
