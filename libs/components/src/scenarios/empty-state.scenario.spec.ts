import { Component, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY_STATE_IMPORTS, EmptyStateComponent } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-search-results',
  imports: [EMPTY_STATE_IMPORTS],
  template: `
    @if (results().length) {
      <ul>
        @for (result of results(); track result) {
          <li>{{ result }}</li>
        }
      </ul>
    } @else {
      <et-empty-state [heading]="heading()" [description]="description()">
        <span class="icon" etIcon>?</span>
        <button (click)="clearFilters()" etEmptyStateAction type="button">Clear filters</button>
        <span class="stray">not projected</span>
      </et-empty-state>
    }
  `,
})
class SearchResultsComponent {
  all = ['team-a', 'team-b'];
  filter = signal('zzz');
  showDescription = signal(true);
  results = computed(() => this.all.filter((team) => team.includes(this.filter())));
  heading = signal<string | undefined>('No results');
  description = computed(() => (this.showDescription() ? 'Try a different search term.' : undefined));

  clearFilters() {
    this.filter.set('');
  }
}

@Component({
  selector: 'et-scenario-inbox',
  imports: [EmptyStateComponent],
  template: `<et-empty-state [heading]="heading()" />`,
})
class InboxComponent {
  heading = signal<string | undefined>(undefined);
  emptyState = viewChild.required(EmptyStateComponent);
}

describe('empty state scenarios', () => {
  const scenario = useScenario();

  it('shows icon, heading, description and action in that order', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const empty = host.querySelector('et-empty-state')!;

    expect(empty.classList).toContain('et-empty-state');
    expect(Array.from(empty.children).map((child) => child.className || child.tagName)).toEqual([
      'icon',
      'et-empty-state-title',
      'et-empty-state-description',
      'BUTTON',
    ]);
    expect(empty.querySelector('.et-empty-state-title')?.textContent).toBe('No results');
    expect(empty.querySelector('.et-empty-state-description')?.textContent).toBe('Try a different search term.');
    expect(empty.querySelector('.stray')).toBeNull();
  });

  it('drops the heading and description the app leaves unset', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.heading.set(undefined);
    fixture.componentInstance.showDescription.set(false);
    s.tick();

    expect(host.querySelector('.et-empty-state-title')).toBeNull();
    expect(host.querySelector('.et-empty-state-description')).toBeNull();
    expect(host.querySelector('[etEmptyStateAction]')).not.toBeNull();
  });

  it('gives way to the results once the projected action clears the filter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchResultsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    host.querySelector<HTMLButtonElement>('[etEmptyStateAction]')!.click();
    s.tick();

    expect(host.querySelector('et-empty-state')).toBeNull();
    expect(Array.from(host.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['team-a', 'team-b']);
  });

  it('adds a heading the app sets later and stays empty without one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InboxComponent);
    const app = fixture.componentInstance;
    const state = (fixture.nativeElement as HTMLElement).querySelector('et-empty-state')!;

    s.tick();

    expect(state.classList).toContain('et-empty-state');
    expect(state.querySelector('p')).toBeNull();

    app.heading.set('Inbox zero');
    s.tick();

    expect(app.emptyState().heading()).toBe('Inbox zero');
    expect(state.querySelector('.et-empty-state-title')?.textContent).toBe('Inbox zero');
    expect(state.querySelector('.et-empty-state-description')).toBeNull();
  });
});
