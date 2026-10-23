import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { injectRouterState } from '../index';
import { Scenario, useScenario } from './harness';

const seen: { id: number | null; trigger: string | null }[] = [];

@Component({ selector: 'et-scenario-page', template: '' })
class PageComponent {
  state = injectRouterState();

  constructor() {
    const { id, trigger } = this.state();

    seen.push({ id, trigger });
  }
}

@Component({ selector: 'et-scenario-shell', imports: [RouterOutlet], template: '<router-outlet />' })
class ShellComponent {}

const navigate = async (s: Scenario, url: string) => {
  const router = s.run(() => TestBed.inject(Router));
  const navigation = router.navigateByUrl(url);

  await s.settle();
  await navigation;
  s.tick();
};

describe('router navigation identity scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideRouter([
        { path: 'a', component: PageComponent },
        { path: 'b', component: PageComponent },
      ]),
      provideLocationMocks(),
    ],
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it('exposes the id and trigger of the current and the last navigation in the router state', async () => {
    const s = scenario();
    const shell = TestBed.createComponent(ShellComponent);
    const state = s.consumer().run(() => injectRouterState());

    expect(state().id).toBeNull();
    expect(state().trigger).toBeNull();

    await navigate(s, '/a');

    expect(seen[0]).toEqual({ id: 1, trigger: 'imperative' });
    expect(state().id).toBe(1);
    expect(state().trigger).toBe('imperative');

    await navigate(s, '/b');

    expect(seen[1]).toEqual({ id: 2, trigger: 'imperative' });
    expect(state().id).toBe(2);

    shell.destroy();
  });
});
