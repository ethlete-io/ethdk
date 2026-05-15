import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ButtonStylesDirective } from './button-styles.directive';

@Component({
  selector: 'test-host',
  template: '<button etButtonStyles>Click</button>',
  imports: [ButtonStylesDirective],
})
class TestHost {}

describe('ButtonStylesDirective', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHost] });
    fixture = TestBed.createComponent(TestHost);
  });

  it('applies to the host element without error', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('renders the button with the directive', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button).not.toBeNull();
  });
});
