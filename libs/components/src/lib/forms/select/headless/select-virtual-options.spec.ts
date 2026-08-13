import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectOptionData } from './select.tokens';
import { SelectDirective } from './select.directive';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

// Deliberately not template literals: an interpolated one above the inline templates below breaks
// Angular language service completions there. See `ethlete/no-template-literal-before-inline-template`.
const makeOptions = (count: number): SelectOptionData[] =>
  Array.from({ length: count }, (_, index) => ({
    value: 'item-' + (index + 1),
    label: 'Item ' + (index + 1),
  }));

@Component({
  template: `
    <et-select
      [value]="value()"
      [options]="options()"
      [multiple]="multiple()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      class="select"
      placeholder="Pick an item"
    >
      <input etSelectSearch placeholder="Search" />
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class VirtualSelectTestHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  mixed = signal(false);
  options = signal<SelectOptionData[]>(makeOptions(200));
}

@Component({
  template: `
    <et-select [value]="value()" [options]="options()" (valueChange)="value.set($event)" class="select">
      <ng-template etSelectOptionTemplate let-option>
        <span class="custom-row">{{ option.label }} ({{ option.tag }})</span>
      </ng-template>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class OptionTemplateTestHost {
  value = signal<unknown>(null);
  options = signal<(SelectOptionData & { tag: string })[]>([
    { value: 'a', label: 'Alpha', tag: 'first' },
    { value: 'b', label: 'Beta', tag: 'second' },
  ]);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('SelectDirective (data-driven options)', () => {
  let fixture: ComponentFixture<VirtualSelectTestHost>;
  let select: SelectDirective;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const openSelect = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const options = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const virtualBody = () => pane()?.querySelector<HTMLElement>('.et-select-virtual-options') ?? null;
  const searchInput = () => fixture.nativeElement.querySelector('input[etselectsearch]') as HTMLInputElement;

  const search = (query: string) => {
    const input = searchInput();

    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [VirtualSelectTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(VirtualSelectTestHost);
    fixture.detectChanges();
    tick();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('registers every option from data and resolves labels without rendering anything', () => {
    expect(select.selection.items().length).toBe(200);
    expect(options().length).toBe(0);

    fixture.componentInstance.value.set('item-150');
    fixture.detectChanges();

    expect(select.displayValue()).toBe('Item 150');
  });

  it('renders only a window of rows, with paddings standing in for the rest', async () => {
    await openSelect();

    const rendered = options();

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(50);
    expect(rendered[0]!.textContent).toContain('Item 1');

    const body = virtualBody()!;

    expect(parseFloat(body.style.paddingBlockStart)).toBe(0);
    expect(parseFloat(body.style.paddingBlockEnd)).toBeGreaterThan(0);
  });

  it('leaves a short list unwindowed: every row rendered, no paddings', async () => {
    fixture.componentInstance.options.set(makeOptions(8));
    fixture.detectChanges();
    tick();

    await openSelect();

    expect(select.windowsOptions()).toBe(false);
    expect(options().length).toBe(8);

    const body = virtualBody()!;

    expect(parseFloat(body.style.paddingBlockStart)).toBe(0);
    expect(parseFloat(body.style.paddingBlockEnd)).toBe(0);
  });

  it('keyboard-navigates the full data set, not just the rendered window', async () => {
    await openSelect();

    // dispatched through the trigger handler: with an inline search input, End/Home stay
    // native caret editing on the input, but search-less selects reach this path directly
    select.handleTriggerKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    tick();

    const active = select.activeItem();

    expect(active?.value()).toBe('item-200');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(active?.id());

    select.handleTriggerKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    tick();

    expect(fixture.componentInstance.value()).toBe('item-200');
  });

  it('commits a clicked rendered row and reflects the selection on it', async () => {
    await openSelect();

    const row = options()[2]!;

    row.click();
    tick();
    await flushFrames();

    expect(fixture.componentInstance.value()).toBe('item-3');

    await openSelect();

    const reopened = options()[2]!;

    expect(reopened.getAttribute('aria-selected')).toBe('true');
    expect(reopened.hasAttribute('data-selected')).toBe(true);
  });

  it('masks a data-driven raw value, clears virtual option selection, and resolves on commit', async () => {
    fixture.componentInstance.value.set('item-150');
    fixture.componentInstance.mixed.set(true);
    fixture.detectChanges();
    tick();

    expect(select.value()).toBe('item-150');
    expect(select.displayValue()).toBe('Mixed');

    await openSelect();

    const rendered = options();

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.every((row) => row.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(select.activeItem()?.value()).toBe('item-1');

    rendered[2]!.click();
    tick();
    await flushFrames();

    expect(fixture.componentInstance.value()).toBe('item-3');
    expect(fixture.componentInstance.mixed()).toBe(false);
  });

  it('filters data options with the internal filter mode', async () => {
    await openSelect();
    search('item 19');

    // "Item 19" and "Item 190"–"Item 199"
    expect(select.visibleItems().length).toBe(11);
    expect(options().length).toBe(11);

    search('no such item');

    expect(options().length).toBe(0);
    expect(pane()?.textContent).toContain('No results');
  });

  it('updates items in place when the options data changes and keeps selected labels of removed entries', () => {
    fixture.componentInstance.value.set('item-2');
    fixture.detectChanges();
    tick();

    expect(select.displayValue()).toBe('Item 2');

    fixture.componentInstance.options.set([{ value: 'item-1', label: 'First (renamed)' }]);
    fixture.detectChanges();
    tick();

    expect(select.selection.items().length).toBe(1);
    expect(select.selection.items()[0]!.label()).toBe('First (renamed)');
    // the selected value's option is gone - its label survives via the label cache
    expect(select.displayValue()).toBe('Item 2');
  });

  it('toggles values in multi mode from data rows', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.componentInstance.value.set([]);
    fixture.detectChanges();
    tick();

    await openSelect();

    options()[0]!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['item-1']);

    options()[1]!.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['item-1', 'item-2']);
  });
});

describe('SelectDirective (option template)', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());
    TestBed.configureTestingModule({
      imports: [OptionTemplateTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
  });

  it('renders data rows through etSelectOptionTemplate with the source entry as context', async () => {
    const fixture = TestBed.createComponent(OptionTemplateTestHost);

    fixture.detectChanges();
    tick();

    const select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    const trigger = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLElement;

    trigger.click();
    tick();
    await flushFrames();
    tick();

    const rows = Array.from(pane()?.querySelectorAll<HTMLElement>('.custom-row') ?? []);

    expect(rows.map((row) => row.textContent?.trim())).toEqual(['Alpha (first)', 'Beta (second)']);

    select.hide();
    tick();
    await flushFrames();
  });
});
