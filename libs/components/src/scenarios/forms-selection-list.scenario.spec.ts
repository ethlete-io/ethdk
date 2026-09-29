import { Component, getDebugNode, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  CHECKBOX_OPTION_VARIANTS,
  CheckboxGroupComponent,
  CheckboxGroupSelectAllComponent,
  CheckboxOptionComponent,
  DescriptionComponent,
  LabelDirective,
  RADIO_VARIANTS,
  RadioComponent,
  RadioGroupComponent,
  SEGMENTED_BUTTON_GROUP_VARIANTS,
  SegmentedButtonComponent,
  SegmentedButtonGroupComponent,
  SELECTION_LIST_IMPORTS,
  SELECTION_LIST_MULTIPLE,
  SELECTION_LIST_TOKEN,
  SelectionListControlDirective,
  SelectionListDirective,
  SelectionOptionDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const checkedStates = (selector: string) => queryAll(selector).map((el) => el.getAttribute('aria-checked'));

const tabindexes = (selector: string) => queryAll(selector).map((el) => el.getAttribute('tabindex'));

const press = (s: Scenario, key: string, target: EventTarget | null = document.activeElement) => {
  s.keydown(key, target ?? undefined);
  s.tick();
};

@Component({
  selector: 'et-scenario-positions-form',
  imports: [
    CheckboxGroupComponent,
    CheckboxOptionComponent,
    CheckboxGroupSelectAllComponent,
    DescriptionComponent,
    LabelDirective,
    FormField,
  ],
  template: `
    <et-checkbox-group [formField]="squad.positions" orientation="horizontal" name="positions">
      <et-label>Positions</et-label>
      <et-checkbox-group-select-all />
      <et-checkbox-option value="goal">Goalkeeper</et-checkbox-option>
      <et-checkbox-option value="defense">Defense</et-checkbox-option>
      <et-checkbox-option [disabled]="true" value="midfield">Midfield</et-checkbox-option>
      <et-checkbox-option [variant]="cardVariant" value="attack">
        Attack
        <et-description>Strikers and wingers</et-description>
      </et-checkbox-option>
    </et-checkbox-group>
  `,
})
class PositionsFormComponent {
  model = signal<{ positions: string[] }>({ positions: [] });
  squad = form(this.model, (path) => {
    validate(path.positions, ({ value }) =>
      value().length ? null : { kind: 'empty', message: 'Pick at least one position' },
    );
  });
  cardVariant = CHECKBOX_OPTION_VARIANTS.CARD;
}

@Component({
  selector: 'et-scenario-kit-form',
  imports: [RadioGroupComponent, RadioComponent, LabelDirective, FormField],
  template: `
    <et-radio-group [formField]="kit.color" [readonly]="readonly()">
      <et-label>Kit colour</et-label>
      <et-radio value="home">Home</et-radio>
      <et-radio [disabled]="true" value="away">Away</et-radio>
      <et-radio [variant]="cardVariant" value="third">Third</et-radio>
      <et-radio value="training">Training</et-radio>
    </et-radio-group>
  `,
})
class KitFormComponent {
  model = signal<{ color: string | null }>({ color: null });
  kit = form(this.model, (path) => required(path.color));
  readonly = signal(false);
  cardVariant = RADIO_VARIANTS.CARD;
}

@Component({
  selector: 'et-scenario-standings-view',
  imports: [SegmentedButtonGroupComponent, SegmentedButtonComponent],
  template: `
    <et-segmented-button-group [(value)]="view" [variant]="variant()" aria-label="Standings view">
      <et-segmented-button value="table">Table</et-segmented-button>
      <et-segmented-button value="form">Form</et-segmented-button>
      <et-segmented-button value="fixtures">Fixtures</et-segmented-button>
    </et-segmented-button-group>
  `,
})
class StandingsViewComponent {
  view = signal<string | null>('table');
  variant = signal<string>(SEGMENTED_BUTTON_GROUP_VARIANTS.PILL);
}

@Component({
  selector: 'et-scenario-picked-count',
  template: `{{ list.selection.selectedCount() }} picked`,
})
class PickedCountComponent {
  list = inject(SELECTION_LIST_TOKEN);
}

@Component({
  selector: 'et-scenario-team-chip-list',
  hostDirectives: [{ directive: SelectionListDirective, inputs: ['value'], outputs: ['valueChange'] }],
  providers: [{ provide: SELECTION_LIST_MULTIPLE, useValue: true }],
  template: `<ng-content />`,
})
class TeamChipListComponent {}

@Component({
  selector: 'et-scenario-headless-teams',
  imports: [SELECTION_LIST_IMPORTS, PickedCountComponent, TeamChipListComponent],
  template: `
    <div [(value)]="teams" [(mixed)]="mixed" [multiple]="true" class="teams" aria-label="Teams" etSelectionList>
      <div class="all" etSelectionListControl>All teams</div>
      <div class="team" value="team-a" etSelectionOption>Team A</div>
      <div class="team" value="team-b" etSelectionOption>Team B</div>
      <et-scenario-picked-count class="count" />
    </div>

    <et-scenario-team-chip-list [(value)]="chips" class="chips" aria-label="Chips">
      <span class="chip" value="red" etSelectionOption>Red</span>
      <span class="chip" value="blue" etSelectionOption>Blue</span>
    </et-scenario-team-chip-list>

    <span [(checked)]="loose" class="loose" value="solo" etSelectionOption>Solo</span>
  `,
})
class HeadlessTeamsComponent {
  teams = signal<unknown>(['team-a', 'team-b']);
  mixed = signal(true);
  chips = signal<unknown>(['blue']);
  loose = signal(false);
}

describe('forms selection list scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('picks checkbox options by pointer and keyboard, with a tri-state select-all and a validation message', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PositionsFormComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const group = query('et-checkbox-group', host);
    const options = queryAll('et-checkbox-option', host);
    const selectAll = query('et-checkbox-group-select-all', host);

    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('data-orientation')).toBe('horizontal');
    expect(group.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);
    expect(options.map((option) => option.getAttribute('role'))).toEqual(Array(4).fill('checkbox'));
    expect(options[2]?.getAttribute('aria-disabled')).toBe('true');
    expect(options[3]?.getAttribute('data-variant')).toBe('card');
    expect(options[3]?.classList).toContain('et-selection-card');
    expect(options[3]?.getAttribute('aria-describedby')).toBe(query('et-description', options[3]).id);
    expect(query(`#${options[0]?.getAttribute('aria-labelledby')}`, host).textContent?.trim()).toBe('Goalkeeper');
    expect(tabindexes('et-checkbox-option')).toEqual(['0', '-1', '-1', '-1']);
    expect(selectAll.getAttribute('role')).toBe('checkbox');
    expect(text(selectAll)).toBe('Select all');
    expect(selectAll.getAttribute('aria-checked')).toBe('false');

    options[0]?.click();
    s.tick();

    expect(app.model().positions).toEqual(['goal']);
    expect(checkedStates('et-checkbox-option')).toEqual(['true', 'false', 'false', 'false']);
    expect(selectAll.getAttribute('aria-checked')).toBe('mixed');

    options[0]?.focus();
    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(options[1]);
    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(options[3]);
    press(s, ' ');
    expect(app.model().positions).toEqual(['goal', 'attack']);

    press(s, 'Home');
    expect(document.activeElement).toBe(options[0]);
    press(s, 'd');
    expect(document.activeElement).toBe(options[1]);
    press(s, ' ');
    s.tick(1000);

    expect(app.model().positions).toEqual(['goal', 'defense', 'attack']);
    expect(selectAll.getAttribute('aria-checked')).toBe('true');

    selectAll.click();
    s.tick();

    expect(app.model().positions).toEqual([]);
    expect(selectAll.getAttribute('aria-checked')).toBe('false');

    press(s, ' ', selectAll);
    expect(app.model().positions).toEqual(['goal', 'defense', 'attack']);

    selectAll.click();
    s.frame(5);
    options[1]?.focus();
    options[1]?.dispatchEvent(new FocusEvent('blur'));
    s.tick();

    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('data-error')).toBe('true');
    expect(text(query('et-form-error', host))).toBe('Pick at least one position');
    expect(getDebugNode(selectAll)?.injector.get(SelectionListControlDirective).indeterminate()).toBe(false);

    s.frame(5);
    fixture.destroy();
    s.frame(5);
  });

  it('moves a radio selection with the arrows, skips disabled radios and honours read-only', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KitFormComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const group = query('et-radio-group', host);
    const radios = queryAll('et-radio', host);

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(radios.map((radio) => radio.getAttribute('role'))).toEqual(Array(4).fill('radio'));
    expect(radios[2]?.getAttribute('data-variant')).toBe('card');
    expect(tabindexes('et-radio')).toEqual(['0', '-1', '-1', '-1']);

    radios[0]?.click();
    s.tick();
    expect(app.model().color).toBe('home');

    radios[0]?.focus();
    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(radios[2]);
    expect(app.model().color).toBe('third');
    expect(tabindexes('et-radio')).toEqual(['-1', '-1', '0', '-1']);

    press(s, 'End');
    expect(app.model().color).toBe('training');
    press(s, 'ArrowRight');
    expect(app.model().color).toBe('home');
    press(s, 'ArrowLeft');
    expect(app.model().color).toBe('training');

    radios[1]?.click();
    s.tick();
    expect(app.model().color).toBe('training');
    expect(checkedStates('et-radio')).toEqual(['false', 'false', 'false', 'true']);

    app.readonly.set(true);
    s.tick();

    expect(group.getAttribute('aria-readonly')).toBe('true');

    radios[0]?.click();
    press(s, 'ArrowUp', radios[3]);
    expect(app.model().color).toBe('training');
    expect(document.activeElement).toBe(radios[2]);

    app.model.set({ color: 'home' });
    s.tick();
    expect(checkedStates('et-radio')).toEqual(['true', 'false', 'false', 'false']);

    s.frame(5);
    fixture.destroy();
    s.frame(5);
  });

  it('switches segments like a radio group and renders the tabs variant', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StandingsViewComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const group = query('et-segmented-button-group', host);
    const buttons = queryAll('et-segmented-button', host);

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Standings view');
    expect(group.getAttribute('data-variant')).toBe('pill');
    expect(checkedStates('et-segmented-button')).toEqual(['true', 'false', 'false']);
    expect(tabindexes('et-segmented-button')).toEqual(['0', '-1', '-1']);

    buttons[2]?.click();
    s.tick();
    s.frame(2);
    expect(app.view()).toBe('fixtures');

    buttons[2]?.focus();
    press(s, 'ArrowRight');
    expect(app.view()).toBe('table');
    expect(document.activeElement).toBe(buttons[0]);

    app.variant.set(SEGMENTED_BUTTON_GROUP_VARIANTS.TABS);
    s.tick();

    expect(group.getAttribute('data-variant')).toBe('tabs');
    expect(group.classList).toContain('et-tab-scale');

    fixture.destroy();
    s.frame(2);
  });

  it('builds a custom multi-select from the headless directives, including a mixed bulk-edit state', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessTeamsComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const list = query('.teams', host);
    const teams = queryAll('.team', host);
    const all = query('.all', host);

    expect(list.getAttribute('role')).toBe('group');
    expect(list.getAttribute('data-mixed')).toBe('true');
    expect(checkedStates('.team')).toEqual(['false', 'false']);
    expect(all.getAttribute('aria-checked')).toBe('false');
    expect(text(query('.count', host))).toBe('0 picked');

    teams[1]?.click();
    s.tick();

    expect(app.mixed()).toBe(false);
    expect(app.teams()).toEqual(['team-b']);
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect(text(query('.count', host))).toBe('1 picked');

    press(s, ' ', all);
    expect(app.teams()).toEqual(['team-a', 'team-b']);
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(text(query('.count', host))).toBe('2 picked');

    const listDirective = getDebugNode(list)?.injector.get(SelectionListDirective);

    listDirective?.focus();
    expect(document.activeElement).toBe(teams[0]);
    expect(getDebugNode(teams[0])?.injector.get(SelectionOptionDirective).role()).toBe('checkbox');

    const chips = query('.chips', host);

    expect(chips.getAttribute('role')).toBe('group');
    expect(checkedStates('.chip')).toEqual(['false', 'true']);

    query('.chip', host).click();
    s.tick();
    expect(app.chips()).toEqual(['red', 'blue']);

    const loose = query('.loose', host);

    expect(loose.getAttribute('role')).toBe('radio');
    expect(loose.getAttribute('tabindex')).toBe('0');
    loose.click();
    s.tick();
    expect(app.loose()).toBe(true);

    fixture.destroy();
  });
});
