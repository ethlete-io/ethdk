import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { firstValueFrom, Observable, of } from 'rxjs';
import { createNavigationDismissChecker } from './navigation-dismiss-checker';

const create = (form: FormControl<unknown>, dismissCheckFn = vi.fn(() => of(false))) =>
  TestBed.runInInjectionContext(() => createNavigationDismissChecker({ form, dismissCheckFn }));

describe('createNavigationDismissChecker', () => {
  it('lets navigation through without asking when nothing changed', async () => {
    const dismissCheckFn = vi.fn(() => of(false));
    const checker = create(new FormControl<unknown>('Ada'), dismissCheckFn);

    expect(await firstValueFrom(checker.runCheck() as Observable<boolean>)).toBe(true);
    expect(dismissCheckFn).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty string', 'text', ''],
    ['zero', 5, 0],
    ['false', true, false],
    ['null', 'text', null],
  ])('asks before dismissing when a control is changed to %s', async (_, initial, next) => {
    const dismissCheckFn = vi.fn(() => of(false));
    const form = new FormControl<unknown>(initial);
    const checker = create(form, dismissCheckFn);

    form.setValue(next);

    expect(checker.hasChanges()).toBe(true);
    expect(await firstValueFrom(checker.runCheck() as Observable<boolean>)).toBe(false);
    expect(dismissCheckFn).toHaveBeenCalledWith(next);
  });
});
