import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TIMELINE_IMPORTS } from './timeline.imports';

@Component({
  selector: 'et-test-timeline-host',
  template: `
    <et-timeline>
      <et-timeline-item><p>Kickoff</p></et-timeline-item>
      <et-timeline-item><p>Halftime</p></et-timeline-item>
      <et-timeline-item><p>Fulltime</p></et-timeline-item>
    </et-timeline>
  `,
  imports: [TIMELINE_IMPORTS],
})
class TimelineHostComponent {}

describe('TimelineComponent', () => {
  it('exposes the list semantics screen readers need', () => {
    const fixture = TestBed.createComponent(TimelineHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-timeline') as HTMLElement;

    expect(host.classList.contains('et-timeline')).toBe(true);
    expect(host.getAttribute('role')).toBe('list');
    expect([...host.querySelectorAll('et-timeline-item')].map((el) => el.getAttribute('role'))).toEqual([
      'listitem',
      'listitem',
      'listitem',
    ]);
  });

  it('renders the projected items in order', () => {
    const fixture = TestBed.createComponent(TimelineHostComponent);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('et-timeline et-timeline-item');

    expect([...items].map((el: Element) => el.querySelector('.et-timeline-item-content')?.textContent?.trim())).toEqual(
      ['Kickoff', 'Halftime', 'Fulltime'],
    );
  });
});
