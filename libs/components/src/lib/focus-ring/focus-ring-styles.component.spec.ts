import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { FocusRingStylesComponent } from './focus-ring-styles.component';

describe('FocusRingStylesComponent', () => {
  let fixture: ComponentFixture<FocusRingStylesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FocusRingStylesComponent] });
    fixture = TestBed.createComponent(FocusRingStylesComponent);
  });

  it('renders without error', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('renders an empty template', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('does not create any child elements', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.children.length).toBe(0);
  });
});
