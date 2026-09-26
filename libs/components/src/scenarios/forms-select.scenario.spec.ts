import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  DEFAULT_SELECT_LABELS,
  FORM_FIELD_IMPORTS,
  injectSelectLabels,
  provideOverlay,
  provideSelectLabels,
  SELECT_FILTER_MODES,
  SELECT_LABELS,
  SelectComponent,
  SelectDirective,
  SelectEmptyDirective,
  SelectErrorDirective,
  SelectLoadingDirective,
  SelectOptionComponent,
  SelectOptionGroupComponent,
  SelectOptionTemplateDirective,
  SelectSearchDirective,
  SelectValueDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Sport = { value: string; label: string; disabled?: boolean; players: number };

const SPORTS: Sport[] = [
  { value: 'football', label: 'Football', players: 11 },
  { value: 'basketball', label: 'Basketball', players: 5 },
  { value: 'handball', label: 'Handball', players: 7 },
  { value: 'hockey', label: 'Hockey', players: 6, disabled: true },
];

@Component({
  selector: 'et-scenario-team-form',
  imports: [FORM_FIELD_IMPORTS, SelectComponent, SelectOptionComponent, SelectOptionGroupComponent, FormField],
  template: `
    <et-form-field>
      <et-label>Position</et-label>
      <et-select [formField]="team.position" placeholder="Pick a position">
        <et-select-option-group label="Defence">
          <et-select-option value="goalkeeper">Goalkeeper</et-select-option>
          <et-select-option value="defender">Defender</et-select-option>
        </et-select-option-group>
        <et-select-option-group label="Attack">
          <et-select-option value="midfielder">Midfielder</et-select-option>
          <et-select-option disabled value="striker">Striker</et-select-option>
          <et-select-option value="winger">Winger</et-select-option>
        </et-select-option-group>
      </et-select>
    </et-form-field>
  `,
})
class TeamFormComponent {
  model = signal<{ position: string | null }>({ position: null });
  team = form(this.model, (path) => required(path.position, { message: 'Pick a position' }));
  select = viewChild.required(SelectDirective);
}

@Component({
  selector: 'et-scenario-legacy-team-form',
  imports: [SelectComponent, SelectOptionComponent, ReactiveFormsModule],
  template: `
    <et-select [formControl]="control" aria-label="Sports" multiple selectAll>
      <et-select-option value="football">Football</et-select-option>
      <et-select-option value="basketball">Basketball</et-select-option>
      <et-select-option value="handball">Handball</et-select-option>
    </et-select>
  `,
})
class LegacyTeamFormComponent {
  control = new FormControl<string[]>([], { nonNullable: true, validators: Validators.required });
}

@Component({
  selector: 'et-scenario-country-search',
  imports: [SelectComponent, SelectOptionComponent, SelectSearchDirective, SelectValueDirective],
  template: `
    <et-select [(value)]="country" [filterMode]="filterMode()" aria-label="Country" placeholder="Pick a country">
      <input etSelectSearch />
      <ng-template etSelectValue let-entries>
        <span class="country-value">{{ entries[0]?.label }} ({{ entries[0]?.value }})</span>
      </ng-template>
      <et-select-option value="de">Germany</et-select-option>
      <et-select-option value="dk">Denmark</et-select-option>
      <et-select-option value="fr">France</et-select-option>
    </et-select>
  `,
})
class CountrySearchComponent {
  country = signal<string | null>(null);
  filterMode = signal<'none' | 'internal' | 'external'>(SELECT_FILTER_MODES.INTERNAL);
  search = viewChild.required(SelectSearchDirective);
}

@Component({
  selector: 'et-scenario-remote-states',
  imports: [SelectComponent, SelectOptionComponent, SelectLoadingDirective, SelectErrorDirective, SelectEmptyDirective],
  providers: [provideSelectLabels({ loadMore: 'Mehr laden', addNew: 'Neu anlegen' })],
  template: `
    <et-select
      [(value)]="coach"
      [loading]="loading()"
      [error]="error()"
      [hasMoreItems]="hasMore()"
      (loadMore)="loadMoreCount = loadMoreCount + 1"
      (addNew)="addNewCount = addNewCount + 1"
      allowAddNew
      aria-label="Coach"
    >
      @if (custom()) {
        <ng-template etSelectLoading><p class="custom-loading">Fetching coaches</p></ng-template>
        <ng-template etSelectError let-message
          ><p class="custom-error">{{ message }} - retry later</p></ng-template
        >
        <ng-template etSelectEmpty><p class="custom-empty">Nobody here</p></ng-template>
      }
      @for (coach of coaches(); track coach) {
        <et-select-option [value]="coach">{{ coach }}</et-select-option>
      }
    </et-select>
  `,
})
class RemoteStatesComponent {
  coach = signal<string | null>(null);
  coaches = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  custom = signal(false);
  loadMoreCount = 0;
  addNewCount = 0;
  labels = injectSelectLabels();
}

@Component({
  selector: 'et-scenario-token-labels',
  imports: [SelectComponent],
  providers: [{ provide: SELECT_LABELS, useValue: (locale: string) => ({ empty: `Leer (${locale})` }) }],
  template: '<et-select [(value)]="pick" aria-label="Pick" />',
})
class TokenLabelsComponent {
  pick = signal<string | null>(null);
}

@Component({
  selector: 'et-scenario-sport-picker',
  imports: [SelectComponent, SelectOptionTemplateDirective],
  template: `
    <et-select [(value)]="sport" [options]="sports" aria-label="Sport">
      <ng-template [options]="sports" etSelectOptionTemplate let-option>
        <span class="sport-row">{{ option.label }} · {{ option.players }}</span>
      </ng-template>
    </et-select>
  `,
})
class SportPickerComponent {
  sports = SPORTS;
  sport = signal<string | null>('handball');
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const pane = () => queryAll('.et-overlay-runtime-pane').at(-1) ?? null;

const paneOptions = () => queryAll('[role="option"]', pane() ?? document.createElement('div'));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const option = (label: string) => {
  const found = paneOptions().find((candidate) => text(candidate) === label);

  if (!found) throw new Error(`no option ${label} in ${paneOptions().map(text).join(', ')}`);

  return found;
};

const activeLabel = () => text(paneOptions().find((candidate) => candidate.hasAttribute('data-active')));

const open = (s: Scenario, trigger: HTMLElement) => {
  trigger.click();
  s.tick();
  s.flush();
};

const typeInto = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
  s.flush();
};

const closeAll = (s: Scenario) => {
  s.keydown('Escape', document);
  s.keydown('Escape', document);
  s.tick();
  s.flush();
};

describe('forms select scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('picks an option into a signal form by keyboard and reports the required error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const trigger = query('[role="combobox"]', host);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(text(query('.et-select-value', host))).toBe('Pick a position');
    expect(app.team.position().invalid()).toBe(true);

    trigger.focus();
    s.keydown('ArrowDown', trigger);
    s.flush();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(query('[role="listbox"]').id).toBe(trigger.getAttribute('aria-controls'));
    expect(queryAll('[role="group"]').map((group) => group.getAttribute('aria-labelledby') !== null)).toEqual([
      true,
      true,
    ]);
    expect(paneOptions().map(text)).toEqual(['Goalkeeper', 'Defender', 'Midfielder', 'Striker', 'Winger']);
    expect(option('Striker').getAttribute('aria-disabled')).toBe('true');

    s.keydown('End', trigger);
    expect(activeLabel()).toBe('Winger');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(option('Winger').id);

    s.keydown('ArrowUp', trigger);
    expect(activeLabel()).toBe('Midfielder');

    s.keydown('Home', trigger);
    expect(activeLabel()).toBe('Goalkeeper');

    s.keydown('m', trigger);
    expect(activeLabel()).toBe('Midfielder');

    s.keydown('Enter', trigger);
    s.flush();

    expect(app.model().position).toBe('midfielder');
    expect(app.team.position().valid()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(text(query('.et-select-value', host))).toBe('Midfielder');

    app.model.set({ position: 'defender' });
    s.tick();
    expect(text(query('.et-select-value', host))).toBe('Defender');

    trigger.blur();
    s.tick();
    expect(app.team.position().touched()).toBe(true);
  });

  it('opens by click, commits a clicked option and ignores a disabled one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();
    open(s, query('[role="combobox"]', host));

    option('Striker').click();
    s.tick();
    expect(app.model().position).toBeNull();

    option('Defender').click();
    s.tick();
    s.flush();
    expect(app.model().position).toBe('defender');
    expect(app.select().open()).toBe(false);
  });

  it('binds a multi select with select-all to a reactive form control', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LegacyTeamFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const control = fixture.componentInstance.control;

    s.tick();
    s.flush();

    const trigger = query('[role="combobox"]', host);

    expect(trigger.getAttribute('aria-label')).toBe('Sports');
    open(s, trigger);

    expect(query('[role="listbox"]').getAttribute('aria-multiselectable')).toBe('true');

    const selectAll = query('et-select-all-option');

    expect(selectAll.getAttribute('aria-checked')).toBe('false');

    option('Basketball').click();
    s.tick();
    expect(control.value).toEqual(['basketball']);
    expect(selectAll.getAttribute('aria-checked')).toBe('mixed');
    expect(option('Basketball').getAttribute('aria-selected')).toBe('true');

    selectAll.click();
    s.tick();
    expect(control.value).toEqual(['basketball', 'football', 'handball']);
    expect(selectAll.getAttribute('aria-checked')).toBe('true');

    selectAll.click();
    s.tick();
    expect(control.value).toEqual([]);
    expect(control.valid).toBe(false);

    closeAll(s);

    control.setValue(['handball', 'football']);
    s.tick();
    expect(queryAll('et-chip', host).map(text)).toEqual(['Handball', 'Football']);

    control.disable();
    s.tick();
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
  });

  it('filters by the search query, keeps options in none mode and shows the custom value template', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CountrySearchComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const input = query<HTMLInputElement>('input[etSelectSearch]', host);

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.placeholder).toBe('Pick a country');

    typeInto(s, input, 'an');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(
      paneOptions()
        .filter((candidate) => !candidate.hasAttribute('data-filtered'))
        .map(text),
    ).toEqual(['Germany', 'France']);

    typeInto(s, input, 'fra');
    expect(
      paneOptions()
        .filter((candidate) => !candidate.hasAttribute('data-filtered'))
        .map(text),
    ).toEqual(['France']);

    s.keydown('ArrowDown', input);
    s.keydown('Enter', input);
    s.flush();
    expect(app.country()).toBe('fr');

    input.blur();
    s.tick();
    expect(text(query('.country-value', host))).toBe('France (fr)');

    app.filterMode.set(SELECT_FILTER_MODES.NONE);
    typeInto(s, input, 'zzz');
    expect(paneOptions().some((candidate) => candidate.hasAttribute('data-filtered'))).toBe(false);
    expect(app.search().query()).toBe('zzz');
    closeAll(s);
  });

  it('renders loading, error and empty rows, localized labels and the load-more and add-new actions', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RemoteStatesComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(app.labels().loadMore).toBe('Mehr laden');
    expect(app.labels().empty).toBe(DEFAULT_SELECT_LABELS.empty);

    open(s, query('[role="combobox"]', host));
    expect(text(query('.et-select-state--empty'))).toBe(DEFAULT_SELECT_LABELS.empty);

    app.loading.set(true);
    s.tick(1000);
    s.flush();
    expect(text(query('.et-select-state--loading'))).toBe(DEFAULT_SELECT_LABELS.loading);

    app.loading.set(false);
    app.error.set('Coaches unavailable');
    s.tick();
    s.flush();
    expect(query('.et-select-state--error').getAttribute('role')).toBe('alert');
    expect(text(query('.et-select-state--error'))).toBe('Coaches unavailable');

    app.error.set(null);
    app.coaches.set(['Ada', 'Grace']);
    app.hasMore.set(true);
    s.tick();
    s.flush();
    expect(paneOptions().map(text)).toEqual(['Ada', 'Grace']);
    expect(text(query('.et-select-load-more'))).toBe('Mehr laden');

    query<HTMLButtonElement>('.et-select-load-more').click();
    s.tick();
    expect(app.loadMoreCount).toBe(1);

    app.custom.set(true);
    app.coaches.set([]);
    app.hasMore.set(false);
    s.tick();
    s.flush();
    expect(text(query('.custom-empty'))).toBe('Nobody here');

    app.error.set('Timeout');
    s.tick();
    s.flush();
    expect(text(query('.custom-error'))).toBe('Timeout - retry later');

    app.error.set(null);
    app.loading.set(true);
    s.tick(1000);
    s.flush();
    expect(text(query('.custom-loading'))).toBe('Fetching coaches');

    app.loading.set(false);
    s.tick();
    s.flush();
    expect(text(query('.et-select-add-new'))).toBe('Neu anlegen');

    query<HTMLButtonElement>('.et-select-add-new').click();
    s.tick();
    s.flush();
    expect(app.addNewCount).toBe(1);
    expect(query('[role="combobox"]', host).getAttribute('aria-expanded')).toBe('false');
  });

  it('renders data-driven options through the option template and commits one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SportPickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(text(query('.et-select-value', host))).toBe('Handball');

    open(s, query('[role="combobox"]', host));

    expect(queryAll('et-select-virtual-option').map(text)).toEqual([
      'Football · 11',
      'Basketball · 5',
      'Handball · 7',
      'Hockey · 6',
    ]);
    expect(option('Handball · 7').getAttribute('aria-selected')).toBe('true');
    expect(option('Hockey · 6').getAttribute('aria-disabled')).toBe('true');
    expect(pane()?.querySelector('et-select-panel')).not.toBeNull();

    const trigger = query('[role="combobox"]', host);

    s.keydown('ArrowDown', trigger);
    s.keydown('b', trigger);
    expect(activeLabel()).toBe('Basketball · 5');

    s.keydown(' ', trigger);
    s.flush();
    expect(app.sport()).toBe('basketball');
  });

  it('reads a per-locale labels source provided on the SELECT_LABELS token', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TokenLabelsComponent);

    s.tick();
    s.flush();
    open(s, query('[role="combobox"]', fixture.nativeElement as HTMLElement));

    expect(text(query('.et-select-state--empty'))).toMatch(/^Leer \(.+\)$/);
    closeAll(s);
  });

  it('closes an open panel without writing to the destroyed select', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CountrySearchComponent);

    s.tick();
    s.flush();
    typeInto(s, query<HTMLInputElement>('input[etSelectSearch]', fixture.nativeElement as HTMLElement), 'an');
    expect(pane()).not.toBeNull();

    fixture.destroy();
    s.tick();
    s.flush();

    expect(s.warnings.map((entry) => String(entry.warning))).toEqual([]);
    expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
  });
});
