import { Component, signal } from '@angular/core';
import { StandingPick } from '@ethlete/bracket';
import '../../test-helpers';
import { NormalizedMatchParticipant } from '../match';
import { pressKey } from '../testing/driver-core';
import { STANDINGS_PICK_IMPORTS } from './standings.imports';
import { mountStandingsPick } from './testing/standings-pick-driver';

const participant = (id: string, name: string): NormalizedMatchParticipant => ({
  id,
  name,
  code: id.toUpperCase(),
  subtitle: null,
  emblem: null,
  seed: null,
});

const PARTICIPANTS = [
  participant('a', 'Alpha'),
  participant('b', 'Bravo'),
  participant('c', 'Charlie'),
  participant('d', 'Delta'),
];

@Component({
  template: `
    <et-standings-pick
      [(order)]="order"
      [participants]="participants()"
      [storedPicks]="storedPicks()"
      [advancingCount]="advancingCount()"
      [locked]="locked()"
    >
      @if (withMark()) {
        <ng-template let-row etStandingsPickMark>mark-{{ row.participant.id }}</ng-template>
      }
    </et-standings-pick>
  `,
  imports: [STANDINGS_PICK_IMPORTS],
})
class HostComponent {
  public participants = signal<NormalizedMatchParticipant[]>(PARTICIPANTS);
  public storedPicks = signal<StandingPick[]>([]);
  public advancingCount = signal(2);
  public locked = signal(false);
  public withMark = signal(false);
  public order = signal<readonly string[] | null>(null);
}

const create = () => mountStandingsPick(HostComponent);

describe('StandingsPickComponent', () => {
  it('opens in the backend order when nothing is stored', () => {
    const driver = create();

    expect(driver.order()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(driver.positions()).toEqual(['1', '2', '3', '4']);
  });

  it('opens in the stored order, gaps filled in backend order', () => {
    const driver = create();

    driver.host.storedPicks.set([{ position: 1, participantId: 'c' }]);
    driver.detectChanges();

    expect(driver.order()).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta']);
  });

  it('draws the cut under the last advancing row', () => {
    const driver = create();

    expect(driver.cutAfter()).toBe(1);

    driver.host.advancingCount.set(3);
    driver.detectChanges();

    expect(driver.cutAfter()).toBe(2);
  });

  it('draws no cut when nothing advances, and none when everything does', () => {
    const driver = create();

    driver.host.advancingCount.set(0);
    driver.detectChanges();

    expect(driver.cutAfter()).toBe(-1);

    driver.host.advancingCount.set(4);
    driver.detectChanges();

    expect(driver.cutAfter()).toBe(-1);
  });

  it('names every row above the cut for assistive tech', () => {
    const driver = create();

    expect(driver.queryAll('.et-standings-pick-note').length).toBe(2);
  });

  it('names a row control with the participant and both ways to sort it', () => {
    const driver = create();

    expect(driver.handles()[0]?.getAttribute('aria-label')).toBe('Move Alpha. Drag it, or use the arrow keys.');
  });

  it('moves a row down with ArrowDown and back up with ArrowUp', () => {
    const driver = create();

    pressKey(driver.handles()[0]!, 'ArrowDown');

    expect(driver.order()).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta']);

    pressKey(driver.handles()[1]!, 'ArrowUp');

    expect(driver.order()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('leaves the order alone on ArrowUp at the top and ArrowDown at the bottom', () => {
    const driver = create();

    pressKey(driver.handles()[0]!, 'ArrowUp');
    pressKey(driver.handles()[3]!, 'ArrowDown');

    expect(driver.order()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('keeps the control on the row it moved', () => {
    const driver = create();
    const handle = driver.handles()[0]!;

    pressKey(handle, 'ArrowDown');

    expect(driver.handles()[1]).toBe(handle);
  });

  it('writes the arranged order back through the two-way binding', () => {
    const driver = create();

    pressKey(driver.handles()[3]!, 'ArrowUp');

    expect(driver.host.order()).toEqual(['a', 'b', 'd', 'c']);
  });

  it('follows an order pushed in from outside', () => {
    const driver = create();

    driver.host.order.set(['d', 'c', 'b', 'a']);
    driver.detectChanges();

    expect(driver.order()).toEqual(['Delta', 'Charlie', 'Bravo', 'Alpha']);
  });

  it('keeps the order readable and offers no control when locked', () => {
    const driver = create();

    driver.host.locked.set(true);
    driver.detectChanges();

    expect(driver.order()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(driver.handles()).toEqual([]);
    expect(driver.element().getAttribute('data-locked')).toBe('');
  });

  it('refuses a move while locked', () => {
    const driver = create();

    driver.host.locked.set(true);
    driver.detectChanges();

    driver.pick().move({ from: 0, to: 3 });
    driver.detectChanges();

    expect(driver.order()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(driver.host.order()).toBeNull();
  });

  it('fills the row slot with the app mark template', () => {
    const driver = create();

    driver.host.withMark.set(true);
    driver.detectChanges();

    expect(driver.marks()).toEqual(['mark-a', 'mark-b', 'mark-c', 'mark-d']);
  });

  it('draws no mark slot without a template', () => {
    const driver = create();

    expect(driver.marks()).toEqual([]);
  });
});

describe('StandingsPickDirective', () => {
  const state = () => create().pick();

  it('ignores a move onto the same index', () => {
    const pick = state();

    pick.move({ from: 1, to: 1 });

    expect(pick.order()).toBeNull();
  });

  it('ignores a move from or to an index outside the list', () => {
    const pick = state();

    pick.move({ from: -1, to: 0 });
    pick.move({ from: 0, to: -1 });
    pick.move({ from: 4, to: 0 });
    pick.move({ from: 0, to: 4 });

    expect(pick.order()).toBeNull();
  });

  it('moves a row to the top, to the bottom and into the middle', () => {
    const pick = state();

    pick.move({ from: 3, to: 0 });
    expect(pick.resolvedOrder()).toEqual(['d', 'a', 'b', 'c']);

    pick.move({ from: 0, to: 3 });
    expect(pick.resolvedOrder()).toEqual(['a', 'b', 'c', 'd']);

    pick.move({ from: 0, to: 2 });
    expect(pick.resolvedOrder()).toEqual(['b', 'c', 'a', 'd']);
  });

  it('marks the advancing rows and the row the cut belongs under', () => {
    const pick = state();

    expect(pick.rows().map((row) => [row.isAdvancing, row.isLastAdvancing])).toEqual([
      [true, false],
      [true, true],
      [false, false],
      [false, false],
    ]);
  });

  it('drops an order entry no participant answers to', () => {
    const pick = state();

    pick.order.set(['a', 'ghost', 'b']);

    expect(pick.rows().map((row) => row.participant.id)).toEqual(['a', 'b']);
  });
});
