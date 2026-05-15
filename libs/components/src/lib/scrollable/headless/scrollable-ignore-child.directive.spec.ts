import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { ScrollableIgnoreChildDirective } from './scrollable-ignore-child.directive';

@Component({
  template: `<div [enabled]="enabled" etScrollableIgnoreChild></div>`,
  imports: [ScrollableIgnoreChildDirective],
})
class IgnoreChildTestHost {
  enabled = true;
}

describe('ScrollableIgnoreChildDirective', () => {
  let fixture: ComponentFixture<IgnoreChildTestHost>;
  let div: HTMLDivElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IgnoreChildTestHost, ScrollableIgnoreChildDirective] });
    fixture = TestBed.createComponent(IgnoreChildTestHost);
    div = fixture.nativeElement.querySelector('div');
  });

  it('sets etScrollableIgnoreChild attribute when enabled is true', () => {
    fixture.detectChanges();
    expect(div.getAttribute('etScrollableIgnoreChild')).toBe('');
  });

  it('removes etScrollableIgnoreChild attribute when enabled is false', () => {
    fixture.componentInstance.enabled = false;
    fixture.detectChanges();
    expect(div.getAttribute('etScrollableIgnoreChild')).toBeNull();
  });
});
