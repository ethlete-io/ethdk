import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { createFormChangesTracker } from './form-changes-tracker.util';

const track = <T extends FormControl | FormGroup>(form: T) =>
  TestBed.runInInjectionContext(() => createFormChangesTracker({ form }));

describe('createFormChangesTracker', () => {
  it('reports no changes for an untouched form', () => {
    const tracker = track(new FormGroup({ name: new FormControl('Ada') }));

    expect(tracker.hasChanges()).toBe(false);
  });

  it('reports changes once a value differs from the default', () => {
    const form = new FormGroup({ name: new FormControl('Ada') });
    const tracker = track(form);

    form.setValue({ name: 'Grace' });

    expect(tracker.hasChanges()).toBe(true);
  });

  it('reports a control cleared to null as a change', () => {
    const form = new FormControl<string | null>('abc');
    const tracker = track(form);

    form.setValue(null);

    expect(tracker.hasChanges()).toBe(true);
  });

  it('reports no changes after the value is set back to the default', () => {
    const form = new FormGroup({ name: new FormControl('Ada') });
    const tracker = track(form);

    form.setValue({ name: 'Grace' });
    form.setValue({ name: 'Ada' });

    expect(tracker.hasChanges()).toBe(false);
  });

  it.each([
    ['an empty string', 'text', ''],
    ['zero', 5, 0],
    ['false', true, false],
  ])('reports changes when a control is changed to %s', (_, initial, next) => {
    const control = new FormControl<unknown>(initial);
    const tracker = track(control);

    control.setValue(next);

    expect(tracker.hasChanges()).toBe(true);
  });

  it('treats a compareFn returning true as "equal"', () => {
    const form = new FormControl('Ada');
    const tracker = TestBed.runInInjectionContext(() =>
      createFormChangesTracker({ form, compareFn: (a, b) => a?.toLowerCase() === b?.toLowerCase() }),
    );

    form.setValue('ADA');
    expect(tracker.hasChanges()).toBe(false);

    form.setValue('Grace');
    expect(tracker.hasChanges()).toBe(true);
  });

  it('restores the default value and clears changes', () => {
    const form = new FormGroup({ name: new FormControl('Ada') });
    const tracker = track(form);

    form.setValue({ name: 'Grace' });
    tracker.restoreDefaultFormValue();

    expect(form.getRawValue()).toEqual({ name: 'Ada' });
    expect(tracker.hasChanges()).toBe(false);
  });

  it('adopts the current value as the new default on refresh', () => {
    const form = new FormGroup({ name: new FormControl('Ada') });
    const tracker = track(form);

    form.setValue({ name: 'Grace' });
    tracker.refreshDefaultFormValue();

    expect(tracker.defaultFormValue()).toEqual({ name: 'Grace' });
    expect(tracker.hasChanges()).toBe(false);
  });
});
