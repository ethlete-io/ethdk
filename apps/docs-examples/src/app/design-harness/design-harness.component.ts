import { PlatformLocation } from '@angular/common';
import {
  Component,
  effect,
  inject,
  Type,
  untracked,
  viewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, from, map, Observable, of } from 'rxjs';
import { DESIGN_HARNESS_PARTS } from './design-harness-parts';

type HarnessState = { component: Type<unknown>; props: Record<string, unknown> } | { error: string };

const stateOf$ = (search: string): Observable<HarnessState> => {
  const params = new URLSearchParams(search);
  const part = params.get('part') ?? '';
  const load = Object.hasOwn(DESIGN_HARNESS_PARTS, part) ? DESIGN_HARNESS_PARTS[part] : undefined;

  if (!load) return of({ error: `Unknown design part "${part}".` });

  let props: unknown;

  try {
    props = JSON.parse(params.get('props') ?? '{}') ?? {};
  } catch {
    return of({ error: `The props of "${part}" are not JSON.` });
  }

  if (typeof props !== 'object' || Array.isArray(props)) return of({ error: `The props of "${part}" are no object.` });

  return from(load()).pipe(
    map((component) => ({ component, props: props as Record<string, unknown> })),
    catchError((error: unknown) => of({ error: `"${part}" did not load: ${String(error)}` })),
  );
};

@Component({
  selector: 'app-root',
  template: `
    @let current = state();

    @if (current && 'error' in current) {
      <p>{{ current.error }}</p>
    } @else {
      <div [style]="{ display: 'flow-root', width: 'fit-content' }" data-design-harness-host>
        <ng-container #outlet />
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DesignHarnessComponent {
  private platformLocation = inject(PlatformLocation);
  private outlet = viewChild('outlet', { read: ViewContainerRef });
  protected state = toSignal(stateOf$(this.platformLocation.search));

  constructor() {
    effect(() => {
      const outlet = this.outlet();
      const state = this.state();

      if (!outlet || !state || 'error' in state) return;

      untracked(() => {
        outlet.clear();

        const ref = outlet.createComponent(state.component);

        Object.entries(state.props).forEach(([name, value]) => ref.setInput(name, value));
      });
    });
  }
}
