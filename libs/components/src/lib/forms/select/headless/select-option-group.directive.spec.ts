import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectDirective } from './select.directive';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-select
      [value]="value()"
      [filterMode]="filterMode()"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a player"
    >
      <input etSelectSearch placeholder="Search" />
      <et-select-option-group label="Forwards">
        <et-select-option value="mbappe">Mbappé</et-select-option>
        <et-select-option value="haaland">Haaland</et-select-option>
      </et-select-option-group>
      <et-select-option-group label="Midfielders">
        <et-select-option value="bellingham">Bellingham</et-select-option>
      </et-select-option-group>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class GroupedSelectTestHost {
  value = signal<unknown>(null);
  filterMode = signal<'none' | 'internal' | 'external'>('internal');
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('SelectOptionGroupDirective', () => {
  let fixture: ComponentFixture<GroupedSelectTestHost>;
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
  const groups = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="group"]') ?? []);
  const options = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const setQuery = (query: string) => {
    const search =
      pane()?.querySelector<HTMLInputElement>('input') ??
      fixture.nativeElement.querySelector<HTMLInputElement>('input');

    if (search) {
      search.value = query;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
    }
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [GroupedSelectTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(GroupedSelectTestHost);
    fixture.detectChanges();
    select = fixture.debugElement.children[0]!.injector.get(SelectDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    select.hide();
    tick();
    await flushFrames();
  });

  it('renders labelled groups wrapping their options', async () => {
    await openSelect();

    const renderedGroups = groups();

    expect(renderedGroups.length).toBe(2);
    // aria-labelledby points at the visible header
    const labelledBy = renderedGroups[0]!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(pane()?.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBe('Forwards');
    expect(renderedGroups[0]!.querySelectorAll('[role="option"]').length).toBe(2);
    expect(renderedGroups[1]!.querySelectorAll('[role="option"]').length).toBe(1);
  });

  it('keeps keyboard navigation flat across groups', async () => {
    await openSelect();

    // three options total, registered flat in DOM order regardless of grouping
    expect(select.visibleItems().map((item) => item.value())).toEqual(['mbappe', 'haaland', 'bellingham']);
    expect(options().length).toBe(3);
  });

  it('hides a group once all its options are filtered out', async () => {
    await openSelect();
    setQuery('bell');
    await flushFrames();
    tick();

    const [forwards, midfielders] = groups();

    // "Forwards" has no match → hidden; "Midfielders" keeps Bellingham
    expect(forwards!.hasAttribute('hidden')).toBe(true);
    expect(midfielders!.hasAttribute('hidden')).toBe(false);
  });

  it('shows all groups again when the query clears', async () => {
    await openSelect();
    setQuery('bell');
    await flushFrames();
    tick();
    setQuery('');
    await flushFrames();
    tick();

    expect(groups().every((group) => !group.hasAttribute('hidden'))).toBe(true);
  });
});
