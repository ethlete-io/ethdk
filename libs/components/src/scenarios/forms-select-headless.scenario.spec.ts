import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  provideOverlay,
  SELECT_ERROR_CODES,
  SelectAllOptionComponent,
  SelectAllOptionDirective,
  SelectDirective,
  SelectEmptyDirective,
  SelectListboxDirective,
  SelectOptionComponent,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectOptionsDirective,
  SelectOptionTemplateDirective,
  SelectPanelComponent,
  SelectSearchDirective,
  SelectSurfaceDirective,
  SelectTriggerDirective,
  SelectValueDirective,
  SelectViewportDirective,
  SelectVirtualOptionComponent,
  SelectVirtualOptionDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Tag = { value: string; label: string; disabled?: boolean };

const TAGS: Tag[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'veteran', label: 'Veteran', disabled: true },
];

const manyTags = (count: number): Tag[] =>
  Array.from({ length: count }, (_, index) => ({ value: `tag-${index + 1}`, label: `Tag ${index + 1}` }));

@Component({
  selector: 'et-scenario-tag-picker',
  imports: [
    SelectDirective,
    SelectTriggerDirective,
    SelectSurfaceDirective,
    SelectListboxDirective,
    SelectViewportDirective,
    SelectAllOptionDirective,
    SelectVirtualOptionDirective,
    SelectOptionGroupDirective,
    SelectOptionDirective,
  ],
  template: `
    <div [(value)]="tags" [options]="options()" etSelect multiple selectAll>
      <button class="tag-trigger" aria-label="Tags" etSelectTrigger type="button">{{ tags().length }} tags</button>
      <ng-template etSelectSurface let-select let-close="close">
        <div class="tag-viewport" etSelectViewport>
          <div class="tag-listbox" etSelectListbox>
            <div class="tag-all" etSelectAllOption>All tags</div>
            @for (item of select.virtualizedItems(); track item.id()) {
              <div [etSelectVirtualOption]="item" class="tag-row">{{ item.label() }}</div>
            }
            <div class="tag-group" etSelectOptionGroup label="Custom">
              <div class="tag-row" etSelectOption value="rookie">Rookie</div>
            </div>
          </div>
        </div>
        <button (click)="close()" class="tag-done" type="button">Done</button>
      </ng-template>
    </div>
  `,
})
class TagPickerComponent {
  tags = signal<string[]>([]);
  options = signal<Tag[]>(TAGS);
  select = viewChild.required(SelectDirective);
  trigger = viewChild.required(SelectTriggerDirective);
  surface = viewChild.required(SelectSurfaceDirective);
}

@Component({
  selector: 'et-scenario-styled-headless',
  imports: [
    SelectDirective,
    SelectTriggerDirective,
    SelectSurfaceDirective,
    SelectPanelComponent,
    SelectAllOptionComponent,
    SelectVirtualOptionComponent,
    SelectOptionComponent,
    SelectValueDirective,
    SelectOptionTemplateDirective,
    SelectEmptyDirective,
  ],
  template: `
    <div [(value)]="levels" [options]="options" etSelect multiple selectAll>
      <button class="level-trigger" aria-label="Levels" etSelectTrigger type="button">Levels</button>
      <ng-template etSelectValue let-entries>{{ entries.length }}</ng-template>
      <ng-template [options]="options" etSelectOptionTemplate let-option>{{ option.label }}!</ng-template>
      <ng-template etSelectEmpty>none</ng-template>
      <ng-template etSelectSurface let-select>
        <et-select-panel>
          <et-select-all-option>Everything</et-select-all-option>
          @for (item of select.virtualizedItems(); track item.id()) {
            <et-select-virtual-option [item]="item" />
          }
          <et-select-option value="other">Other</et-select-option>
        </et-select-panel>
      </ng-template>
    </div>
  `,
})
class StyledHeadlessComponent {
  levels = signal<string[]>([]);
  options = manyTags(60);
  select = viewChild.required(SelectDirective);
}

@Component({
  selector: 'et-scenario-stray-trigger',
  imports: [SelectTriggerDirective],
  template: '<button etSelectTrigger type="button">Lost</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-surface',
  imports: [SelectSurfaceDirective],
  template: '<ng-template etSelectSurface>Lost</ng-template>',
})
class StraySurfaceComponent {}

@Component({
  selector: 'et-scenario-stray-listbox',
  imports: [SelectListboxDirective],
  template: '<div etSelectListbox>Lost</div>',
})
class StrayListboxComponent {}

@Component({
  selector: 'et-scenario-stray-option',
  imports: [SelectOptionDirective],
  template: '<div etSelectOption value="x">Lost</div>',
})
class StrayOptionComponent {}

@Component({
  selector: 'et-scenario-stray-value',
  imports: [SelectValueDirective],
  template: '<ng-template etSelectValue>Lost</ng-template>',
})
class StrayValueComponent {}

@Component({
  selector: 'et-scenario-stray-search',
  imports: [SelectSearchDirective],
  template: '<input etSelectSearch />',
})
class StraySearchComponent {}

@Component({
  selector: 'et-scenario-stray-empty',
  imports: [SelectEmptyDirective],
  template: '<ng-template etSelectEmpty>Lost</ng-template>',
})
class StrayEmptyComponent {}

@Component({
  selector: 'et-scenario-stray-group',
  imports: [SelectOptionGroupDirective],
  template: '<div etSelectOptionGroup label="Lost"></div>',
})
class StrayGroupComponent {}

@Component({
  selector: 'et-scenario-stray-virtual-option',
  imports: [SelectVirtualOptionDirective],
  template: '<div [etSelectVirtualOption]="item">Lost</div>',
})
class StrayVirtualOptionComponent {
  item = {
    value: signal('x'),
    checked: signal(false),
    disabled: signal(false),
    element: signal(null),
    id: signal('lost'),
    label: signal('Lost'),
  };
}

@Component({
  selector: 'et-scenario-stray-option-template',
  imports: [SelectOptionTemplateDirective],
  template: '<ng-template etSelectOptionTemplate>Lost</ng-template>',
})
class StrayOptionTemplateComponent {}

@Component({
  selector: 'et-scenario-stray-viewport',
  imports: [SelectViewportDirective],
  template: '<div etSelectViewport>Lost</div>',
})
class StrayViewportComponent {}

@Component({
  selector: 'et-scenario-stray-options',
  imports: [SelectOptionsDirective],
  template: '<div [etSelectOptions]="bundle">Lost</div>',
})
class StrayOptionsComponent {
  bundle = {
    options: signal([]),
    loading: signal(false),
    error: signal(null),
    hasMore: signal(false),
    query: signal(''),
    setQuery: () => undefined,
    loadMore: () => undefined,
  };
}

@Component({
  selector: 'et-scenario-stray-select-all',
  imports: [SelectAllOptionDirective],
  template: '<div etSelectAllOption>Lost</div>',
})
class StraySelectAllComponent {}

@Component({
  selector: 'et-scenario-bare-select',
  imports: [SelectDirective],
  template: '<div etSelect>Nothing</div>',
})
class BareSelectComponent {}

@Component({
  selector: 'et-scenario-surfaceless-select',
  imports: [SelectDirective, SelectTriggerDirective],
  template: '<div etSelect><button etSelectTrigger type="button">Open</button></div>',
})
class SurfacelessSelectComponent {}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const activeLabel = () => text(queryAll('[role="option"][data-active]').at(-1));

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('forms select headless scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('composes a multi select from the headless directives', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TagPickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const trigger = query('.tag-trigger', host);

    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-label')).toBe('Tags');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('tabindex')).toBe(false);
    expect(app.trigger().isOpen()).toBe(false);
    expect(app.surface().templateRef).toBeTruthy();

    trigger.click();
    s.tick();
    s.flush();

    const listbox = query('.tag-listbox');

    expect(app.trigger().isOpen()).toBe(true);
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    expect(listbox.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);
    expect(queryAll('[role="option"]').map(text)).toEqual(['All tags', 'Junior', 'Senior', 'Veteran', 'Rookie']);
    expect(query('.tag-group').getAttribute('role')).toBe('group');
    expect(query('.tag-group').getAttribute('aria-label')).toBe('Custom');

    trigger.focus();
    s.keydown('Home', trigger);
    expect(activeLabel()).toBe('All tags');
    s.keydown('ArrowDown', trigger);
    expect(activeLabel()).toBe('Junior');
    s.keydown('ArrowDown', trigger);
    s.keydown('ArrowDown', trigger);
    expect(activeLabel()).toBe('Rookie');

    s.keydown(' ', trigger);
    expect(app.tags()).toEqual(['rookie']);
    expect(query('.tag-all').getAttribute('aria-checked')).toBe('mixed');

    query('.tag-all').click();
    s.tick();
    expect(app.tags()).toEqual(['junior', 'senior', 'rookie']);
    expect(query('.tag-all').getAttribute('aria-checked')).toBe('true');
    expect(queryAll('.tag-row').map((row) => row.getAttribute('aria-selected'))).toEqual([
      'true',
      'true',
      'false',
      'true',
    ]);

    queryAll('.tag-row')[1]?.click();
    s.tick();
    expect(app.tags()).toEqual(['junior', 'rookie']);

    query('.tag-done').click();
    s.tick();
    s.flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(text(trigger)).toBe('2 tags');
  });

  it('builds a windowed data-driven list from the styled panel pieces', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StyledHeadlessComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const trigger = query('.level-trigger', host);

    trigger.click();
    s.tick();
    s.flush();

    expect(query('et-select-panel [role="listbox"]')).toBeTruthy();
    expect(app.select().windowsOptions()).toBe(true);

    const rows = queryAll('et-select-virtual-option');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(60);
    expect(text(rows[0])).toBe('Tag 1!');
    expect(query('et-select-all-option').getAttribute('role')).toBe('option');

    query('et-select-all-option').click();
    s.tick();
    expect(app.levels()).toHaveLength(61);

    trigger.focus();
    s.keydown('End', trigger);
    s.tick();
    s.flush();
    expect(activeLabel()).toBe('Other');

    s.keydown('Enter', trigger);
    expect(app.levels()).toHaveLength(60);
    expect(app.levels()).not.toContain('other');

    s.keydown('Escape', document);
    s.tick();
    s.flush();
  });

  it.each([
    ['a trigger', StrayTriggerComponent, SELECT_ERROR_CODES.TRIGGER_OUTSIDE_SELECT],
    ['a surface', StraySurfaceComponent, SELECT_ERROR_CODES.SURFACE_OUTSIDE_SELECT],
    ['a listbox', StrayListboxComponent, SELECT_ERROR_CODES.LISTBOX_OUTSIDE_SELECT],
    ['an option', StrayOptionComponent, SELECT_ERROR_CODES.OPTION_OUTSIDE_SELECT],
    ['a value template', StrayValueComponent, SELECT_ERROR_CODES.VALUE_OUTSIDE_SELECT],
    ['a search input', StraySearchComponent, SELECT_ERROR_CODES.SEARCH_OUTSIDE_SELECT],
    ['a state template', StrayEmptyComponent, SELECT_ERROR_CODES.STATE_TEMPLATE_OUTSIDE_SELECT],
    ['an option group', StrayGroupComponent, SELECT_ERROR_CODES.OPTION_GROUP_OUTSIDE_SELECT],
    ['a virtual option', StrayVirtualOptionComponent, SELECT_ERROR_CODES.VIRTUAL_OPTION_OUTSIDE_SELECT],
    ['an option template', StrayOptionTemplateComponent, SELECT_ERROR_CODES.OPTION_TEMPLATE_OUTSIDE_SELECT],
    ['a viewport', StrayViewportComponent, SELECT_ERROR_CODES.VIEWPORT_OUTSIDE_SELECT],
    ['an options bundle', StrayOptionsComponent, SELECT_ERROR_CODES.OPTIONS_OUTSIDE_SELECT],
    ['a select-all option', StraySelectAllComponent, SELECT_ERROR_CODES.SELECT_ALL_OPTION_OUTSIDE_SELECT],
    ['a select without a trigger', BareSelectComponent, SELECT_ERROR_CODES.MISSING_TRIGGER],
    ['a select without a surface', SurfacelessSelectComponent, SELECT_ERROR_CODES.MISSING_SURFACE],
  ])('reports a runtime error for %s outside a select', (_label, component, code) => {
    const s = scenario();

    TestBed.createComponent(component);
    s.tick();
    s.flush();

    takeRuntimeError(s, code);
  });
});
