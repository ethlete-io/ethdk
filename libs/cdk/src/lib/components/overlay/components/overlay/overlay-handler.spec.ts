import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { createOverlayHandlerWithQueryParamLifecycle } from './overlay-handler';
import { dialogOverlayStrategy } from './strategies';

@Component({ template: '' })
class QueryParamOverlayComponent {}

const productOverlay = createOverlayHandlerWithQueryParamLifecycle({
  component: QueryParamOverlayComponent,
  queryParamKey: 'product',
  strategies: dialogOverlayStrategy(),
});

@Component({ template: '' })
class HostComponent {
  public product = productOverlay();
}

describe('createOverlayHandlerWithQueryParamLifecycle', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), provideLocationMocks()],
    });
  });

  it('does not cancel a pending navigation that drops the param when closed', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigation = router.navigateByUrl('/elsewhere');
    fixture.componentInstance.product.close();

    expect(await navigation).toBe(true);
    expect(router.url).toBe('/elsewhere');

    fixture.destroy();
  });
});
