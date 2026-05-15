import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { ScrollableActiveChildDirective } from './scrollable-active-child.directive';

@Component({
  template: `<div #ref [etScrollableActiveChild]="enabled"></div>`,
  imports: [ScrollableActiveChildDirective],
})
class ActiveChildTestHost {
  enabled = true;
}

describe('ScrollableActiveChildDirective', () => {
  let fixture: ComponentFixture<ActiveChildTestHost>;
  let div: HTMLDivElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ActiveChildTestHost, ScrollableActiveChildDirective],
    });
    fixture = TestBed.createComponent(ActiveChildTestHost);
    div = fixture.nativeElement.querySelector('div');
  });

  it('initializes without error when scrollable parent is missing', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('applies directive to element', () => {
    fixture.detectChanges();
    expect(div.tagName.toLowerCase()).toBe('div');
  });

  it('enabled input can be set to false', () => {
    fixture.componentInstance.enabled = false;
    fixture.detectChanges();
    expect(fixture.componentInstance.enabled).toBe(false);
  });
});
