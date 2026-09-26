import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  CHIP_ERROR_CODES,
  CHIP_IMPORTS,
  CHIP_LABELS,
  CHIP_REMOVE_TAB_STOP,
  ChipComponent,
  ChipDirective,
  ChipRemoveDirective,
  DEFAULT_CHIP_LABELS,
  injectChipLabels,
  provideChipLabels,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const queryAll = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));

const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

@Component({
  selector: 'et-scenario-team-filters',
  imports: [CHIP_IMPORTS],
  template: `
    <div class="filters">
      @for (team of teams(); track team) {
        <et-chip [removable]="!locked()" [disabled]="team === 'team-c'" (remove)="removeTeam(team)" tabindex="0">
          {{ team }}
        </et-chip>
      }
    </div>
  `,
})
class TeamFiltersComponent {
  teams = signal(['team-a', 'team-b', 'team-c']);
  locked = signal(false);
  removed: string[] = [];

  removeTeam(team: string) {
    this.removed.push(team);
    this.teams.update((teams) => teams.filter((entry) => entry !== team));
  }
}

@Component({
  selector: 'et-scenario-tag-chip',
  imports: [ChipDirective, ChipRemoveDirective],
  template: `
    <span
      (click)="activated = activated + 1"
      (keydown.enter)="activated = activated + 1"
      (remove)="removed = removed + 1"
      class="tag"
      removable
      etChip
      tabindex="0"
    >
      team-a
      <span class="tag-remove" etChipRemove removeLabel="Remove team-a">×</span>
    </span>
  `,
})
class TagChipComponent {
  activated = 0;
  removed = 0;
}

@Component({
  selector: 'et-scenario-tag-input',
  imports: [ChipComponent],
  providers: [{ provide: CHIP_REMOVE_TAB_STOP, useValue: false }],
  template: `
    <et-chip removable>team-a</et-chip>
    <et-chip removable>team-b</et-chip>
  `,
})
class TagInputComponent {}

@Component({
  selector: 'et-scenario-german-chips',
  imports: [ChipComponent],
  providers: [provideChipLabels({ remove: 'Entfernen' })],
  template: `<et-chip removable>team-a</et-chip><span class="probe">{{ labels().remove }}</span>`,
})
class GermanChipsComponent {
  labels = injectChipLabels();
  source = inject(CHIP_LABELS);
}

@Component({
  selector: 'et-scenario-stray-chip-remove',
  imports: [ChipRemoveDirective],
  template: `<button class="stray" etChipRemove>×</button>`,
})
class StrayChipRemoveComponent {}

describe('chip scenarios', () => {
  const scenario = useScenario();

  it('removes filter chips by their remove button and by Backspace or Delete', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamFiltersComponent);
    const page = fixture.componentInstance;

    s.tick();

    const chips = queryAll('et-chip');

    expect(chips.map((chip) => text(chip))).toEqual(['team-a', 'team-b', 'team-c']);
    expect(chips.map((chip) => chip.getAttribute('data-removable'))).toEqual(['true', 'true', 'true']);

    const removeButton = query<HTMLButtonElement>('et-chip .et-chip-remove-button');

    expect(removeButton.getAttribute('type')).toBe('button');
    expect(removeButton.getAttribute('aria-label')).toBe(DEFAULT_CHIP_LABELS.remove);
    expect(removeButton.hasAttribute('tabindex')).toBe(false);

    removeButton.click();
    s.tick();
    expect(page.removed).toEqual(['team-a']);
    expect(queryAll('et-chip').map((chip) => text(chip))).toEqual(['team-b', 'team-c']);

    const teamB = queryAll('et-chip')[0]!;

    teamB.focus();
    const backspace = s.keydown('Backspace', teamB);

    expect(backspace.defaultPrevented).toBe(true);
    s.tick();
    expect(page.removed).toEqual(['team-a', 'team-b']);

    const teamC = query('et-chip');

    expect(teamC.getAttribute('aria-disabled')).toBe('true');
    expect(teamC.getAttribute('data-disabled')).toBe('true');
    expect(teamC.querySelector('.et-chip-remove-button')?.hasAttribute('disabled')).toBe(true);
    expect(teamC.querySelector('.et-chip-remove-button')?.getAttribute('tabindex')).toBe('-1');

    expect(s.keydown('Delete', teamC).defaultPrevented).toBe(false);
    s.tick();
    expect(page.removed).toEqual(['team-a', 'team-b']);
  });

  it('drops the remove button while the chips are locked', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamFiltersComponent);

    s.tick();
    fixture.componentInstance.locked.set(true);
    s.tick();

    expect(queryAll('et-chip .et-chip-remove-button')).toHaveLength(0);
    expect(queryAll('et-chip').map((chip) => chip.getAttribute('data-removable'))).toEqual([null, null, null]);

    s.keydown('Backspace', query('et-chip'));
    s.tick();
    expect(fixture.componentInstance.removed).toEqual([]);
  });

  it('keeps a headless remove control from also activating a clickable chip', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TagChipComponent);
    const page = fixture.componentInstance;

    s.tick();

    const remove = query('.tag-remove');

    expect(remove.getAttribute('tabindex')).toBe('0');
    expect(remove.getAttribute('aria-label')).toBe('Remove team-a');
    expect(remove.hasAttribute('type')).toBe(false);

    remove.click();
    expect(page.removed).toBe(1);
    expect(page.activated).toBe(0);

    query('.tag').click();
    expect(page.activated).toBe(1);
  });

  it('takes every remove control out of the tab order inside a widget that owns chip focus', () => {
    const s = scenario();

    TestBed.createComponent(TagInputComponent);
    s.tick();

    expect(queryAll('.et-chip-remove-button').map((button) => button.getAttribute('tabindex'))).toEqual(['-1', '-1']);
  });

  it('localizes the remove label for a subtree', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GermanChipsComponent);

    s.tick();

    expect(query('.et-chip-remove-button').getAttribute('aria-label')).toBe('Entfernen');
    expect(text(query('.probe'))).toBe('Entfernen');
    expect(fixture.componentInstance.source).toEqual({ remove: 'Entfernen' });
  });

  it('reports a remove control placed outside a chip', () => {
    const s = scenario();

    TestBed.createComponent(StrayChipRemoveComponent);
    s.tick(1);

    s.expectError(code(CHIP_ERROR_CODES.REMOVE_OUTSIDE_CHIP));

    const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');
    const context = s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;

    expect(context?.element).toBe(query('.stray'));
    expect(query('.stray').getAttribute('tabindex')).toBe('-1');
  });
});
