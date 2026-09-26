import { Component, computed, inject, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  MENU_ERROR_CODES,
  MENU_SEARCH_IMPORTS,
  MENU_SELECTION_GROUP_MULTIPLE,
  MENU_SELECTION_GROUP_TOKEN,
  MENU_SELECTION_ITEM_KIND,
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuGroupLabelComponent,
  MenuItemComponent,
  MenuItemDirective,
  MenuPanelDirective,
  MenuRadioGroupComponent,
  MenuRadioItemComponent,
  MenuSearchDirective,
  MenuSelectionGroupDirective,
  MenuSelectionItemDirective,
  MenuSeparatorComponent,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const code = (value: number) => `ET${value}`;

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const all = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));

const focused = () => text(document.activeElement);

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const openMenu = (s: Scenario) => {
  query('.trigger').focus();
  query('.trigger').click();
  settle(s);
};

const takeErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  return s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;
};

@Component({
  selector: 'et-scenario-view-options',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    MenuSeparatorComponent,
    MenuGroupLabelComponent,
    MenuRadioGroupComponent,
    MenuRadioItemComponent,
    MenuCheckboxGroupComponent,
    MenuCheckboxItemComponent,
    FormField,
  ],
  template: `
    <div etMenu>
      <button class="trigger" etMenuTrigger type="button">View</button>
      <ng-template etMenuSurface>
        <et-menu>
          <et-menu-radio-group [formField]="options.sortBy" class="sort">
            <et-menu-group-label>Sort by</et-menu-group-label>
            <et-menu-radio-item value="name">Name</et-menu-radio-item>
            <et-menu-radio-item value="rank">Rank</et-menu-radio-item>
            <et-menu-radio-item [disabled]="true" value="age">Age</et-menu-radio-item>
          </et-menu-radio-group>
          <et-menu-separator />
          <et-menu-checkbox-group [formField]="options.teams" class="teams">
            <et-menu-group-label>Teams</et-menu-group-label>
            <et-menu-checkbox-item value="team-a">Team A</et-menu-checkbox-item>
            <et-menu-checkbox-item value="team-b">Team B</et-menu-checkbox-item>
          </et-menu-checkbox-group>
          <et-menu-separator />
          <et-menu-checkbox-item [(checked)]="archived" [(indeterminate)]="partlyArchived" class="archived">
            Show archived
          </et-menu-checkbox-item>
        </et-menu>
      </ng-template>
    </div>
  `,
})
class ViewOptionsComponent {
  model = linkedSignal(() => ({ sortBy: 'name' as string | null, teams: ['team-a'] as string[] }));
  options = form(this.model, (path) => required(path.sortBy));
  archived = signal(false);
  partlyArchived = signal(true);
}

@Component({
  selector: 'et-scenario-assign-player',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuRadioGroupComponent,
    MenuRadioItemComponent,
    MENU_SEARCH_IMPORTS,
  ],
  template: `
    <div etMenu>
      <button class="trigger" etMenuTrigger type="button">Assign</button>
      <ng-template etMenuSurface>
        <et-menu>
          <input [(query)]="search" [loading]="loading()" [error]="error()" etMenuSearch placeholder="Search" />
          <et-menu-radio-group [(value)]="player">
            @for (name of filtered(); track name) {
              <et-menu-radio-item [value]="name" [closeOnActivate]="closeOnPick">{{ name }}</et-menu-radio-item>
            }
          </et-menu-radio-group>
        </et-menu>
      </ng-template>
    </div>
  `,
  styles: ['et-scrollbar { display: block; }'],
  encapsulation: ViewEncapsulation.None,
})
class AssignPlayerComponent {
  players = ['Alex (team-a)', 'Sam (team-a)', 'Robin (team-b)'];
  search = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  player = signal<string | null>(null);
  closeOnPick = true;
  filtered = computed(() => this.players.filter((name) => name.toLowerCase().includes(this.search().toLowerCase())));
}

@Component({
  selector: 'et-scenario-picked-count',
  template: `<span class="picked">{{ count() }} picked</span>`,
})
class PickedCountComponent {
  group = inject(MENU_SELECTION_GROUP_TOKEN);
  count = computed(() => this.group.items().filter((item) => item.checked()).length);
}

@Component({
  selector: 'et-scenario-flag-group',
  template: `<ng-content />`,
  providers: [{ provide: MENU_SELECTION_GROUP_MULTIPLE, useValue: true }],
  hostDirectives: [{ directive: MenuSelectionGroupDirective, inputs: ['value'], outputs: ['valueChange'] }],
})
class FlagGroupComponent {}

@Component({
  selector: 'et-scenario-toggle-item',
  template: `<ng-content />`,
  providers: [{ provide: MENU_SELECTION_ITEM_KIND, useValue: 'checkbox' }],
  hostDirectives: [MenuItemDirective, { directive: MenuSelectionItemDirective, inputs: ['value'] }],
})
class ToggleItemComponent {}

@Component({
  selector: 'et-scenario-headless-filters',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuPanelDirective,
    MenuItemDirective,
    MenuSelectionGroupDirective,
    MenuSelectionItemDirective,
    PickedCountComponent,
    FlagGroupComponent,
    ToggleItemComponent,
  ],
  template: `
    <div etMenu>
      <button class="trigger" etMenuTrigger type="button">Filters</button>
      <ng-template etMenuSurface>
        <div class="filters" etMenuPanel>
          <div [(value)]="regions" class="regions" etMenuSelectionGroup multiple>
            <button class="north" etMenuItem etMenuSelectionItem type="button" value="north">North</button>
            <button class="south" etMenuItem etMenuSelectionItem type="button" value="south">South</button>
            <et-scenario-picked-count />
          </div>
          <et-scenario-flag-group [(value)]="flags" class="flags">
            <button class="live" etMenuItem etMenuSelectionItem type="button" value="live">Live only</button>
          </et-scenario-flag-group>
          <div [(value)]="mode" etMenuSelectionGroup>
            <et-scenario-toggle-item class="compact" value="compact">Compact</et-scenario-toggle-item>
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
class HeadlessFiltersComponent {
  regions = signal<unknown>(['south']);
  flags = signal<unknown>([]);
  mode = signal<unknown>(null);
}

@Component({
  selector: 'et-scenario-stray-selection',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuPanelDirective,
    MenuItemDirective,
    MenuSearchDirective,
    MenuSelectionGroupDirective,
    MenuSelectionItemDirective,
  ],
  template: `
    <input class="stray-search" etMenuSearch />
    <div class="stray-panel" etMenuPanel></div>
    <span class="no-item" etMenuSelectionItem></span>
    <div etMenu>
      <button class="trigger" etMenuTrigger type="button">Open</button>
      <ng-template etMenuSurface>
        <div etMenuPanel>
          <div etMenuSelectionGroup>
            <button class="no-value" etMenuItem etMenuSelectionItem type="button">No value</button>
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
class StraySelectionComponent {}

describe('menu selection scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('picks a radio and toggles checkboxes bound to a signal form, keeping the menu open', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ViewOptionsComponent);
    const page = fixture.componentInstance;

    s.tick();
    openMenu(s);

    const sort = query('.sort');
    const label = sort.querySelector('et-menu-group-label');

    expect(sort.getAttribute('role')).toBe('group');
    expect(label?.getAttribute('role')).toBe('presentation');
    expect(sort.getAttribute('aria-labelledby')).toBe(label?.id);
    expect(query('.teams').getAttribute('aria-labelledby')).toBe(query('.teams et-menu-group-label').id);

    const radios = all('et-menu-radio-item');

    expect(radios.map((radio) => radio.getAttribute('role'))).toEqual(Array(3).fill('menuitemradio'));
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios[2]?.getAttribute('aria-disabled')).toBe('true');

    radios[1]?.click();
    settle(s);

    expect(page.model().sortBy).toBe('rank');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(document.querySelector('et-menu')).not.toBeNull();

    radios[2]?.click();
    s.tick();
    expect(page.model().sortBy).toBe('rank');

    const checkboxes = all('.teams et-menu-checkbox-item');

    expect(checkboxes.map((box) => box.getAttribute('role'))).toEqual(['menuitemcheckbox', 'menuitemcheckbox']);
    expect(checkboxes.map((box) => box.getAttribute('aria-checked'))).toEqual(['true', 'false']);

    checkboxes[1]?.click();
    s.tick();
    expect(page.model().teams).toEqual(['team-a', 'team-b']);

    checkboxes[0]?.click();
    s.tick();
    expect(page.model().teams).toEqual(['team-b']);
    expect(page.options.teams().touched()).toBe(true);

    const archived = query('.archived');

    expect(archived.getAttribute('aria-checked')).toBe('mixed');

    archived.click();
    s.tick();
    expect(page.partlyArchived()).toBe(false);
    expect(page.archived()).toBe(true);
    expect(archived.getAttribute('aria-checked')).toBe('true');

    archived.focus();
    s.keydown(' ');
    s.tick();
    expect(page.archived()).toBe(false);
    expect(document.querySelector('et-menu')).not.toBeNull();

    page.model.set({ sortBy: 'name', teams: [] });
    s.tick();
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(checkboxes.map((box) => box.getAttribute('aria-checked'))).toEqual(['false', 'false']);

    s.keydown('Home');
    expect(focused()).toBe('Name');
    s.keydown('ArrowDown');
    s.keydown('Enter');
    settle(s);

    expect(page.model().sortBy).toBe('rank');
    expect(document.querySelector('et-menu')).toBeNull();
    expect(document.activeElement).toBe(query('.trigger'));
  });

  it('focuses the search field, filters, hands focus between field and items, and reports errors', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AssignPlayerComponent);
    const page = fixture.componentInstance;

    s.tick();
    openMenu(s);

    const search = query<HTMLInputElement>('input[etMenuSearch]');

    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('autocomplete')).toBe('off');
    expect(all('et-menu-radio-item')).toHaveLength(3);

    search.value = 'team-a';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s);

    expect(page.search()).toBe('team-a');
    expect(all('et-menu-radio-item').map(text)).toEqual(['Alex (team-a)', 'Sam (team-a)']);

    s.keydown('ArrowDown');
    expect(focused()).toBe('Alex (team-a)');

    s.keydown('ArrowUp');
    expect(document.activeElement).toBe(search);

    s.keydown('ArrowUp');
    expect(focused()).toBe('Sam (team-a)');

    s.keydown('x');
    s.tick();
    expect(document.activeElement).toBe(search);
    expect(page.search()).toBe('team-ax');
    expect(all('et-menu-radio-item')).toHaveLength(0);

    s.keydown('Escape');
    settle(s);
    expect(page.search()).toBe('');
    expect(search.value).toBe('');
    expect(document.querySelector('et-menu')).not.toBeNull();

    page.loading.set(true);
    page.error.set('Search is offline');
    settle(s);

    const panel = query('et-menu');
    const error = query('.et-menu-search-error');

    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(search.getAttribute('aria-invalid')).toBe('true');
    expect(search.getAttribute('aria-describedby')).toBe(error.id);
    expect(error.getAttribute('role')).toBe('alert');
    expect(text(error)).toBe('Search is offline');

    page.loading.set(false);
    page.error.set(null);
    settle(s);
    expect(panel.getAttribute('aria-busy')).toBeNull();
    expect(search.hasAttribute('aria-invalid')).toBe(false);

    s.keydown('ArrowDown');
    s.keydown('ArrowDown');
    s.keydown('Enter');
    settle(s);

    expect(page.player()).toBe('Sam (team-a)');
    expect(document.querySelector('et-menu')).toBeNull();

    openMenu(s);
    expect(document.activeElement).toBe(query('input[etMenuSearch]'));
    query('et-menu-radio-item:last-of-type').click();
    settle(s);
    expect(page.player()).toBe('Robin (team-b)');
    expect(document.querySelector('et-menu')).toBeNull();
  });

  it('composes headless selection groups and items, with consumer-provided group and item kinds', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessFiltersComponent);
    const page = fixture.componentInstance;

    s.tick();
    openMenu(s);

    const north = query('.north');
    const south = query('.south');

    expect(query('.filters').getAttribute('role')).toBe('menu');
    expect(query('.regions').getAttribute('role')).toBe('group');
    expect([north, south].map((item) => item.getAttribute('role'))).toEqual(['menuitemcheckbox', 'menuitemcheckbox']);
    expect([north, south].map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(text(query('.picked'))).toBe('1 picked');

    north.click();
    s.tick();
    expect(page.regions()).toEqual(['north', 'south']);
    expect(text(query('.picked'))).toBe('2 picked');

    const live = query('.live');

    expect(query('.flags').getAttribute('role')).toBe('group');
    expect(live.getAttribute('role')).toBe('menuitemcheckbox');

    live.click();
    s.tick();
    expect(page.flags()).toEqual(['live']);

    const compact = query('.compact');

    expect(compact.getAttribute('role')).toBe('menuitemcheckbox');
    expect(compact.getAttribute('aria-checked')).toBe('false');

    compact.click();
    s.tick();
    expect(page.mode()).toBe('compact');
    expect(compact.getAttribute('aria-checked')).toBe('true');

    s.keydown('Escape');
    settle(s);
    expect(document.querySelector('.filters')).toBeNull();
  });

  it('reports selection and search parts used out of place', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StraySelectionComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.expectError(code(MENU_ERROR_CODES.SEARCH_OUTSIDE_MENU));
    s.expectError(code(MENU_ERROR_CODES.PANEL_OUTSIDE_MENU));
    s.expectError(code(MENU_ERROR_CODES.ITEM_OUTSIDE_MENU));

    const strays = [takeErrorContext(s), takeErrorContext(s), takeErrorContext(s)].map((context) => context?.element);

    expect(strays).toEqual(
      expect.arrayContaining([
        host.querySelector('.stray-search'),
        host.querySelector('.stray-panel'),
        host.querySelector('.no-item'),
      ]),
    );

    openMenu(s);
    s.expectError(code(MENU_ERROR_CODES.SELECTION_ITEM_MISSING_VALUE));
    expect(takeErrorContext(s)?.element).toBe(query('.no-value'));

    s.keydown('Escape');
    settle(s);
  });
});
