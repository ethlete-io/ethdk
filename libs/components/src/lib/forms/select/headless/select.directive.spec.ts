import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import '../../../../test-helpers';
import { flushFrames, focusEvent, textOf, tick } from '../../../testing/driver-core';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { describeExpandedStateContract } from '../../testing/expanded-contract';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { SelectDriver, mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select
      [value]="value()"
      [disabled]="disabled()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (touchedChange)="touched.set($event)"
      class="select"
      placeholder="Pick a fruit"
    >
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
      <et-select-option disabled value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SelectTestHost {
  value = signal<unknown>(null);
  touched = signal(false);
  disabled = signal(false);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
}

@Component({
  template: `
    <et-form-field>
      <et-label>Fruit</et-label>
      <et-select placeholder="Pick a fruit">
        <et-select-option value="apple">Apple</et-select-option>
      </et-select>
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
class SelectInFormFieldTestHost {}

@Component({
  template: `
    <et-select [formField]="demoForm.value" [mixed]="mixed()" placeholder="Pick a fruit">
      <et-select-option value="apple">Apple</et-select-option>
    </et-select>
  `,
  imports: [FormField, SELECT_IMPORTS],
})
class MixedRequiredTestHost {
  model = signal<{ value: string | null }>({ value: null });
  mixed = signal(true);

  demoForm = form(this.model, (schema) => {
    required(schema.value);
  });
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [readonly]="readonly()"
      [mixed]="mixed()"
      [maxSelection]="maxSelection()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      class="select"
      multiple
      placeholder="Pick fruits"
    >
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
      <et-select-option value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class MultiSelectTestHost {
  value = signal<unknown>([]);
  readonly = signal(false);
  mixed = signal(false);
  maxSelection = signal<number | undefined>(undefined);
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      class="select"
      placeholder="Pick a fruit"
    >
      <ng-template etSelectValue let-entries>
        <span class="custom-value">{{ entries.length ? '🍏 ' + entries[0].label : 'none' }}</span>
      </ng-template>
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class CustomValueTestHost {
  value = signal<unknown>('apple');
  mixed = signal(false);
}

@Component({
  template: `
    <et-select [value]="value()" (valueChange)="value.set($event)" class="select" placeholder="Pick a country">
      <input etSelectSearch placeholder="Search" />
      <ng-template etSelectValue let-entries>
        @for (entry of entries; track entry.value) {
          <span class="custom-value">🇩🇪 {{ entry.label }}</span>
        }
      </ng-template>
      <et-select-option label="Germany" value="de"><span>🇩🇪</span> Germany</et-select-option>
      <et-select-option label="France" value="fr"><span>🇫🇷</span> France</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SearchableCustomValueTestHost {
  value = signal<unknown>('de');
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [allowCustomValues]="allowCustom()"
      [customValueSeparators]="separators()"
      [normalizeCustomValue]="normalize()"
      [commitCustomValueOnClose]="commitOnClose()"
      [maxSelection]="maxSelection()"
      [allowAddNew]="allowAddNew()"
      [multiple]="multiple()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [loading]="loading()"
      [error]="error()"
      [hasMoreItems]="hasMore()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (queryChange)="queries.push($event)"
      (loadMore)="loadMoreCount = loadMoreCount + 1"
      (addNew)="addNewQueries.push($event)"
      class="select"
      placeholder="Pick a fruit"
    >
      <input etSelectSearch placeholder="Search" />
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
      <et-select-option value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SearchSelectTestHost {
  value = signal<unknown>(null);
  allowCustom = signal(false);
  separators = signal<string[]>([',']);
  normalize = signal<(raw: string) => string | null>((raw) => {
    const trimmed = raw.trim();

    return trimmed.length ? trimmed : null;
  });
  commitOnClose = signal(false);
  maxSelection = signal<number | undefined>(undefined);
  allowAddNew = signal(false);
  multiple = signal(false);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  queries: string[] = [];
  addNewQueries: string[] = [];
  loadMoreCount = 0;
}

@Component({
  template: `
    <et-select [value]="value()" (valueChange)="value.set($event)" class="select" placeholder="Pick a country">
      <input etSelectSearch />
      <et-select-option value="de">Germany</et-select-option>
      <et-select-option value="fr">France</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SearchPlaceholderTestHost {
  value = signal<unknown>(null);
}

@Component({
  template: `
    <div [value]="value()" (valueChange)="value.set($event)" etSelect placeholder="Pick a fruit">
      <button etSelectTrigger type="button">Open</button>
      <ng-template etSelectSurface>
        <et-select-panel>
          <input etSelectSearch />
          <div etSelectOption value="apple">Apple</div>
          <div etSelectOption value="banana">Banana</div>
        </et-select-panel>
      </ng-template>
    </div>
  `,
  imports: [SELECT_IMPORTS],
})
class PanelSearchTestHost {
  value = signal<unknown>('apple');
}

@Component({
  template: `
    <et-select
      [value]="value()"
      (valueChange)="value.set($event)"
      (pickOption)="picked.push($event)"
      class="select"
      pickOnly
      placeholder="Pick a fruit"
    >
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class PickOnlyTestHost {
  value = signal<unknown>(null);
  picked: unknown[] = [];
}

@Component({
  template: `
    <et-select [value]="value()" (pickOption)="pick($event)" class="select" pickOnly multiple placeholder="Add a fruit">
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class MultiPickOnlyTestHost {
  value = signal<unknown[]>([]);
  picked: unknown[] = [];

  pick(value: unknown) {
    this.picked.push(value);
    this.value.update((values) => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]));
  }
}

describe('SelectDirective', () => {
  let driver: SelectDriver<SelectTestHost>;

  beforeEach(() => {
    driver = mountSelect(SelectTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders a closed combobox trigger', () => {
    expect(driver.trigger().getAttribute('role')).toBe('combobox');
    expect(driver.trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('false');
    expect(driver.listbox()).toBeNull();
  });

  it('registers projected options while closed and shows the selected label in the trigger', () => {
    expect(driver.select.selection.items().length).toBe(3);

    driver.host.value.set('banana');
    driver.detectChanges();

    expect(driver.select.displayValue()).toBe('Banana');
  });

  it('masks the raw value, exposes an empty selection, and resolves a same-value commit', async () => {
    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.host.mixedLabel.set('Various fruits');
    driver.detectChanges();

    expect(driver.select.value()).toBe('banana');
    expect(driver.select.hasValue()).toBe(true);
    expect(driver.select.displayValue()).toBe('Various fruits');
    expect(driver.select.selectedEntries()).toEqual([]);
    expect(driver.element().getAttribute('data-mixed')).toBe('true');
    expect(driver.valueText()).toBe('Various fruits');

    await driver.open();

    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false']);
    expect(driver.options().every((option) => !option.hasAttribute('aria-checked'))).toBe(true);
    expect(driver.activeLabel()).toBe('Apple');

    driver.clickOption(1);

    expect(driver.host.value()).toBe('banana');
    expect(driver.host.mixed()).toBe(false);
    expect(driver.select.displayValue()).toBe('Banana');
  });

  it('keeps required validation on the raw value while mixed presents content', () => {
    const requiredFixture = TestBed.createComponent(MixedRequiredTestHost);

    requiredFixture.detectChanges();
    tick();

    expect(requiredFixture.componentInstance.demoForm.value().invalid()).toBe(true);

    requiredFixture.componentInstance.model.set({ value: 'apple' });
    requiredFixture.detectChanges();
    tick();

    expect(requiredFixture.componentInstance.demoForm.value().invalid()).toBe(false);
  });

  it('clears mixed to null but preserves mixed across external value writes', () => {
    driver.host.value.set('apple');
    driver.host.mixed.set(true);
    driver.detectChanges();

    driver.host.value.set('banana');
    driver.detectChanges();

    expect(driver.host.mixed()).toBe(true);
    expect(driver.select.displayValue()).toBe('Mixed');

    driver.host.mixed.set(false);
    driver.detectChanges();

    expect(driver.select.displayValue()).toBe('Banana');
    expect(driver.select.selectedEntries().map((entry) => entry.value)).toEqual(['banana']);

    driver.host.mixed.set(true);
    driver.detectChanges();

    driver.select.clearValue();
    tick();

    expect(driver.host.value()).toBeNull();
    expect(driver.host.mixed()).toBe(false);
  });

  it('opens on trigger click without moving focus off the trigger', async () => {
    driver.trigger().focus();
    await driver.open();

    expect(driver.select.open()).toBe(true);
    expect(driver.listbox()).not.toBeNull();
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');
    expect(driver.trigger().getAttribute('aria-controls')).toBe(driver.listbox()!.id);
    expect(document.activeElement).toBe(driver.trigger());
  });

  it('moves virtual focus with arrow keys and reflects it in aria-activedescendant', async () => {
    await driver.open();

    // initial virtual focus lands on the first enabled option
    expect(driver.activeLabel()).toBe('Apple');
    expect(driver.trigger().getAttribute('aria-activedescendant')).toBe(driver.activeOption()!.id);

    driver.press('ArrowDown');

    expect(driver.activeLabel()).toBe('Banana');
    expect(driver.trigger().getAttribute('aria-activedescendant')).toBe(driver.activeOption()!.id);

    // the disabled option is skipped and there is no wrap past the last enabled one
    driver.press('ArrowDown');
    expect(driver.activeLabel()).toBe('Banana');

    driver.press('Home');
    expect(driver.activeLabel()).toBe('Apple');
  });

  it('commits the active option with Enter and closes', async () => {
    await driver.open();

    driver.press('ArrowDown');
    driver.press('Enter');
    await driver.settle();

    expect(driver.host.value()).toBe('banana');
    expect(driver.select.open()).toBe(false);
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('commits an option on click and closes', async () => {
    await driver.open();

    driver.clickOption(1);
    await driver.settle();

    expect(driver.host.value()).toBe('banana');
    expect(driver.select.open()).toBe(false);
  });

  it('does not commit disabled options', async () => {
    await driver.open();

    driver.clickOption(2);

    expect(driver.host.value()).toBeNull();
    expect(driver.select.open()).toBe(true);
  });

  it('closes on Escape without committing', async () => {
    await driver.open();
    await flushFrames();

    driver.escape();
    await driver.settle();

    expect(driver.select.open()).toBe(false);
    expect(driver.host.value()).toBeNull();
  });

  it('selects via closed typeahead without opening', () => {
    driver.press('b');

    expect(driver.host.value()).toBe('banana');
    expect(driver.select.open()).toBe(false);
  });

  it('resolves mixed via closed typeahead without opening', () => {
    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.detectChanges();

    driver.press('a');

    expect(driver.host.value()).toBe('apple');
    expect(driver.host.mixed()).toBe(false);
    expect(driver.select.open()).toBe(false);
  });

  it('marks the aria-selected option when open', async () => {
    driver.host.value.set('apple');
    driver.detectChanges();

    await driver.open();

    expect(driver.options()[0]!.getAttribute('aria-selected')).toBe('true');
    expect(driver.options()[1]!.getAttribute('aria-selected')).toBe('false');

    // initial virtual focus prefers the selected option
    expect(driver.activeLabel()).toBe('Apple');
  });

  it('does not open while disabled', async () => {
    driver.host.disabled.set(true);
    driver.detectChanges();

    driver.click(driver.trigger());
    await flushFrames();

    expect(driver.select.open()).toBe(false);
  });

  it('sets touched on trigger blur', () => {
    focusEvent(driver.trigger(), 'focus');
    focusEvent(driver.trigger(), 'blur');

    expect(driver.host.touched()).toBe(true);
  });

  it('manages focusability on the non-button trigger', () => {
    expect(driver.trigger().tagName).not.toBe('BUTTON');
    expect(driver.trigger().getAttribute('tabindex')).toBe('0');

    driver.host.disabled.set(true);
    driver.detectChanges();

    expect(driver.trigger().getAttribute('tabindex')).toBe('-1');
    expect(driver.trigger().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('SelectDirective (multiple)', () => {
  let driver: SelectDriver<MultiSelectTestHost>;

  beforeEach(() => {
    driver = mountSelect(MultiSelectTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('marks the listbox multiselectable', async () => {
    await driver.open();

    expect(driver.paneEl('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('toggles values on click and stays open', async () => {
    await driver.open();

    driver.clickOption(0);
    driver.clickOption(2);

    expect(driver.host.value()).toEqual(['apple', 'cherry']);
    expect(driver.select.open()).toBe(true);

    driver.clickOption(0);

    expect(driver.host.value()).toEqual(['cherry']);
    expect(driver.select.open()).toBe(true);
  });

  it('renders selected values as removable chips in the trigger', () => {
    driver.host.value.set(['apple', 'banana']);
    driver.detectChanges();

    expect(driver.chipLabels()).toEqual(['Apple', 'Banana']);

    driver.removeChip(0);

    expect(driver.host.value()).toEqual(['banana']);
    // removing a chip must not toggle the panel
    expect(driver.select.open()).toBe(false);
  });

  it('shows the placeholder while nothing is selected', () => {
    expect(driver.valueText()).toBe('Pick fruits');
    expect(driver.chips().length).toBe(0);
  });

  it('masks multi chips, replaces on first commit, then toggles and clears normally', async () => {
    driver.host.value.set(['banana', 'cherry']);
    driver.host.mixed.set(true);
    driver.detectChanges();

    expect(driver.select.value()).toEqual(['banana', 'cherry']);
    expect(driver.select.displayValue()).toBe('Mixed');
    expect(driver.chips().length).toBe(0);

    await driver.open();

    driver.clickOption(0);

    expect(driver.host.value()).toEqual(['apple']);
    expect(driver.host.mixed()).toBe(false);
    expect(driver.select.open()).toBe(true);

    driver.clickOption(1);

    expect(driver.host.value()).toEqual(['apple', 'banana']);
    driver.host.mixed.set(true);
    driver.detectChanges();

    driver.select.clearValue();
    tick();

    expect(driver.host.value()).toEqual([]);
    expect(driver.host.mixed()).toBe(false);
  });

  it('applies maxSelection to the effective mixed selection, including zero', async () => {
    driver.host.value.set(['apple', 'banana']);
    driver.host.mixed.set(true);
    driver.host.maxSelection.set(1);
    driver.detectChanges();

    expect(driver.select.isFull()).toBe(false);

    await driver.open();

    expect(driver.options().every((option) => option.getAttribute('aria-disabled') !== 'true')).toBe(true);

    driver.clickOption(2);

    expect(driver.host.value()).toEqual(['cherry']);
    expect(driver.host.mixed()).toBe(false);
    expect(driver.select.isFull()).toBe(true);
    expect(driver.options()[0]!.getAttribute('aria-disabled')).toBe('true');
    expect(driver.options()[2]!.hasAttribute('aria-disabled')).toBe(false);

    driver.host.value.set(['apple', 'banana']);
    driver.host.mixed.set(true);
    driver.host.maxSelection.set(0);
    driver.detectChanges();

    expect(driver.select.isFull()).toBe(true);

    expect(driver.options().every((option) => option.getAttribute('aria-disabled') === 'true')).toBe(true);

    driver.clickOption(0);

    expect(driver.host.value()).toEqual(['apple', 'banana']);
    expect(driver.host.mixed()).toBe(true);
  });

  it('renders readonly chips without the remove affordance and without the disabled look', () => {
    driver.host.value.set(['apple']);
    driver.host.readonly.set(true);
    driver.detectChanges();

    expect(driver.chipRemoveButton(0)).toBeNull();
    expect(driver.chips()[0]!.hasAttribute('data-disabled')).toBe(false);
  });

  it('keeps the trigger chips out of the tab order', () => {
    driver.host.value.set(['apple']);
    driver.detectChanges();

    expect(driver.chipRemoveButton(0)?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('SelectDirective (search)', () => {
  let driver: SelectDriver<SearchSelectTestHost>;

  const stateRow = () => driver.paneEl('.et-select-state');
  const busyBar = () => driver.paneEl('.et-select-busy-bar');
  const loadingContent = () => driver.paneEl('.et-select-state-content');

  // past signalDeferredLoading's delay, so the indicator the panel defers has turned on
  const settleIndicator = async () => {
    await new Promise((resolve) => setTimeout(resolve, 260));
    tick();
  };

  beforeEach(() => {
    driver = mountSelect(SearchSelectTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders the search input inline in the trigger and focuses it on open', async () => {
    const input = driver.searchInput();

    expect(input.closest('.et-select-trigger')).not.toBeNull();
    // the input owns the combobox role; the trigger container drops it
    expect(input.getAttribute('role')).toBe('combobox');
    expect(driver.query('.et-select-trigger')?.getAttribute('role')).toBeNull();

    await driver.open();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('selects the mixed label on open and restores it when Escape cancels search', async () => {
    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.host.mixedLabel.set('Various fruits');
    driver.detectChanges();

    expect(driver.searchInput().value).toBe('Various fruits');

    await driver.open();

    expect(driver.searchInput().selectionStart).toBe(0);
    expect(driver.searchInput().selectionEnd).toBe('Various fruits'.length);

    driver.type('ap');

    expect(driver.host.mixed()).toBe(true);
    expect(driver.searchInput().value).toBe('ap');

    driver.escape();

    expect(driver.select.query()).toBe('');
    expect(driver.host.mixed()).toBe(true);
    expect(driver.host.value()).toBe('banana');
    expect(driver.searchInput().value).toBe('Various fruits');
    expect(driver.searchInput().selectionStart).toBe(0);
    expect(driver.searchInput().selectionEnd).toBe('Various fruits'.length);
  });

  it('clears mixed when the single display text is erased but ignores Backspace on the empty multi input', async () => {
    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.detectChanges();

    await driver.open();
    driver.type('');

    expect(driver.host.value()).toBeNull();
    expect(driver.host.mixed()).toBe(false);

    driver.host.multiple.set(true);
    driver.host.value.set(['apple', 'banana']);
    driver.host.mixed.set(true);
    driver.select.describedBy.set('search-hint');
    driver.detectChanges();

    const mixedLabelId = driver.valueEl()?.id ?? '';

    expect(mixedLabelId).not.toBe('');
    expect(driver.searchInput().getAttribute('aria-describedby')?.split(' ')).toEqual(['search-hint', mixedLabelId]);

    // no visible chip to delete - Backspace must not silently clear the hidden raw selection
    driver.searchInput().value = '';
    driver.pressInSearch('Backspace');

    expect(driver.host.value()).toEqual(['apple', 'banana']);
    expect(driver.host.mixed()).toBe(true);
  });

  it('opens the panel when the user starts typing', () => {
    driver.type('a');

    expect(driver.select.open()).toBe(true);
  });

  it('filters options against the query and emits queryChange', async () => {
    await driver.open();

    driver.type('an');

    expect(driver.host.queries).toEqual(['an']);
    expect(driver.visibleOptions().map((option) => option.textContent?.trim())).toEqual(['Banana']);
    expect(driver.select.visibleItems().map((item) => item.label())).toEqual(['Banana']);
  });

  it('reconciles virtual focus when the active option is filtered away', async () => {
    await driver.open();

    // initial active: Apple
    expect(driver.activeLabel()).toBe('Apple');

    driver.type('cher');

    expect(driver.activeLabel()).toBe('Cherry');
  });

  it('freezes the panel filter while the panel closes', async () => {
    await driver.open();

    driver.type('ban');
    expect(driver.select.visibleItems().map((item) => item.label())).toEqual(['Banana']);

    // closing clears the query (trigger display) but must NOT unfilter the closing panel
    driver.select.hide();
    tick();

    expect(driver.select.query()).toBe('');
    expect(driver.select.visibleItems().map((item) => item.label())).toEqual(['Banana']);
    expect(driver.visibleOptions().length).toBe(1);
  });

  it('commits the active option with Enter from the search input', async () => {
    await driver.open();

    driver.type('ban');
    driver.pressInSearch('Enter');
    await driver.settle();

    expect(driver.host.value()).toBe('banana');
    expect(driver.select.open()).toBe(false);
  });

  it('clears the query on the first Escape and closes on the second', async () => {
    await driver.open();
    await flushFrames();

    driver.type('ap');
    expect(driver.select.query()).toBe('ap');

    driver.escape();

    expect(driver.select.query()).toBe('');
    expect(driver.select.open()).toBe(true);
    expect(driver.host.queries).toEqual(['ap', '']);

    driver.escape();

    expect(driver.select.open()).toBe(false);
  });

  it('commits a custom value with Enter when no option matches', async () => {
    driver.host.allowCustom.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('kiwi');
    // no regular option matches - only the "Create …" row remains, holding virtual focus
    expect(driver.visibleOptions().length).toBe(1);
    expect(driver.visibleOptions()[0]!.classList.contains('et-select-create-option')).toBe(true);
    expect(driver.activeOption()).toBe(driver.visibleOptions()[0]);

    driver.pressInSearch('Enter');
    await driver.settle();

    expect(driver.host.value()).toBe('kiwi');
    expect(driver.select.open()).toBe(false);
    expect(driver.select.displayValue()).toBe('kiwi');
  });

  it('resolves mixed on custom commit but preserves it when add-new hands off the query', async () => {
    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.host.allowCustom.set(true);
    driver.detectChanges();

    await driver.open();
    driver.type('kiwi');
    driver.pressInSearch('Enter');
    await driver.settle();

    expect(driver.host.value()).toBe('kiwi');
    expect(driver.host.mixed()).toBe(false);

    driver.host.value.set('banana');
    driver.host.mixed.set(true);
    driver.host.allowCustom.set(false);
    driver.host.allowAddNew.set(true);
    driver.detectChanges();

    await driver.open();
    driver.type('dragonfruit');

    driver.clickInPane('.et-select-add-new');

    expect(driver.host.addNewQueries).toEqual(['dragonfruit']);
    expect(driver.host.value()).toBe('banana');
    expect(driver.host.mixed()).toBe(true);
  });

  it('offers the "Create …" row while options still match and commits it via arrow keys', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    // "app" matches Apple - previously Enter could only ever commit the option
    driver.type('app');

    const visible = driver.visibleOptions();

    expect(visible.length).toBe(2);
    expect(visible[0]!.textContent).toContain('Apple');
    expect(visible[1]!.classList.contains('et-select-create-option')).toBe(true);
    expect(visible[1]!.textContent).toContain('app');

    // default virtual focus stays on the real option - Enter would pick Apple
    expect(driver.activeOption()).toBe(visible[0]);

    driver.pressInSearch('ArrowDown');
    expect(driver.activeOption()).toBe(visible[1]);

    driver.pressInSearch('Enter');
    tick();

    expect(driver.host.value()).toEqual(['app']);
    // the committed value is its own label, resolved through the label cache
    expect(driver.select.displayValue()).toBe('app');
  });

  it('hides the "Create …" row for duplicate labels and existing selections', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    // exact label match (case-insensitive) - creating "apple" beside Apple is a duplicate
    driver.type('apple');
    expect(driver.visibleOptions().length).toBe(1);
    expect(driver.visibleOptions()[0]!.classList.contains('et-select-create-option')).toBe(false);

    // an already-selected custom value must not be offered again
    driver.type('kiwi');
    driver.pressInSearch('Enter');
    tick();
    expect(driver.host.value()).toEqual(['kiwi']);

    driver.type('kiwi');
    expect(driver.visibleOptions().length).toBe(0);
  });

  it('commits custom values on separator characters while typing', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('kiwi,');
    expect(driver.host.value()).toEqual(['kiwi']);
    expect(driver.searchInput().value).toBe('');
    expect(driver.select.query()).toBe('');

    // a rejected commit (duplicate) keeps the pending text minus the separator for editing
    driver.type('kiwi,');
    expect(driver.host.value()).toEqual(['kiwi']);
    expect(driver.searchInput().value).toBe('kiwi');
    expect(driver.select.query()).toBe('kiwi');
  });

  it('splits pasted text on separators and newlines into custom values', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    driver.paste('kiwi, mango\nkiwi');

    // split on the comma and the newline, trimmed by the normalizer, duplicate dropped
    expect(driver.host.value()).toEqual(['kiwi', 'mango']);
  });

  it('commits the pending query when the panel closes with commitCustomValueOnClose', async () => {
    driver.host.allowCustom.set(true);
    driver.host.commitOnClose.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('kiwi');
    await driver.close();

    expect(driver.host.value()).toEqual(['kiwi']);

    // Escape clears the query before the close - it must never commit
    await driver.open();
    driver.type('mango');
    driver.escape();
    driver.escape();
    await flushFrames();

    expect(driver.host.value()).toEqual(['kiwi']);
  });

  it('does not re-commit the leftover query over a picked option on close', async () => {
    driver.host.allowCustom.set(true);
    driver.host.commitOnClose.set(true);
    driver.detectChanges();

    await driver.open();

    // "ban" filters to Banana; Enter picks the option - the close must not turn the
    // leftover "ban" query into a custom value overwriting it
    driver.type('ban');
    driver.pressInSearch('Enter');
    tick();
    await flushFrames();

    expect(driver.host.value()).toBe('banana');
    expect(driver.select.open()).toBe(false);
  });

  it('enforces maxSelection and locks the search input while full', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.host.maxSelection.set(2);
    driver.detectChanges();

    await driver.open();

    driver.type('kiwi');
    driver.pressInSearch('Enter');
    tick();
    driver.type('mango');
    driver.pressInSearch('Enter');
    tick();

    expect(driver.host.value()).toEqual(['kiwi', 'mango']);
    expect(driver.select.isFull()).toBe(true);
    expect(driver.searchInput().readOnly).toBe(true);

    // both the custom path and the option path reject further adds
    expect(driver.select.commitCustomValue('papaya')).toBe(false);
    driver.visibleOptions()[0]!.click();
    tick();
    expect(driver.host.value()).toEqual(['kiwi', 'mango']);

    // deselecting frees a slot and unlocks the input
    driver.select.deselectValue('kiwi');
    tick();
    expect(driver.select.isFull()).toBe(false);
    expect(driver.searchInput().readOnly).toBe(false);
  });

  it('renders unselected options as disabled while full and keeps the selected ones deselectable', async () => {
    driver.host.multiple.set(true);
    driver.host.maxSelection.set(2);
    driver.detectChanges();

    await driver.open();

    driver.clickOptionByLabel('Apple');
    driver.clickOptionByLabel('Banana');

    expect(driver.select.isFull()).toBe(true);
    expect(driver.optionByLabel('Cherry')!.getAttribute('aria-disabled')).toBe('true');
    expect(driver.optionByLabel('Apple')!.hasAttribute('aria-disabled')).toBe(false);

    // clicking a full option is a no-op
    driver.clickOptionByLabel('Cherry');
    expect(driver.host.value()).toEqual(['apple', 'banana']);

    // keyboard navigation skips full options like any other disabled option
    expect(driver.select.enabledItems().length).toBe(2);

    // deselecting re-enables the remaining options
    driver.clickOptionByLabel('Apple');
    expect(driver.select.isFull()).toBe(false);
    expect(driver.optionByLabel('Cherry')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('runs custom values through the normalizeCustomValue hook', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.host.normalize.set((raw: string) => {
      const tag = raw.trim().toLowerCase();

      return tag.startsWith('x') ? null : tag;
    });
    driver.detectChanges();

    await driver.open();

    driver.type('  KiWi  ');
    driver.pressInSearch('Enter');
    tick();

    expect(driver.host.value()).toEqual(['kiwi']);

    // rejected by the hook - no create row, Enter commits nothing
    driver.type('xyz');
    expect(driver.visibleOptions().length).toBe(0);
    driver.pressInSearch('Enter');
    tick();

    expect(driver.host.value()).toEqual(['kiwi']);
  });

  it('keeps committed custom values when an option is picked afterwards', async () => {
    driver.host.allowCustom.set(true);
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('kiwi');
    driver.pressInSearch('Enter');
    tick();

    expect(driver.host.value()).toEqual(['kiwi']);

    // pick a regular option from the panel - the custom value must survive
    driver.clickOption(0);

    expect(driver.host.value()).toEqual(['kiwi', 'apple']);
  });

  it('Backspace on an empty input deletes the last selected value', async () => {
    driver.host.multiple.set(true);
    driver.host.value.set(['apple', 'banana']);
    driver.detectChanges();

    const backspace = () => {
      driver.pressInSearch('Backspace');
    };

    backspace();
    expect(driver.host.value()).toEqual(['apple']);

    backspace();
    expect(driver.host.value()).toEqual([]);

    // nothing selected - backspace is a no-op
    backspace();
    expect(driver.host.value()).toEqual([]);
  });

  it('clears the query when a multi commit adds a value', async () => {
    driver.host.multiple.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('ban');
    driver.clickInPane('[role="option"]:not([data-filtered])');

    expect(driver.host.value()).toEqual(['banana']);
    expect(driver.searchInput().value).toBe('');
    expect(driver.select.query()).toBe('');

    // toggling the same value off while searching keeps the query (pruning flow)
    driver.type('ban');
    driver.clickInPane('[role="option"]:not([data-filtered])');

    expect(driver.host.value()).toEqual([]);
    expect(driver.select.query()).toBe('ban');
  });

  it('displays the selected label inside the input (single select) and selects it on open', async () => {
    driver.host.value.set('banana');
    driver.detectChanges();

    // closed: the input doubles as the value display
    expect(driver.searchInput().value).toBe('Banana');

    await driver.open();

    // open: the label is text-selected so typing replaces it
    const input = driver.searchInput();
    expect(input.value).toBe('Banana');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Banana'.length);

    // editing replaces the display with the query
    driver.type('ap');
    expect(input.value).toBe('ap');

    // Escape reverts the query without touching the selection
    driver.escape();
    expect(driver.host.value()).toBe('banana');

    // closing restores the label display
    await driver.close();
    expect(driver.searchInput().value).toBe('Banana');
  });

  it('erasing all input text deselects the value (single select)', async () => {
    driver.host.value.set('banana');
    driver.detectChanges();

    await driver.open();

    // the user deletes the displayed label entirely
    driver.type('');

    expect(driver.host.value()).toBeNull();
    expect(driver.searchInput().value).toBe('');

    // closing shows the placeholder, not a stale label
    await driver.close();

    expect(driver.host.value()).toBeNull();
    expect(driver.searchInput().value).toBe('');
  });

  it('holds the loading row empty until the wait is worth reporting', async () => {
    await driver.open();

    // no option matches, so there is nothing on screen the row would replace
    driver.type('zzz');
    driver.host.loading.set(true);
    driver.detectChanges();

    // the row is there from the first frame (it reserves the height the options will need) but says
    // nothing yet, and it keeps the empty state from claiming the panel
    expect(stateRow()?.classList.contains('et-select-state--loading')).toBe(true);
    expect(loadingContent()?.classList.contains('et-select-state-content--visible')).toBe(false);
    expect(loadingContent()?.getAttribute('aria-hidden')).toBe('true');

    await settleIndicator();

    expect(stateRow()?.classList.contains('et-select-state--loading')).toBe(true);
    expect(loadingContent()?.classList.contains('et-select-state-content--visible')).toBe(true);
    expect(loadingContent()?.getAttribute('aria-hidden')).toBeNull();
    expect(loadingContent()?.textContent?.trim()).toBe('Loading…');
  });

  it('runs a busy bar over options already on screen instead of replacing them', async () => {
    await driver.open();

    driver.host.loading.set(true);
    driver.detectChanges();

    expect(stateRow()).toBeNull();
    expect(driver.visibleOptions().length).toBe(3);
    expect(busyBar()).toBeNull();

    await settleIndicator();

    expect(busyBar()).not.toBeNull();
    expect(stateRow()).toBeNull();
    expect(driver.visibleOptions().length).toBe(3);
  });

  it('turns the load-more control into a loading row in its own place, without a busy bar', async () => {
    driver.host.hasMore.set(true);
    await driver.open();

    const loadMoreButton = () => driver.paneEl<HTMLButtonElement>('button.et-select-load-more');
    const loadMoreLoading = () => driver.paneEl<HTMLElement>('.et-select-load-more--loading');

    expect(loadMoreButton()?.disabled).toBe(false);

    const heightBefore = loadMoreButton()!.getBoundingClientRect().height;

    loadMoreButton()!.click();
    driver.host.loading.set(true);
    driver.detectChanges();

    // until the wait is worth reporting the control stays, disabled - a live-looking no-op reads
    // as broken
    expect(loadMoreButton()?.disabled).toBe(true);
    expect(loadMoreLoading()).toBeNull();

    await settleIndicator();

    // the control's own box reports the wait; the busy bar stays out of it
    expect(loadMoreButton()).toBeNull();
    expect(loadMoreLoading()?.textContent?.trim()).toBe('Loading…');
    expect(loadMoreLoading()!.getBoundingClientRect().height).toBe(heightBefore);
    expect(busyBar()).toBeNull();
  });

  it('runs the busy bar for a refetch the reader did not ask for by loading more', async () => {
    driver.host.hasMore.set(true);
    await driver.open();

    driver.host.loading.set(true);
    driver.detectChanges();
    await settleIndicator();

    expect(busyBar()).not.toBeNull();
    expect(driver.paneEl('.et-select-load-more--loading')).toBeNull();
  });

  it('renders the error and empty states', async () => {
    await driver.open();

    driver.host.error.set('Something broke');
    driver.detectChanges();
    expect(stateRow()?.classList.contains('et-select-state--error')).toBe(true);
    expect(stateRow()?.textContent?.trim()).toBe('Something broke');

    driver.host.error.set(null);
    driver.detectChanges();
    driver.type('zzz');
    expect(stateRow()?.classList.contains('et-select-state--empty')).toBe(true);
  });

  it('emits loadMore from the load-more control', async () => {
    driver.host.hasMore.set(true);
    driver.detectChanges();

    await driver.open();

    driver.clickInPane('.et-select-load-more');

    expect(driver.host.loadMoreCount).toBe(1);
  });

  it('emits addNew with the current query from the add-new row and closes', async () => {
    driver.host.allowAddNew.set(true);
    driver.detectChanges();

    await driver.open();

    driver.type('drag');

    driver.clickInPane('.et-select-add-new');

    expect(driver.host.addNewQueries).toEqual(['drag']);
    expect(driver.select.open()).toBe(false);
  });

  it('marks pointer-set virtual focus as such (the highlight only paints while hovered)', async () => {
    await driver.open();

    // initial virtual focus comes from the open logic - keyboard-grade, always highlighted
    expect(driver.activeOption()?.getAttribute('data-active-source')).toBe('keyboard');

    const banana = driver.visibleOptions()[1]!;

    driver.hover(banana);

    expect(driver.activeLabel()).toBe('Banana');
    expect(driver.activeOption()?.getAttribute('data-active-source')).toBe('pointer');

    driver.pressInSearch('ArrowDown');

    expect(driver.activeLabel()).toBe('Cherry');
    expect(driver.activeOption()?.getAttribute('data-active-source')).toBe('keyboard');
  });
});

describe('SelectDirective (search placeholder)', () => {
  it('carries the select placeholder on an inline search without one of its own', () => {
    const driver = mountSelect(SearchPlaceholderTestHost);
    const input = driver.searchInput();

    tick();

    expect(input.placeholder).toBe('Pick a country');

    driver.host.value.set('de');
    driver.detectChanges();
    tick();

    // the input now displays the selected label - a placeholder behind it would be dead weight
    expect(input.value).toBe('Germany');
    expect(input.placeholder).toBe('');
  });

  it('leaves a search input that brings its own placeholder alone', () => {
    const driver = mountSelect(SearchSelectTestHost);

    tick();

    expect(driver.searchInput().placeholder).toBe('Search');
  });
});

describe('SelectDirective (panel-hosted search)', () => {
  let driver: SelectDriver<PanelSearchTestHost>;

  beforeEach(() => {
    driver = mountSelect(PanelSearchTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('is a pure query box - never displays the selected value, erasing does not deselect', async () => {
    await driver.open();

    const input = driver.searchInput();

    // a trigger-inline search would show "Apple" here (value display); the panel search must not
    expect(input.value).toBe('');
    // and it does not take over the select's placeholder either - that belongs to the trigger
    expect(input.placeholder).toBe('');

    driver.type('ban');
    driver.type('');

    expect(driver.host.value()).toBe('apple');
  });
});

describe('SelectDirective (custom value template)', () => {
  it('renders the etSelectValue template instead of the default value display', () => {
    const driver = mountSelect(CustomValueTestHost);

    tick();

    expect(textOf(driver.query('.custom-value'))).toBe('🍏 Apple');
    expect(driver.valueEl()).toBeNull();
  });

  it('lets the mixed label override the custom value template', () => {
    const driver = mountSelect(CustomValueTestHost);

    driver.host.mixed.set(true);
    driver.detectChanges();
    tick();

    expect(driver.query('.custom-value')).toBeNull();
    expect(driver.valueText()).toBe('Mixed');
  });
});

describe('SelectDirective (searchable custom value)', () => {
  let driver: SelectDriver<SearchableCustomValueTestHost>;

  const customValue = () => driver.query('.custom-value');

  beforeEach(() => {
    driver = mountSelect(SearchableCustomValueTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders the rich value template beside the input instead of the label inside it', () => {
    expect(customValue()?.textContent?.trim()).toBe('🇩🇪 Germany');
    // the input is a pure query box - the label never gets written into it
    expect(driver.searchInput().value).toBe('');
  });

  it('hides the value template while editing and restores it on blur', async () => {
    driver.select.show();
    tick();
    await driver.settle();

    driver.type('fr');

    expect(customValue()).toBeNull();
    expect(driver.searchInput().value).toBe('fr');

    await driver.close();

    // the combobox keeps focus after the close - still edit mode, so the editable label
    // (not the query) shows and the rich display stays hidden
    expect(customValue()).toBeNull();
    expect(driver.searchInput().value).toBe('Germany');

    // leaving the field settles the value: the rich template comes back, input goes empty
    focusEvent(driver.searchInput(), 'blur');

    expect(customValue()?.textContent?.trim()).toBe('🇩🇪 Germany');
    expect(driver.searchInput().value).toBe('');
  });

  it('edits the label text on Backspace while focused instead of nuking the value', () => {
    // focusing enters edit mode: the rich display gives way to the editable label in the input
    focusEvent(driver.searchInput(), 'focus');

    expect(driver.searchInput().value).toBe('Germany');
    expect(customValue()).toBeNull();

    // Backspace now has text to delete - it removes a character (native), it does not wipe the
    // whole option the way a lone Backspace on an empty box would
    driver.pressInSearch('Backspace');

    expect(driver.host.value()).toBe('de');
  });

  it('renders a clear control while focused that clears the selection', () => {
    // no focus yet - the control stays hidden despite the value
    expect(driver.query('.et-input-clear')).toBeNull();

    focusEvent(driver.searchInput(), 'focus');

    const clear = driver.query<HTMLButtonElement>('.et-input-clear')!;

    expect(clear).not.toBeNull();
    expect(clear.getAttribute('aria-label')).toBe('Clear');
    expect(clear.getAttribute('tabindex')).toBe('-1');

    driver.click(clear);

    expect(driver.host.value()).toBeNull();
    // gone without a value, and the panel did not toggle open
    expect(driver.query('.et-input-clear')).toBeNull();
    expect(driver.select.open()).toBe(false);
  });

  it('deselects when the editable label is erased to empty while focused', async () => {
    focusEvent(driver.searchInput(), 'focus');
    driver.select.show();
    tick();
    await driver.settle();

    // edit mode shows the editable label; erasing it clears the selection like a plain
    // searchable single select (the rich display only owns the resting, blurred state)
    driver.type('fr');
    driver.type('');

    expect(driver.host.value()).toBeNull();
  });
});

describe('SelectDirective (single)', () => {
  describeMixedStateContract(() => {
    const driver = mountSelect(SelectTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set('banana');
        driver.host.mixed.set(true);
        driver.detectChanges();
      },
      rawValue: () => 'banana',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('cherry');
        driver.detectChanges();
      },
      externallyWrittenValue: () => 'cherry',
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.detectChanges();
      },
      mixedLabel: () => driver.host.mixedLabel(),
      mixedDisplayText: () => driver.select.displayValue() ?? '',
      // closed typeahead - a real keyboard commit that needs no open panel
      commit: () => {
        driver.press('a');
      },
      committedValue: () => 'apple',
      assertMasked: () => {
        expect(driver.select.displayValue()).toBe('Mixed');
        expect(driver.select.selectedEntries()).toEqual([]);
      },
      clear: () => {
        driver.select.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});

describe('SelectDirective (multiple, contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountSelect(MultiSelectTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set(['banana', 'cherry']);
        driver.host.mixed.set(true);
        driver.detectChanges();
      },
      rawValue: () => ['banana', 'cherry'],
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set(['apple']);
        driver.detectChanges();
      },
      externallyWrittenValue: () => ['apple'],
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.detectChanges();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.select.displayValue() ?? '',
      commit: () => {
        driver.press('a');
      },
      // replace semantics: a fresh array around the committed option, not a toggle
      committedValue: () => ['apple'],
      assertMasked: () => {
        expect(driver.select.displayValue()).toBe('Mixed');
        expect(driver.chips().length).toBe(0);
      },
      clear: () => {
        driver.select.clearValue();
        tick();
      },
      emptyValue: () => [],
    };
  });
});

describe('SelectDirective (pickOnly)', () => {
  let driver: SelectDriver<PickOnlyTestHost>;

  beforeEach(() => {
    driver = mountSelect(PickOnlyTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('emits pickOption without retaining the value and still closes', async () => {
    await driver.open();

    driver.clickOption(1);
    await driver.settle();

    expect(driver.host.picked).toEqual(['banana']);
    expect(driver.host.value()).toBeNull();
    expect(driver.select.hasValue()).toBe(false);
    expect(driver.select.open()).toBe(false);
  });

  it('re-emits on each pick without accumulating a selection', async () => {
    await driver.open();
    driver.clickOption(0);
    await driver.settle();

    await driver.open();
    driver.clickOption(1);
    await driver.settle();

    expect(driver.host.picked).toEqual(['apple', 'banana']);
    expect(driver.host.value()).toBeNull();
  });
});

describe('SelectDirective (pickOnly, multiple)', () => {
  let driver: SelectDriver<MultiPickOnlyTestHost>;

  beforeEach(() => {
    driver = mountSelect(MultiPickOnlyTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('keeps the panel open across repeated picks', async () => {
    await driver.open();

    driver.clickOption(1);
    await driver.settle();

    expect(driver.host.picked).toEqual(['banana']);
    expect(driver.select.open()).toBe(true);

    driver.clickOption(0);
    await driver.settle();

    expect(driver.host.picked).toEqual(['banana', 'apple']);
    expect(driver.select.open()).toBe(true);
  });

  it('checks the options a bound value covers without displaying them in the field', async () => {
    await driver.open();

    driver.clickOption(1);
    await driver.settle();

    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(driver.host.value()).toEqual(['banana']);
    expect(driver.select.hasValue()).toBe(false);
    expect(driver.select.displayValue()).toBeNull();
    expect(driver.chips().length).toBe(0);
  });

  it('emits again for an already picked option instead of toggling it itself', async () => {
    await driver.open();

    driver.clickOption(0);
    await driver.settle();

    driver.clickOption(0);
    await driver.settle();

    expect(driver.host.picked).toEqual(['apple', 'apple']);
    expect(driver.options()[0]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('SelectDirective (in form field)', () => {
  describeExpandedStateContract(() => {
    const driver = mountSelect(SelectInFormFieldTestHost, [], { directiveSelector: 'et-select' });

    return {
      open: () => driver.open(),
      close: () => driver.close(),
      trigger: () => driver.trigger(),
      field: () => driver.query('et-form-field')!,
    };
  });
});
