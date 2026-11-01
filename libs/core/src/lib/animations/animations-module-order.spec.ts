import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('animations module evaluation order', () => {
  beforeEach(() => vi.resetModules());

  it('renders etAnimatedLifecycle when a bundle evaluates animatable.directive first', async () => {
    await import('./animatable.directive');
    const { AnimatedLifecycleDirective } = await import('./animated-lifecycle.directive');

    @Component({
      selector: 'et-animations-module-order-host',
      template: `<div etAnimatedLifecycle></div>`,
      imports: [AnimatedLifecycleDirective],
    })
    class HostComponent {}

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[etAnimatedLifecycle]')).not.toBeNull();
  });
});
