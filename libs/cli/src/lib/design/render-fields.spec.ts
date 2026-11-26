import { describe, expect, it } from 'vitest';
import { buildFields } from './render-fields';

const build = async (specs: Parameters<typeof buildFields>[0]['specs']) => {
  await import('@angular/compiler');

  const core = await import('@angular/core');
  const forms = await import('@angular/forms/signals');
  const injector = core.createEnvironmentInjector(
    [
      { provide: core.ɵINJECTOR_SCOPE, useValue: 'root' },
      { provide: core.ɵChangeDetectionScheduler, useValue: { notify: () => undefined, runningTick: false } },
    ],
    core.Injector.NULL as never,
  );

  return core.runInInjectionContext(injector, () =>
    buildFields({ specs, forms: forms as never, signal: core.signal }),
  ) as unknown as Record<string, ReturnType<typeof forms.form<unknown>>>;
};

describe('buildFields', () => {
  it('builds one field per spec with its value, errors and touched state', async () => {
    const fields = await build({
      email: { value: 'a@b', errors: ['required', { kind: 'email', message: 'Not an email' }], touched: true },
      name: { value: 'Ada' },
    });
    const email = fields['email']?.();
    const name = fields['name']?.();

    expect(email?.value()).toBe('a@b');
    expect(email?.errors().map(({ kind, message }) => ({ kind, message }))).toEqual([
      { kind: 'required', message: undefined },
      { kind: 'email', message: 'Not an email' },
    ]);
    expect(email?.touched()).toBe(true);
    expect(email?.invalid()).toBe(true);
    expect(name?.value()).toBe('Ada');
    expect(name?.errors()).toEqual([]);
    expect(name?.touched()).toBe(false);
  });
});
