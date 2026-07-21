import { Injector, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { form, FieldTree } from '@angular/forms/signals';
import { of } from 'rxjs';
import { createUnsavedChangesGuard } from './unsaved-changes-guard';
import { createUnsavedChangesTracker, CreateUnsavedChangesTrackerConfig } from './unsaved-changes-tracker';

type Model = { name: string };

describe('unsaved-changes', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  const makeTracker = <T>(config: CreateUnsavedChangesTrackerConfig<T>) =>
    runInInjectionContext(injector, () => createUnsavedChangesTracker(config));

  const makeForm = (value: Model): FieldTree<Model> => runInInjectionContext(injector, () => form(signal(value)));

  describe('FieldTree source', () => {
    it('is clean at the initial value and dirty after an edit', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => true });
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(false);

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(true);
    });

    it('is clean again when edited back to the default value (snapshot, not dirty())', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => true });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(true);

      tree().value.set({ name: 'Ada' });
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(false);
    });

    it('refreshDefaultValue re-baselines to the current value', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => true });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(true);

      tracker.refreshDefaultValue();
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(false);
    });

    it('restoreDefaultValue writes the default back onto the field', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => true });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      tracker.restoreDefaultValue();
      TestBed.tick();

      expect(tree().value()).toEqual({ name: 'Ada' });
      expect(tracker.hasChanges()).toBe(false);
    });
  });

  describe('runCheck', () => {
    it('resolves true without calling confirm when there are no changes', async () => {
      const tree = makeForm({ name: 'Ada' });
      const confirm = vi.fn(() => false);
      const tracker = makeTracker({ source: tree, confirm });
      TestBed.tick();

      await expect(tracker.runCheck()).resolves.toBe(true);
      expect(confirm).not.toHaveBeenCalled();
    });

    it('runs confirm when dirty and normalizes a boolean result', async () => {
      const tree = makeForm({ name: 'Ada' });
      const confirm = vi.fn(() => true);
      const tracker = makeTracker({ source: tree, confirm });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      await expect(tracker.runCheck()).resolves.toBe(true);
      expect(confirm).toHaveBeenCalledWith({ name: 'Grace' });
    });

    it('normalizes a Promise confirm result', async () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => Promise.resolve(false) });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      await expect(tracker.runCheck()).resolves.toBe(false);
    });

    it('normalizes an Observable confirm result', async () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, confirm: () => of(true) });
      TestBed.tick();

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      await expect(tracker.runCheck()).resolves.toBe(true);
    });
  });

  describe('AbstractControl source', () => {
    it('tracks changes and restores the default', () => {
      const control = new FormControl('Ada', { nonNullable: true });
      const tracker = makeTracker({ source: control, confirm: () => true });
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(false);

      control.setValue('Grace');
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(true);

      tracker.restoreDefaultValue();
      TestBed.tick();
      expect(control.value).toBe('Ada');
      expect(tracker.hasChanges()).toBe(false);
    });
  });

  describe('WritableSignal source', () => {
    it('tracks changes and restores the default', () => {
      const value: WritableSignal<string> = signal('Ada');
      const tracker = makeTracker({ source: value, confirm: () => true });
      TestBed.tick();

      value.set('Grace');
      expect(tracker.hasChanges()).toBe(true);

      tracker.restoreDefaultValue();
      expect(value()).toBe('Ada');
      expect(tracker.hasChanges()).toBe(false);
    });
  });

  describe('Signal<FieldTree | null> source (late/async form)', () => {
    it('stays clean until the field exists, then baselines its first value', () => {
      const treeSignal = signal<FieldTree<Model> | null>(null);
      const tracker = makeTracker({ source: treeSignal, confirm: () => true });
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(false);

      const tree = makeForm({ name: 'Ada' });
      treeSignal.set(tree);
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(false);

      tree().value.set({ name: 'Grace' });
      TestBed.tick();
      expect(tracker.hasChanges()).toBe(true);
    });
  });

  describe('explicit defaultValue', () => {
    it('compares against the provided default instead of the first value', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, defaultValue: { name: 'Grace' }, confirm: () => true });
      TestBed.tick();

      // current value differs from the explicit default → dirty from the start
      expect(tracker.hasChanges()).toBe(true);
      expect(tracker.defaultValue()).toEqual({ name: 'Grace' });
    });

    it('accepts a default factory', () => {
      const tree = makeForm({ name: 'Ada' });
      const tracker = makeTracker({ source: tree, defaultValue: () => ({ name: 'Ada' }), confirm: () => true });
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(false);
    });
  });

  describe('createUnsavedChangesGuard', () => {
    it('canDeactivate mirrors runCheck', async () => {
      const tree = makeForm({ name: 'Ada' });
      const guard = runInInjectionContext(injector, () =>
        createUnsavedChangesGuard({ source: tree, confirm: () => false }),
      );
      TestBed.tick();

      // clean → may deactivate
      await expect(guard.canDeactivate()).resolves.toBe(true);

      tree().value.set({ name: 'Grace' });
      TestBed.tick();

      // dirty + confirm returns false → may not deactivate
      await expect(guard.canDeactivate()).resolves.toBe(false);
    });
  });
});
