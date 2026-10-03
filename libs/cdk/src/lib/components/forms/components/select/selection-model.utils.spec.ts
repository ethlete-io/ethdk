import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SelectionModel } from './selection-model.utils';

type Opt = { id: number; label: string; disabled?: boolean };

const createModel = <T>() => runInInjectionContext(TestBed.inject(Injector), () => new SelectionModel<T>());

const opts: [Opt, Opt, Opt, Opt] = [
  { id: 0, label: 'Zero' },
  { id: 1, label: 'One' },
  { id: 2, label: 'Two' },
  { id: 3, label: 'Three' },
];

const objectModel = (options: Opt[] = opts) =>
  createModel<Opt>().setOptions(options).setValueBinding('id').setLabelBinding('label').setDisabledBinding('disabled');

describe('SelectionModel', () => {
  describe('falsy primitive options', () => {
    it('keeps 0 as the first and selected option', async () => {
      const model = createModel<number>().setOptions([0, 1, 2]);

      expect(model.getFirstOption()).toBe(0);
      expect(model.getOptionByIndex(0)).toBe(0);

      model.setSelectionFromValue(0);

      expect(model.selection).toEqual([0]);
      expect(model.getNonMultipleSelectedOption()).toBe(0);
      expect(await firstValueFrom(model.value$)).toBe(0);
    });

    it('keeps an empty string option selected', async () => {
      const model = createModel<string>().setOptions(['', 'a']);

      model.setSelectionFromValue('');

      expect(model.selection).toEqual(['']);
      expect(await firstValueFrom(model.value$)).toBe('');
    });

    it('keeps a single 0 selection when multiple is turned off', () => {
      const model = createModel<number>().setOptions([0, 1]).setAllowMultiple(true);

      model.setSelection([0, 1]);
      model.setAllowMultiple(false);

      expect(model.selection).toEqual([0]);
    });

    it('clears the selection for a value that matches no option', () => {
      const model = createModel<number>().setOptions([0, 1]);

      model.setSelection(1);
      model.setSelectionFromValue(5);

      expect(model.selection).toEqual([]);
    });

    it('returns null for an index out of range', () => {
      const model = createModel<number>().setOptions([0]);

      expect(model.getOptionByIndex(1)).toBeNull();
      expect(model.getOptionByIndex(-1)).toBeNull();
      expect(createModel<number>().getFirstOption()).toBeNull();
      expect(createModel<number>().getLastOption()).toBeNull();
    });
  });

  describe('getOptionByOffset', () => {
    it('moves within range', () => {
      const model = objectModel();

      expect(model.getOptionByOffset(1, 0)).toBe(opts[1]);
      expect(model.getOptionByOffset(-2, 3)).toBe(opts[1]);
      expect(model.getOptionByOffset(0, 2)).toBe(opts[2]);
    });

    it('clamps to the edges by default', () => {
      const model = objectModel();

      expect(model.getOptionByOffset(-10, 1)).toBe(opts[0]);
      expect(model.getOptionByOffset(10, 1)).toBe(opts[3]);
    });

    it('returns null past the edges without clamp or loop', () => {
      const model = objectModel();

      expect(model.getOptionByOffset(-1, 0, {})).toBeNull();
      expect(model.getOptionByOffset(1, 3, {})).toBeNull();
    });

    it('wraps around with loop', () => {
      const model = objectModel();

      expect(model.getOptionByOffset(-1, 0, { loop: true })).toBe(opts[3]);
      expect(model.getOptionByOffset(1, 3, { loop: true })).toBe(opts[0]);
      expect(model.getOptionByOffset(-6, 1, { loop: true })).toBe(opts[3]);
      expect(model.getOptionByOffset(9, 2, { loop: true })).toBe(opts[3]);
    });

    it('returns null for empty options', () => {
      const model = objectModel([]);

      expect(model.getOptionByOffset(1, 0)).toBeNull();
      expect(model.getOptionByOffset(1, 0, { loop: true })).toBeNull();
    });

    it('uses the options passed in the config', () => {
      const model = objectModel();
      const subset = [opts[2], opts[3]];

      expect(model.getOptionByOffset(1, 0, { options: subset })).toBe(opts[3]);
      expect(model.getOptionByOffset(5, 0, { options: subset, clamp: true })).toBe(opts[3]);
      expect(model.getOptionByOffset(-5, 1, { options: subset, clamp: true })).toBe(opts[2]);
    });

    it('skips disabled options in the direction of travel', () => {
      const model = objectModel([
        { id: 0, label: 'Zero' },
        { id: 1, label: 'One', disabled: true },
        { id: 2, label: 'Two' },
      ]);

      expect(model.getOptionByOffset(1, 0, { skipDisabled: true })?.id).toBe(2);
      expect(model.getOptionByOffset(-1, 2, { skipDisabled: true })?.id).toBe(0);
    });

    it('does not recurse forever when the clamped edge is disabled', () => {
      const model = objectModel([
        { id: 0, label: 'Zero' },
        { id: 1, label: 'One', disabled: true },
      ]);

      expect(model.getOptionByOffset(10, 0, { skipDisabled: true, clamp: true })?.id).toBe(0);
    });

    it('falls back to the nearest enabled option when the clamped edge is disabled', () => {
      const model = objectModel([
        { id: 0, label: 'Zero', disabled: true },
        { id: 1, label: 'One' },
        { id: 2, label: 'Two' },
        { id: 3, label: 'Three', disabled: true },
      ]);

      expect(model.getOptionByOffset(10, 1, { skipDisabled: true, clamp: true })?.id).toBe(2);
      expect(model.getOptionByOffset(-10, 2, { skipDisabled: true, clamp: true })?.id).toBe(1);
    });

    it('does not recurse forever when every option is disabled', () => {
      const model = objectModel([
        { id: 0, label: 'Zero', disabled: true },
        { id: 1, label: 'One', disabled: true },
      ]);

      expect(model.getOptionByOffset(1, 0, { skipDisabled: true, loop: true })).toBeNull();
    });
  });

  describe('getFilteredOptions', () => {
    it('returns every option for an empty or whitespace filter', () => {
      const model = objectModel();

      model.setFilter('   ');

      expect(model.filter).toBe('');
      expect(model.getFilteredOptions()).toEqual(opts);

      model.setFilter(null);

      expect(model.getFilteredOptions()).toEqual(opts);
    });

    it('matches every word case-insensitively', () => {
      const model = createModel<{ label: string }>()
        .setLabelBinding('label')
        .setOptions([{ label: 'New York' }, { label: 'York' }, { label: 'Newark' }]);

      expect(model.getFilteredOptions('york  NEW').map((o) => o.label)).toEqual(['New York']);
    });

    it('drops options without a string label', () => {
      const model = createModel<{ label: unknown }>()
        .setLabelBinding('label')
        .setOptions([{ label: null }, { label: 5 }, { label: 'five' }]);

      expect(model.getFilteredOptions('f')).toEqual([{ label: 'five' }]);
    });
  });

  describe('selection', () => {
    it('does not add a duplicate in multiple mode', () => {
      const model = objectModel().setAllowMultiple(true);

      model.addSelectedOption(opts[0]);
      model.addSelectedOption({ ...opts[0] });

      expect(model.selection).toEqual([opts[0]]);
    });

    it('removes an equal option by key', () => {
      const model = objectModel().setAllowMultiple(true);

      model.setSelection([opts[0], opts[1]]);
      model.removeSelectedOption({ ...opts[0] });

      expect(model.selection).toEqual([opts[1]]);
    });

    it('maps array values to options and drops unknown ones', () => {
      const model = objectModel().setAllowMultiple(true);

      model.setSelectionFromValue([0, 9, 2]);

      expect(model.selection).toEqual([opts[0], opts[2]]);
    });

    it('toggles every filtered option on and then off', () => {
      const model = objectModel().setAllowMultiple(true);

      model.setSelection([opts[0]]);
      model.toggleAllSelectedOptions();

      expect(model.selection.map((o) => o.id)).toEqual([0, 1, 2, 3]);

      model.toggleAllSelectedOptions();

      expect(model.selection).toEqual([]);
    });

    it('returns a null option index for an unknown option', () => {
      const model = objectModel();

      expect(model.getOptionIndex({ id: 99, label: 'x' })).toBeNull();
      expect(model.getOptionIndex(opts[0])).toBe(0);
    });
  });
});
