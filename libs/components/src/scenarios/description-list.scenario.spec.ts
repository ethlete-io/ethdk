import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DESCRIPTION_LIST_IMPORTS, DESCRIPTION_LIST_VARIANTS, DescriptionListVariant } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-player-details',
  imports: [DESCRIPTION_LIST_IMPORTS],
  template: `
    <dl [variant]="variant()" et-description-list>
      @for (row of rows(); track row.term) {
        <dt>{{ row.term }}</dt>
        <dd>{{ row.detail }}</dd>
      }
    </dl>
  `,
})
class PlayerDetailsComponent {
  variant = signal<DescriptionListVariant>(DESCRIPTION_LIST_VARIANTS.INLINE);
  rows = signal([
    { term: 'Name', detail: 'Jane Doe' },
    { term: 'Team', detail: 'team-a' },
  ]);
}

describe('description list scenarios', () => {
  const scenario = useScenario();

  it('keeps the native term and detail markup and pairs the rows in order', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlayerDetailsComponent);
    const list = (fixture.nativeElement as HTMLElement).querySelector('dl')!;

    s.tick();

    expect(list.classList).toContain('et-description-list');
    expect(list.getAttribute('role')).toBeNull();
    expect(Array.from(list.children).map((child) => `${child.tagName}:${child.textContent}`)).toEqual([
      'DT:Name',
      'DD:Jane Doe',
      'DT:Team',
      'DD:team-a',
    ]);

    fixture.componentInstance.rows.update((rows) => [...rows, { term: 'Position', detail: 'Goalkeeper' }]);
    s.tick();

    expect(list.querySelectorAll('dt').length).toBe(3);
    expect(list.lastElementChild?.textContent).toBe('Goalkeeper');
  });

  it('reflects the inline default and the stacked variant', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlayerDetailsComponent);
    const list = (fixture.nativeElement as HTMLElement).querySelector('dl')!;

    s.tick();

    expect(list.getAttribute('data-variant')).toBe('inline');

    fixture.componentInstance.variant.set(DESCRIPTION_LIST_VARIANTS.STACKED);
    s.tick();

    expect(list.getAttribute('data-variant')).toBe('stacked');
  });
});
