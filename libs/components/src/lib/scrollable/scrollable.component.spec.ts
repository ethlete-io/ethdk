import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { createScrollableDriver } from './testing/scrollable-driver';
import { ScrollableComponent } from './scrollable.component';
import {
  SCROLLABLE_DARKEN_IMPORTS,
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
} from './scrollable.imports';

describe('ScrollableComponent', () => {
  let fixture: ComponentFixture<ScrollableComponent>;
  let driver: ReturnType<typeof createScrollableDriver<ScrollableComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ScrollableComponent],
    });

    fixture = TestBed.createComponent(ScrollableComponent);
    driver = createScrollableDriver(fixture);
  });

  it('renders masks by default and no chrome until a feature registers some', () => {
    fixture.detectChanges();

    expect(driver.masks()).not.toBeNull();
    expect(driver.buttons()).toBeNull();
    expect(driver.navigation()).toBeNull();
  });

  it('forwards container role and custom class inputs', () => {
    fixture.componentRef.setInput('scrollableRole', 'tablist');
    fixture.componentRef.setInput('scrollableClass', 'custom-scroll-container');
    fixture.detectChanges();

    const container = driver.container();
    expect(container?.getAttribute('role')).toBe('tablist');
    expect(container?.classList.contains('custom-scroll-container')).toBe(true);
  });

  it('omits masks when renderMasks is off', () => {
    fixture.componentRef.setInput('renderMasks', false);
    fixture.detectChanges();

    expect(driver.masks()).toBeNull();
  });
});

describe('ScrollableComponent opt-in features', () => {
  @Component({
    template: `
      <et-scrollable
        [etScrollableButtons]="{ sticky: true }"
        etScrollableDarken
        etScrollableDrag
        etScrollableSnap
      ></et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_DARKEN_IMPORTS],
  })
  class TestHostComponent {}

  it('stamps the buttons and carries the feature host classes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const scrollable = fixture.nativeElement.querySelector('et-scrollable') as HTMLElement;

    expect(scrollable.querySelector('et-scrollable-buttons')).not.toBeNull();
    expect(scrollable.classList.contains('et-scrollable--sticky-buttons')).toBe(true);
    expect(scrollable.classList.contains('et-scrollable--darken-non-intersecting-items')).toBe(true);
    expect(scrollable.getAttribute('snap')).toBe('');
  });
});
