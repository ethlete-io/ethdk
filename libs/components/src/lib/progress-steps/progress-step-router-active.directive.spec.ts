import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, provideRouter } from '@angular/router';
import '../../test-helpers';
import { PROGRESS_STEPS_IMPORTS } from './progress-steps.imports';

@Component({ selector: 'et-test-page', template: '' })
class PageComponent {}

@Component({
  selector: 'et-test-router-active-host',
  template: `
    <et-progress-steps>
      <a [routerLink]="['/account']" etProgressStepRouterActive state="complete" et-progress-step>Account</a>
      <a [routerLink]="['/shipping']" etProgressStepRouterActive et-progress-step>Shipping</a>
      <a [routerLink]="['/payment']" etProgressStepRouterActive etProgressStepExact et-progress-step>Payment</a>
      <a [routerLink]="['/review']" state="current" et-progress-step>Review</a>
    </et-progress-steps>
  `,
  imports: [PROGRESS_STEPS_IMPORTS, RouterLink],
})
class HostComponent {}

describe('ProgressStepRouterActiveDirective', () => {
  const setup = async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'account', component: PageComponent },
          { path: 'shipping', component: PageComponent, children: [{ path: 'child', component: PageComponent }] },
          { path: 'payment', component: PageComponent, children: [{ path: 'child', component: PageComponent }] },
        ]),
      ],
    });

    const fixture = TestBed.createComponent(HostComponent);
    const router = TestBed.inject(Router);
    const states = () =>
      Array.from(fixture.nativeElement.querySelectorAll('[et-progress-step]') as NodeListOf<HTMLElement>).map((el) =>
        el.getAttribute('data-state'),
      );

    fixture.detectChanges();

    return {
      fixture,
      states,
      navigate: async (url: string) => {
        await router.navigateByUrl(url);
        fixture.detectChanges();
      },
    };
  };

  it('keeps the set state while its link is inactive', async () => {
    const { states } = await setup();

    expect(states()).toEqual(['complete', 'upcoming', 'upcoming', 'current']);
  });

  it('makes the step whose link is active the current one and follows the route', async () => {
    const { states, navigate, fixture } = await setup();

    await navigate('/shipping');
    expect(states()).toEqual(['complete', 'current', 'upcoming', 'current']);
    expect(fixture.nativeElement.querySelectorAll('[aria-current="step"]')[0]?.textContent).toContain('Shipping');

    await navigate('/account');
    expect(states()).toEqual(['current', 'upcoming', 'upcoming', 'current']);
  });

  it('matches URLs beneath the link unless etProgressStepExact is set', async () => {
    const { states, navigate } = await setup();

    await navigate('/shipping/child');
    expect(states()[1]).toBe('current');

    await navigate('/payment/child');
    expect(states()[2]).toBe('upcoming');

    await navigate('/payment');
    expect(states()[2]).toBe('current');
  });
});
