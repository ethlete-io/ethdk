import { Component, ElementRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectBoundaryElement, provideBoundaryElement } from './boundary-element';

@Component({ selector: 'et-test-boundary-host', template: '', providers: [provideBoundaryElement()] })
class HostComponent {
  boundary = injectBoundaryElement();
  host = inject<ElementRef<HTMLElement>>(ElementRef);
}

describe('boundary element', () => {
  it('falls back to the document element without a host', () => {
    TestBed.configureTestingModule({ providers: [provideBoundaryElement()] });

    expect(TestBed.runInInjectionContext(() => injectBoundaryElement()).value()).toBe(document.documentElement);
  });

  it('uses the host element and prefers an override', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const { boundary, host } = fixture.componentInstance;

    expect(boundary.value()).toBe(host.nativeElement);

    const custom = document.createElement('div');
    boundary.override.set(custom);
    expect(boundary.value()).toBe(custom);

    boundary.override.set(null);
    expect(boundary.value()).toBe(host.nativeElement);
  });
});
