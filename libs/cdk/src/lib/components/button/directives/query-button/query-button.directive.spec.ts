import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnyLegacyQuery, QueryStateType } from '@ethlete/query';
import { BehaviorSubject } from 'rxjs';
import { ButtonDirective } from '../button';
import { QueryButtonDirective } from './query-button.directive';

@Component({
  selector: 'button[et-test-query-button]',
  template: '',
  hostDirectives: [ButtonDirective, { directive: QueryButtonDirective, inputs: ['query'] }],
})
class TestQueryButtonComponent {}

@Component({
  template: `<button [query]="query()" et-test-query-button>Save</button>`,
  imports: [TestQueryButtonComponent],
})
class HostComponent {
  readonly query = signal<AnyLegacyQuery | null>(null);
}

describe('QueryButtonDirective', () => {
  afterEach(() => vi.useRealTimers());

  it('clears the success reset timer when destroyed', () => {
    vi.useFakeTimers();

    const state$ = new BehaviorSubject<{ type: string }>({ type: QueryStateType.Prepared });
    const query = { state$, rawState: state$.value } as unknown as AnyLegacyQuery;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.query.set(query);
    fixture.detectChanges();

    const queryButton = fixture.debugElement.children[0]!.injector.get(QueryButtonDirective);
    state$.next({ type: QueryStateType.Success });
    fixture.destroy();
    vi.advanceTimersByTime(1000);

    expect(queryButton.showSuccess$.value).toBe(true);
  });
});
