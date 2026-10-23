import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { injectIsRouterInitialized } from '../index';
import { Scenario, useScenario } from './harness';

const seen: { initializedInConstructor: boolean; initialized: () => boolean }[] = [];

@Component({ selector: 'et-scenario-page', template: '' })
class PageComponent {
  initialized = injectIsRouterInitialized();

  constructor() {
    seen.push({ initializedInConstructor: this.initialized(), initialized: this.initialized });
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

describe('router initialized scenarios', () => {
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

  it('reports the router as initialized only after the first navigation has ended', async () => {
    const s = scenario();
    const shell = TestBed.createComponent(ShellComponent);

    s.tick();

    await navigate(s, '/a');

    expect(seen[0]?.initializedInConstructor).toBe(false);
    expect(seen[0]?.initialized()).toBe(true);

    await navigate(s, '/b');

    expect(seen[1]?.initializedInConstructor).toBe(true);

    const late = s.consumer();

    expect(late.run(() => injectIsRouterInitialized())()).toBe(true);

    shell.destroy();
  });
});
