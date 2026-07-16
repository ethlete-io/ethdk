import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectDirective } from './select.directive';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
] as const;

@Component({
  template: `
    <et-select
      [value]="value()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (touchedChange)="touched.set($event)"
      class="select"
      placeholder="Pick a fruit"
    >
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
      <et-select-option [disabled]="true" value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SelectTestHost {
  value = signal<unknown>(null);
  touched = signal(false);
  disabled = signal(false);
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [multiple]="true"
      [readonly]="readonly()"
      (valueChange)="value.set($event)"
      class="select"
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
}

@Component({
  template: `
    <et-select [value]="value()" (valueChange)="value.set($event)" class="select" placeholder="Pick a fruit">
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
      [allowAddNew]="allowAddNew()"
      [multiple]="multiple()"
      [loading]="loading()"
      [error]="error()"
      [hasMoreItems]="hasMore()"
      (valueChange)="value.set($event)"
      (queryChange)="queries.push($event)"
      (loadMoreRequested)="loadMoreCount = loadMoreCount + 1"
      (addNewRequested)="addNewQueries.push($event)"
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
  allowAddNew = signal(false);
  multiple = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  queries: string[] = [];
  addNewQueries: string[] = [];
  loadMoreCount = 0;
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('SelectDirective', () => {
  let fixture: ComponentFixture<SelectTestHost>;
  let select: SelectDirective;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const keydown = (target: EventTarget, key: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    tick();
  };

  const openSelect = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  // overlays render into the document — scope queries to the newest pane so a pane
  // stuck in its leave transition (jsdom fires no transition events) can't pollute them
  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const listbox = () => pane()?.querySelector<HTMLElement>('[role="listbox"]') ?? null;
  const options = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const activeOption = () => pane()?.querySelector<HTMLElement>('[role="option"][data-active]') ?? null;

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [SelectTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(SelectTestHost);
    fixture.detectChanges();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    trigger = fixture.nativeElement.querySelector('[etselecttrigger], [role="combobox"]');
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('renders a closed combobox trigger', () => {
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(listbox()).toBeNull();
  });

  it('registers projected options while closed and shows the selected label in the trigger', () => {
    expect(select.selection.items().length).toBe(3);

    fixture.componentInstance.value.set('banana');
    fixture.detectChanges();

    expect(select.displayValue()).toBe('Banana');
  });

  it('opens on trigger click without moving focus off the trigger', async () => {
    trigger.focus();
    await openSelect();

    expect(select.open()).toBe(true);
    expect(listbox()).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(listbox()!.id);
    expect(document.activeElement).toBe(trigger);
  });

  it('moves virtual focus with arrow keys and reflects it in aria-activedescendant', async () => {
    await openSelect();

    // initial virtual focus lands on the first enabled option
    expect(activeOption()?.textContent?.trim()).toBe('Apple');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(activeOption()!.id);

    keydown(trigger, 'ArrowDown');

    expect(activeOption()?.textContent?.trim()).toBe('Banana');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(activeOption()!.id);

    // the disabled option is skipped and there is no wrap past the last enabled one
    keydown(trigger, 'ArrowDown');
    expect(activeOption()?.textContent?.trim()).toBe('Banana');

    keydown(trigger, 'Home');
    expect(activeOption()?.textContent?.trim()).toBe('Apple');
  });

  it('commits the active option with Enter and closes', async () => {
    await openSelect();

    keydown(trigger, 'ArrowDown');
    keydown(trigger, 'Enter');
    await flushFrames();
    tick();

    expect(fixture.componentInstance.value()).toBe('banana');
    expect(select.open()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('commits an option on click and closes', async () => {
    await openSelect();

    options()[1]!.click();
    tick();
    await flushFrames();
    tick();

    expect(fixture.componentInstance.value()).toBe('banana');
    expect(select.open()).toBe(false);
  });

  it('does not commit disabled options', async () => {
    await openSelect();

    options()[2]!.click();
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(select.open()).toBe(true);
  });

  it('closes on Escape without committing', async () => {
    await openSelect();
    await flushFrames();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();
    await flushFrames();
    tick();

    expect(select.open()).toBe(false);
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('selects via closed typeahead without opening', () => {
    keydown(trigger, 'b');

    expect(fixture.componentInstance.value()).toBe('banana');
    expect(select.open()).toBe(false);
  });

  it('marks the aria-selected option when open', async () => {
    fixture.componentInstance.value.set('apple');
    fixture.detectChanges();

    await openSelect();

    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options()[1]!.getAttribute('aria-selected')).toBe('false');

    // initial virtual focus prefers the selected option
    expect(activeOption()?.textContent?.trim()).toBe('Apple');
  });

  it('does not open while disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    trigger.click();
    tick();
    await flushFrames();

    expect(select.open()).toBe(false);
  });

  it('sets touched on trigger blur', () => {
    trigger.dispatchEvent(new FocusEvent('focus'));
    tick();
    trigger.dispatchEvent(new FocusEvent('blur'));
    tick();

    expect(fixture.componentInstance.touched()).toBe(true);
  });

  it('manages focusability on the non-button trigger', () => {
    expect(trigger.tagName).not.toBe('BUTTON');
    expect(trigger.getAttribute('tabindex')).toBe('0');

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(trigger.getAttribute('tabindex')).toBe('-1');
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('SelectDirective (multiple)', () => {
  let fixture: ComponentFixture<MultiSelectTestHost>;
  let select: SelectDirective;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const options = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

  const openSelect = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [MultiSelectTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(MultiSelectTestHost);
    fixture.detectChanges();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('marks the listbox multiselectable', async () => {
    await openSelect();

    expect(pane()?.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('toggles values on click and stays open', async () => {
    await openSelect();

    options()[0]!.click();
    tick();
    options()[2]!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['apple', 'cherry']);
    expect(select.open()).toBe(true);

    options()[0]!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['cherry']);
    expect(select.open()).toBe(true);
  });

  it('renders selected values as removable chips in the trigger', () => {
    fixture.componentInstance.value.set(['apple', 'banana']);
    fixture.detectChanges();

    const chips = Array.from(trigger.querySelectorAll<HTMLElement>('et-chip'));

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Apple', 'Banana']);

    chips[0]!.querySelector<HTMLElement>('.et-chip-remove-button')!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['banana']);
    // removing a chip must not toggle the panel
    expect(select.open()).toBe(false);
  });

  it('shows the placeholder while nothing is selected', () => {
    expect(trigger.querySelector('.et-select-value')?.textContent?.trim()).toBe('Pick fruits');
    expect(trigger.querySelectorAll('et-chip').length).toBe(0);
  });

  it('renders readonly chips without the remove affordance and without the disabled look', () => {
    fixture.componentInstance.value.set(['apple']);
    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();

    const chip = trigger.querySelector<HTMLElement>('et-chip')!;

    expect(chip.querySelector('.et-chip-remove-button')).toBeNull();
    expect(chip.hasAttribute('data-disabled')).toBe(false);
  });
});

describe('SelectDirective (search)', () => {
  let fixture: ComponentFixture<SearchSelectTestHost>;
  let select: SelectDirective;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  // the search input renders inline in the trigger (combobox pattern), not in the panel
  const searchInput = () => fixture.nativeElement.querySelector('input[etselectsearch]') as HTMLInputElement | null;
  const visibleOptions = () =>
    Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]:not([data-filtered])') ?? []);
  const activeOption = () => pane()?.querySelector<HTMLElement>('[role="option"][data-active]') ?? null;
  const stateRow = () => pane()?.querySelector<HTMLElement>('.et-select-state') ?? null;

  const openSelect = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  const typeQuery = (query: string) => {
    const input = searchInput()!;

    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
  };

  const keydownOnSearch = (key: string) => {
    searchInput()!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [SearchSelectTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(SearchSelectTestHost);
    fixture.detectChanges();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('renders the search input inline in the trigger and focuses it on open', async () => {
    const input = searchInput()!;

    expect(input.closest('.et-select-trigger')).not.toBeNull();
    // the input owns the combobox role; the trigger container drops it
    expect(input.getAttribute('role')).toBe('combobox');
    expect(fixture.nativeElement.querySelector('.et-select-trigger')?.getAttribute('role')).toBeNull();

    await openSelect();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the panel when the user starts typing', () => {
    typeQuery('a');

    expect(select.open()).toBe(true);
  });

  it('filters options against the query and emits queryChange', async () => {
    await openSelect();

    typeQuery('an');

    expect(fixture.componentInstance.queries).toEqual(['an']);
    expect(visibleOptions().map((option) => option.textContent?.trim())).toEqual(['Banana']);
    expect(select.visibleItems().map((item) => item.label())).toEqual(['Banana']);
  });

  it('reconciles virtual focus when the active option is filtered away', async () => {
    await openSelect();

    // initial active: Apple
    expect(activeOption()?.textContent?.trim()).toBe('Apple');

    typeQuery('cher');

    expect(activeOption()?.textContent?.trim()).toBe('Cherry');
  });

  it('freezes the panel filter while the panel closes', async () => {
    await openSelect();

    typeQuery('ban');
    expect(select.visibleItems().map((item) => item.label())).toEqual(['Banana']);

    // closing clears the query (trigger display) but must NOT unfilter the closing panel
    select.hide();
    tick();

    expect(select.query()).toBe('');
    expect(select.visibleItems().map((item) => item.label())).toEqual(['Banana']);
    expect(Array.from(pane()?.querySelectorAll('[role="option"]:not([data-filtered])') ?? []).length).toBe(1);
  });

  it('commits the active option with Enter from the search input', async () => {
    await openSelect();

    typeQuery('ban');
    keydownOnSearch('Enter');
    await flushFrames();
    tick();

    expect(fixture.componentInstance.value()).toBe('banana');
    expect(select.open()).toBe(false);
  });

  it('clears the query on the first Escape and closes on the second', async () => {
    await openSelect();
    await flushFrames();

    typeQuery('ap');
    expect(select.query()).toBe('ap');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();

    expect(select.query()).toBe('');
    expect(select.open()).toBe(true);
    expect(fixture.componentInstance.queries).toEqual(['ap', '']);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();

    expect(select.open()).toBe(false);
  });

  it('commits a custom value with Enter when no option matches', async () => {
    fixture.componentInstance.allowCustom.set(true);
    fixture.detectChanges();

    await openSelect();

    typeQuery('kiwi');
    expect(visibleOptions().length).toBe(0);

    keydownOnSearch('Enter');
    await flushFrames();
    tick();

    expect(fixture.componentInstance.value()).toBe('kiwi');
    expect(select.open()).toBe(false);
    expect(select.displayValue()).toBe('kiwi');
  });

  it('keeps committed custom values when an option is picked afterwards', async () => {
    fixture.componentInstance.allowCustom.set(true);
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();

    await openSelect();

    typeQuery('kiwi');
    keydownOnSearch('Enter');
    tick();

    expect(fixture.componentInstance.value()).toEqual(['kiwi']);

    // pick a regular option from the panel — the custom value must survive
    pane()!.querySelectorAll<HTMLElement>('[role="option"]')[0]!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['kiwi', 'apple']);
  });

  it('Backspace on an empty input deletes the last selected value', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.componentInstance.value.set(['apple', 'banana']);
    fixture.detectChanges();

    const backspace = () => {
      searchInput()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      tick();
    };

    backspace();
    expect(fixture.componentInstance.value()).toEqual(['apple']);

    backspace();
    expect(fixture.componentInstance.value()).toEqual([]);

    // nothing selected — backspace is a no-op
    backspace();
    expect(fixture.componentInstance.value()).toEqual([]);
  });

  it('clears the query when a multi commit adds a value', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();

    await openSelect();

    typeQuery('ban');
    pane()!.querySelector<HTMLElement>('[role="option"]:not([data-filtered])')!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['banana']);
    expect(searchInput()!.value).toBe('');
    expect(select.query()).toBe('');

    // toggling the same value off while searching keeps the query (pruning flow)
    typeQuery('ban');
    pane()!.querySelector<HTMLElement>('[role="option"]:not([data-filtered])')!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual([]);
    expect(select.query()).toBe('ban');
  });

  it('displays the selected label inside the input (single select) and selects it on open', async () => {
    fixture.componentInstance.value.set('banana');
    fixture.detectChanges();

    // closed: the input doubles as the value display
    expect(searchInput()!.value).toBe('Banana');

    await openSelect();

    // open: the label is text-selected so typing replaces it
    const input = searchInput()!;
    expect(input.value).toBe('Banana');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Banana'.length);

    // editing replaces the display with the query
    typeQuery('ap');
    expect(input.value).toBe('ap');

    // Escape reverts the query without touching the selection
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();
    expect(fixture.componentInstance.value()).toBe('banana');

    // closing restores the label display
    select.hide();
    tick();
    await flushFrames();
    tick();
    expect(searchInput()!.value).toBe('Banana');
  });

  it('erasing all input text deselects the value (single select)', async () => {
    fixture.componentInstance.value.set('banana');
    fixture.detectChanges();

    await openSelect();

    // the user deletes the displayed label entirely
    typeQuery('');

    expect(fixture.componentInstance.value()).toBeNull();
    expect(searchInput()!.value).toBe('');

    // closing shows the placeholder, not a stale label
    select.hide();
    tick();
    await flushFrames();
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(searchInput()!.value).toBe('');
  });

  it('renders the loading, error and empty states', async () => {
    await openSelect();

    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect(stateRow()?.classList.contains('et-select-state--loading')).toBe(true);

    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.error.set('Something broke');
    fixture.detectChanges();
    expect(stateRow()?.classList.contains('et-select-state--error')).toBe(true);
    expect(stateRow()?.textContent?.trim()).toBe('Something broke');

    fixture.componentInstance.error.set(null);
    fixture.detectChanges();
    typeQuery('zzz');
    expect(stateRow()?.classList.contains('et-select-state--empty')).toBe(true);
  });

  it('emits loadMoreRequested from the load-more control', async () => {
    fixture.componentInstance.hasMore.set(true);
    fixture.detectChanges();

    await openSelect();

    pane()!.querySelector<HTMLElement>('.et-select-load-more')!.click();
    tick();

    expect(fixture.componentInstance.loadMoreCount).toBe(1);
  });

  it('emits addNewRequested with the current query from the add-new row and closes', async () => {
    fixture.componentInstance.allowAddNew.set(true);
    fixture.detectChanges();

    await openSelect();

    typeQuery('drag');

    pane()!.querySelector<HTMLElement>('.et-select-add-new')!.click();
    tick();

    expect(fixture.componentInstance.addNewQueries).toEqual(['drag']);
    expect(select.open()).toBe(false);
  });

  it('marks pointer-set virtual focus as such (the highlight only paints while hovered)', async () => {
    await openSelect();

    // initial virtual focus comes from the open logic — keyboard-grade, always highlighted
    expect(activeOption()?.getAttribute('data-active-source')).toBe('keyboard');

    const banana = visibleOptions()[1]!;

    banana.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    tick();

    expect(activeOption()?.textContent?.trim()).toBe('Banana');
    expect(activeOption()?.getAttribute('data-active-source')).toBe('pointer');

    keydownOnSearch('ArrowDown');

    expect(activeOption()?.textContent?.trim()).toBe('Cherry');
    expect(activeOption()?.getAttribute('data-active-source')).toBe('keyboard');
  });
});

describe('SelectDirective (custom value template)', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [CustomValueTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
  });

  it('renders the etSelectValue template instead of the default value display', () => {
    const fixture = TestBed.createComponent(CustomValueTestHost);
    fixture.detectChanges();
    tick();

    const trigger = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLElement;

    expect(trigger.querySelector('.custom-value')?.textContent?.trim()).toBe('🍏 Apple');
    expect(trigger.querySelector('.et-select-value')).toBeNull();
  });
});

describe('SelectDirective (searchable custom value)', () => {
  let fixture: ComponentFixture<SearchableCustomValueTestHost>;
  let select: SelectDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const searchInput = () => fixture.nativeElement.querySelector('input[etselectsearch]') as HTMLInputElement;
  const customValue = () => fixture.nativeElement.querySelector('.custom-value') as HTMLElement | null;

  const typeQuery = (query: string) => {
    const input = searchInput();

    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [SearchableCustomValueTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(SearchableCustomValueTestHost);
    fixture.detectChanges();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('renders the rich value template beside the input instead of the label inside it', () => {
    expect(customValue()?.textContent?.trim()).toBe('🇩🇪 Germany');
    // the input is a pure query box — the label never gets written into it
    expect(searchInput().value).toBe('');
  });

  it('hides the value template while typing and restores it after close', async () => {
    select.show();
    tick();
    await flushFrames();
    tick();

    typeQuery('fr');

    expect(customValue()).toBeNull();
    expect(searchInput().value).toBe('fr');

    select.hide();
    tick();
    await flushFrames();
    tick();

    expect(customValue()?.textContent?.trim()).toBe('🇩🇪 Germany');
    expect(searchInput().value).toBe('');
  });

  it('Backspace on the empty query box deletes the selected value', () => {
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(customValue()).toBeNull();
  });

  it('renders a clear control while focused that clears the selection', () => {
    // no focus yet — the control stays hidden despite the value
    expect(fixture.nativeElement.querySelector('.et-select-clear')).toBeNull();

    searchInput().dispatchEvent(new FocusEvent('focus'));
    tick();

    const clear = fixture.nativeElement.querySelector('.et-select-clear') as HTMLButtonElement;

    expect(clear).not.toBeNull();
    expect(clear.getAttribute('aria-label')).toBe('Clear');
    expect(clear.getAttribute('tabindex')).toBe('-1');

    clear.click();
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    // gone without a value, and the panel did not toggle open
    expect(fixture.nativeElement.querySelector('.et-select-clear')).toBeNull();
    expect(select.open()).toBe(false);
  });

  it('does not deselect when the query box is cleared', async () => {
    select.show();
    tick();
    await flushFrames();
    tick();

    typeQuery('fr');
    typeQuery('');

    expect(fixture.componentInstance.value()).toBe('de');
    expect(customValue()?.textContent?.trim()).toBe('🇩🇪 Germany');
  });
});
