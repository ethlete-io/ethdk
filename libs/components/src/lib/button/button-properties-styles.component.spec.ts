import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ButtonPropertiesStylesComponent } from './button-properties-styles.component';

describe('ButtonPropertiesStylesComponent', () => {
  let fixture: ComponentFixture<ButtonPropertiesStylesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ButtonPropertiesStylesComponent] });
    fixture = TestBed.createComponent(ButtonPropertiesStylesComponent);
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
